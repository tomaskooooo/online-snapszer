import { randomBytes, randomInt } from 'node:crypto';
import {
  applyMatchMove,
  legalMoves,
  newMatch,
  nextHand,
  playerCount,
  viewFor,
  type JoinResponse,
  type LobbyView,
  type MatchState,
  type Mode,
  type Move,
  type Rng,
  type Settings,
  type StartScore,
} from '../src';
import { botMove } from './bot';
import type { Lobby, LobbyPlayer, Store } from './store';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const MODES: Mode[] = ['1v1', '2v1', '2v2'];
const START_SCORES: StartScore[] = [30, 40, 50, 60];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_NAME = 20;

export const secureRng: Rng = () => randomInt(0, 2 ** 32) / 2 ** 32;

/** Every player has this long for each decision. */
export const TURN_SECONDS = 60;
/** After this many timeouts in a row a player is treated as away and gets the short clock. */
export const AWAY_AFTER = 2;
export const AWAY_SECONDS = 8;

/** Tests replace `now` to move time forward. */
export const clock = { now: () => Date.now() };

const newCode = () => Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]!).join('');
const newToken = () => randomBytes(24).toString('hex');
const newId = () => randomBytes(6).toString('hex');

export const normalizeCode = (raw: unknown): string => String(raw ?? '').trim().toUpperCase();

function cleanName(raw: unknown): string {
  const name = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME);
  if (!name) throw new HttpError(400, 'Please enter a name');
  return name;
}

function cleanSettings(raw: Partial<Settings> | undefined, base?: Settings): Settings {
  const mode = (raw?.mode ?? base?.mode) as Mode;
  const startScore = (raw?.startScore ?? base?.startScore) as StartScore;
  const showPoints = raw?.showPoints ?? base?.showPoints ?? true;
  if (!MODES.includes(mode)) throw new HttpError(400, 'Unknown game mode');
  if (!START_SCORES.includes(startScore)) throw new HttpError(400, 'Starting score must be 30, 40, 50 or 60');
  return { mode, startScore, showPoints: Boolean(showPoints) };
}

async function load(store: Store, code: string): Promise<Lobby> {
  const lobby = await store.get(normalizeCode(code));
  if (!lobby) throw new HttpError(404, 'No lobby with that code');
  lobby.timeouts ??= [];
  lobby.deadline ??= null;
  return lobby;
}

function authenticate(lobby: Lobby, token: unknown): LobbyPlayer {
  const player = lobby.players.find((p) => !p.bot && p.token === token);
  if (!player) throw new HttpError(403, 'You are not part of this lobby');
  return player;
}

function requireHost(lobby: Lobby, player: LobbyPlayer): void {
  if (lobby.hostId !== player.id) throw new HttpError(403, 'Only the host can do that');
}

async function save(store: Store, lobby: Lobby): Promise<void> {
  lobby.version++;
  await store.set(lobby.code, lobby);
}

/** Starts the clock for whoever must move next, if that is a human. */
export function armTimer(lobby: Lobby): void {
  const match = lobby.match;
  lobby.deadline = null;
  if (!match || match.winners || match.hand.phase === 'ended') return;
  const seat = match.hand.turn;
  const player = lobby.players[seat];
  if (!player || player.bot) return;
  const away = (lobby.timeouts[seat] ?? 0) >= AWAY_AFTER;
  lobby.deadline = clock.now() + (away ? AWAY_SECONDS : TURN_SECONDS) * 1000;
}

/**
 * Plays a move for a player whose time ran out. Nothing runs in the background on a
 * serverless host, so this is called whenever someone asks for the lobby state.
 */
function applyTimeout(lobby: Lobby, rng: Rng): boolean {
  if (!lobby.match || lobby.deadline === null || clock.now() < lobby.deadline) return false;
  const hand = lobby.match.hand;
  if (hand.phase === 'ended' || lobby.match.winners) return false;
  const seat = hand.turn;
  const move = botMove(hand, seat, rng, false) ?? legalMoves(hand, seat).find((m) => m.type !== 'claim');
  if (!move) return false;
  lobby.match = applyMatchMove(lobby.match, move);
  lobby.timeouts[seat] = (lobby.timeouts[seat] ?? 0) + 1;
  runBots(lobby, rng);
  armTimer(lobby);
  return true;
}

export function enforceTimeout(store: Store, code: string, rng: Rng = secureRng): Promise<void> {
  return store.withLock(code, async () => {
    const lobby = await store.get(code);
    if (!lobby || !applyTimeout(lobby, rng)) return;
    await save(store, lobby);
  });
}

/** Bots play until it is a human's turn (or the hand is over). */
export function runBots(lobby: Lobby, rng: Rng = secureRng): void {
  if (!lobby.match) return;
  for (let steps = 0; steps < 300; steps++) {
    const hand = lobby.match.hand;
    if (hand.phase === 'ended' || lobby.match.winners) return;
    let moved = false;
    for (let seat = 0; seat < lobby.players.length && !moved; seat++) {
      if (!lobby.players[seat]!.bot) continue;
      const move = botMove(hand, seat, rng);
      if (!move) continue;
      lobby.match = applyMatchMove(lobby.match, move);
      moved = true;
    }
    if (!moved) return;
  }
}

export function viewOf(lobby: Lobby, player: LobbyPlayer): LobbyView {
  const seat = lobby.players.indexOf(player);
  return {
    code: lobby.code,
    version: lobby.version,
    phase: lobby.phase,
    settings: lobby.settings,
    players: lobby.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      bot: p.bot,
      isHost: p.id === lobby.hostId,
      seat: i,
    })),
    needed: playerCount(lobby.settings.mode),
    me: { id: player.id, seat, isHost: player.id === lobby.hostId, missed: lobby.timeouts[seat] ?? 0 },
    match: lobby.match ? viewFor(lobby.match, seat) : null,
    turnDeadline: lobby.deadline,
    serverTime: clock.now(),
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function createLobby(
  store: Store,
  input: { name?: unknown; mode?: unknown; startScore?: unknown; showPoints?: unknown },
): Promise<JoinResponse> {
  const name = cleanName(input.name);
  const settings = cleanSettings(input as Partial<Settings>);
  const host: LobbyPlayer = { id: newId(), token: newToken(), name, bot: false };

  for (let attempt = 0; attempt < 20; attempt++) {
    const code = newCode();
    const lobby: Lobby = {
      code,
      version: 1,
      hostId: host.id,
      settings,
      phase: 'waiting',
      players: [host],
      match: null,
      deadline: null,
      timeouts: [],
    };
    if (await store.create(code, lobby)) return { code, playerId: host.id, token: host.token };
  }
  throw new HttpError(503, 'Could not find a free lobby code, try again');
}

export function joinLobby(store: Store, input: { code?: unknown; name?: unknown; token?: unknown }): Promise<JoinResponse> {
  const code = normalizeCode(input.code);
  return store.withLock(code, async () => {
    const lobby = await load(store, code);

    // Coming back with a known token just restores the seat.
    const existing = lobby.players.find((p) => !p.bot && p.token === input.token);
    if (existing) return { code, playerId: existing.id, token: existing.token };

    const name = cleanName(input.name);
    if (lobby.phase !== 'waiting') throw new HttpError(409, 'That game has already started');
    if (lobby.players.length >= playerCount(lobby.settings.mode)) throw new HttpError(409, 'The lobby is full');
    if (lobby.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      throw new HttpError(409, 'Someone in the lobby already uses that name');
    }

    const player: LobbyPlayer = { id: newId(), token: newToken(), name, bot: false };
    lobby.players.push(player);
    await save(store, lobby);
    return { code, playerId: player.id, token: player.token };
  });
}

export async function getState(
  store: Store,
  input: { code?: unknown; token?: unknown; v?: unknown },
): Promise<{ unchanged: true } | { view: LobbyView }> {
  const code = normalizeCode(input.code);
  let lobby = await load(store, code);
  if (lobby.deadline !== null && clock.now() >= lobby.deadline) {
    await enforceTimeout(store, code);
    lobby = await load(store, code);
  }
  const player = authenticate(lobby, input.token);
  if (input.v !== undefined && Number(input.v) === lobby.version) return { unchanged: true };
  return { view: viewOf(lobby, player) };
}

/** Runs a change on a lobby under lock, saves it, and returns the caller's fresh view. */
async function mutate(
  store: Store,
  input: { code?: unknown; token?: unknown },
  change: (lobby: Lobby, player: LobbyPlayer) => void | Promise<void>,
): Promise<{ view: LobbyView }> {
  const code = normalizeCode(input.code);
  return store.withLock(code, async () => {
    const lobby = await load(store, code);
    const player = authenticate(lobby, input.token);
    await change(lobby, player);
    await save(store, lobby);
    return { view: viewOf(lobby, player) };
  });
}

const requireWaiting = (lobby: Lobby) => {
  if (lobby.phase !== 'waiting') throw new HttpError(409, 'The game has already started');
};

export const updateSettings = (store: Store, input: { code?: unknown; token?: unknown; settings?: Partial<Settings> }) =>
  mutate(store, input, (lobby, player) => {
    requireHost(lobby, player);
    requireWaiting(lobby);
    const settings = cleanSettings(input.settings, lobby.settings);
    if (lobby.players.length > playerCount(settings.mode)) {
      throw new HttpError(409, 'There are more players than seats in that mode');
    }
    lobby.settings = settings;
  });

export const addBot = (store: Store, input: { code?: unknown; token?: unknown }) =>
  mutate(store, input, (lobby, player) => {
    requireHost(lobby, player);
    requireWaiting(lobby);
    if (lobby.players.length >= playerCount(lobby.settings.mode)) throw new HttpError(409, 'The lobby is full');
    const taken = new Set(lobby.players.map((p) => p.name));
    let n = 1;
    while (taken.has(`Bot ${n}`)) n++;
    lobby.players.push({ id: newId(), token: '', name: `Bot ${n}`, bot: true });
  });

export const removePlayer = (store: Store, input: { code?: unknown; token?: unknown; playerId?: unknown }) =>
  mutate(store, input, (lobby, player) => {
    requireHost(lobby, player);
    requireWaiting(lobby);
    const target = lobby.players.find((p) => p.id === input.playerId);
    if (!target) throw new HttpError(404, 'No such player');
    if (target.id === lobby.hostId) throw new HttpError(400, 'The host cannot be removed');
    lobby.players = lobby.players.filter((p) => p.id !== target.id);
  });

export const startGame = (store: Store, input: { code?: unknown; token?: unknown }, rng: Rng = secureRng) =>
  mutate(store, input, (lobby, player) => {
    requireHost(lobby, player);
    requireWaiting(lobby);
    const needed = playerCount(lobby.settings.mode);
    if (lobby.players.length !== needed) {
      throw new HttpError(409, `Waiting for ${needed - lobby.players.length} more player(s)`);
    }
    lobby.phase = 'playing';
    lobby.match = newMatch(lobby.settings, rng, Math.floor(rng() * needed));
    lobby.timeouts = [];
    runBots(lobby, rng);
    armTimer(lobby);
  });

export const playMove = (store: Store, input: { code?: unknown; token?: unknown; move?: unknown }, rng: Rng = secureRng) =>
  mutate(store, input, (lobby, player) => {
    if (lobby.phase !== 'playing' || !lobby.match) throw new HttpError(409, 'The game has not started');
    const raw = input.move as Move | undefined;
    if (!raw || typeof raw !== 'object') throw new HttpError(400, 'Missing move');
    const move = { ...raw, seat: lobby.players.indexOf(player) } as Move;
    try {
      lobby.match = applyMatchMove(lobby.match, move);
    } catch {
      throw new HttpError(409, 'That move is not allowed right now');
    }
    lobby.timeouts[move.seat] = 0;
    runBots(lobby, rng);
    armTimer(lobby);
  });

export const startNextHand = (
  store: Store,
  input: { code?: unknown; token?: unknown; handNumber?: unknown },
  rng: Rng = secureRng,
) =>
  mutate(store, input, (lobby) => {
    const match = lobby.match;
    if (!match) throw new HttpError(409, 'The game has not started');
    // Several players may press the button at once: only the first press counts.
    if (match.handNumber !== Number(input.handNumber)) return;
    if (match.winners) throw new HttpError(409, 'The match is over');
    if (match.hand.phase !== 'ended') throw new HttpError(409, 'The hand is still running');
    lobby.match = nextHand(match, rng);
    runBots(lobby, rng);
    armTimer(lobby);
  });

export const rematch = (store: Store, input: { code?: unknown; token?: unknown }, rng: Rng = secureRng) =>
  mutate(store, input, (lobby, player) => {
    requireHost(lobby, player);
    if (!lobby.match?.winners) throw new HttpError(409, 'The match is not over yet');
    const needed = playerCount(lobby.settings.mode);
    lobby.match = newMatch(lobby.settings, rng, Math.floor(rng() * needed));
    lobby.timeouts = [];
    runBots(lobby, rng);
    armTimer(lobby);
  });

/** Leaving before the game starts frees the seat; once playing, the seat is kept for a return. */
export function leaveLobby(store: Store, input: { code?: unknown; token?: unknown }): Promise<{ ok: true }> {
  const code = normalizeCode(input.code);
  return store.withLock(code, async () => {
    const lobby = await load(store, code);
    const player = authenticate(lobby, input.token);
    if (lobby.phase !== 'waiting') return { ok: true as const };
    lobby.players = lobby.players.filter((p) => p.id !== player.id);
    const nextHost = lobby.players.find((p) => !p.bot);
    if (!nextHost) {
      await store.del(code);
      return { ok: true as const };
    }
    lobby.hostId = nextHost.id;
    await save(store, lobby);
    return { ok: true as const };
  });
}

export type { MatchState };
