import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mulberry32, type LobbyView, type Mode, type Move } from '../src';
import { handleApi } from '../server/http';
import {
  AWAY_SECONDS,
  TURN_SECONDS,
  addBot,
  clock,
  createLobby,
  getState,
  joinLobby,
  leaveLobby,
  playMove,
  rematch,
  removePlayer,
  startGame,
  startNextHand,
  updateSettings,
} from '../server/lobby';
import { botMove } from '../server/bot';
import { MemoryStore } from '../server/store';
import { scenario } from './helpers';

const make = async (mode: Mode = '1v1', extra: Record<string, unknown> = {}) => {
  const store = new MemoryStore();
  const host = await createLobby(store, { name: 'Anna', mode, startScore: 30, showPoints: true, ...extra });
  return { store, host };
};

const peek = async (store: MemoryStore, code: string, token: string): Promise<LobbyView> => {
  const res = await getState(store, { code, token });
  if (!('view' in res)) throw new Error('expected a view');
  return res.view;
};

describe('creating and joining', () => {
  it('makes a 4 character code and puts the host in the lobby', async () => {
    const { store, host } = await make('2v1');
    expect(host.code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
    const view = await peek(store, host.code, host.token);
    expect(view.players).toMatchObject([{ name: 'Anna', isHost: true, bot: false }]);
    expect(view.needed).toBe(3);
    expect(view.phase).toBe('waiting');
  });

  it('validates the name and the settings', async () => {
    const store = new MemoryStore();
    await expect(createLobby(store, { name: '  ', mode: '1v1', startScore: 30 })).rejects.toThrow(/nevet/);
    await expect(createLobby(store, { name: 'A', mode: '5v5', startScore: 30 })).rejects.toThrow(/játékmód/);
    await expect(createLobby(store, { name: 'A', mode: '1v1', startScore: 25 })).rejects.toThrow(/kezdőpont/);
  });

  it('lets friends join with the code in any case, until it is full', async () => {
    const { store, host } = await make('1v1');
    const bela = await joinLobby(store, { code: host.code.toLowerCase(), name: 'Béla' });
    expect(bela.code).toBe(host.code);
    await expect(joinLobby(store, { code: host.code, name: 'Cili' })).rejects.toThrow(/megtelt/);
    await expect(joinLobby(store, { code: 'ZZZZ', name: 'Cili' })).rejects.toThrow(/Nincs ilyen/);
  });

  it('refuses a duplicate name and restores a seat for a known token', async () => {
    const { store, host } = await make('2v1');
    await expect(joinLobby(store, { code: host.code, name: 'anna' })).rejects.toThrow(/nevet/);
    const again = await joinLobby(store, { code: host.code, name: 'whatever', token: host.token });
    expect(again.playerId).toBe(host.playerId);
    expect((await peek(store, host.code, host.token)).players).toHaveLength(1);
  });

  it('keeps every player when several join at once', async () => {
    const { store, host } = await make('2v2');
    await Promise.all(['B', 'C', 'D'].map((name) => joinLobby(store, { code: host.code, name })));
    expect((await peek(store, host.code, host.token)).players).toHaveLength(4);
  });
});

describe('what the server reveals', () => {
  it('never sends tokens, and answers "unchanged" for a current version', async () => {
    const { store, host } = await make('1v1');
    const bela = await joinLobby(store, { code: host.code, name: 'Béla' });
    const view = await peek(store, host.code, host.token);
    const json = JSON.stringify(view);
    expect(json).not.toContain(host.token);
    expect(json).not.toContain(bela.token);
    expect(await getState(store, { code: host.code, token: host.token, v: view.version })).toEqual({ unchanged: true });
    expect(await getState(store, { code: host.code, token: host.token, v: view.version - 1 })).toHaveProperty('view');
  });

  it('rejects strangers and wrong tokens', async () => {
    const { store, host } = await make('1v1');
    const other = await make('1v1');
    await expect(getState(store, { code: host.code, token: 'nope' })).rejects.toThrow(/Nem vagy tagja/);
    await expect(getState(store, { code: host.code, token: other.host.token })).rejects.toThrow(/Nem vagy tagja/);
  });
});

describe('host controls', () => {
  it('only the host changes settings, adds bots, removes players and starts', async () => {
    const { store, host } = await make('2v1');
    const bela = await joinLobby(store, { code: host.code, name: 'Béla' });
    const asBela = { code: host.code, token: bela.token };
    await expect(updateSettings(store, { ...asBela, settings: { startScore: 60 } })).rejects.toThrow(/gazd/);
    await expect(addBot(store, asBela)).rejects.toThrow(/gazd/);
    await expect(startGame(store, asBela)).rejects.toThrow(/gazd/);

    const asHost = { code: host.code, token: host.token };
    const updated = await updateSettings(store, { ...asHost, settings: { startScore: 60, showPoints: false } });
    expect(updated.view.settings).toEqual({ mode: '2v1', startScore: 60, showPoints: false });
    await expect(updateSettings(store, { ...asHost, settings: { mode: '1v1' } })).resolves.toBeTruthy();
    await expect(addBot(store, asHost)).rejects.toThrow(/megtelt/);
  });

  it('cannot shrink the mode below the number of players, and cannot start short', async () => {
    const { store, host } = await make('2v2');
    const asHost = { code: host.code, token: host.token };
    await joinLobby(store, { code: host.code, name: 'B' });
    await joinLobby(store, { code: host.code, name: 'C' });
    await expect(updateSettings(store, { ...asHost, settings: { mode: '1v1' } })).rejects.toThrow(/Többen/);
    await expect(startGame(store, asHost)).rejects.toThrow(/1 játékos/);
  });

  it('fills seats with bots, names them, and lets the host remove a player', async () => {
    const { store, host } = await make('2v2');
    const asHost = { code: host.code, token: host.token };
    await addBot(store, asHost);
    const view = (await addBot(store, asHost)).view;
    expect(view.players.map((p) => p.name)).toEqual(['Anna', 'Bot 1', 'Bot 2']);
    const removed = await removePlayer(store, { ...asHost, playerId: view.players[1]!.id });
    expect(removed.view.players.map((p) => p.name)).toEqual(['Anna', 'Bot 2']);
    await expect(removePlayer(store, { ...asHost, playerId: host.playerId })).rejects.toThrow(/gazd/);
  });

  it('hands the lobby to another human when the host leaves, and deletes an empty one', async () => {
    const { store, host } = await make('2v1');
    const bela = await joinLobby(store, { code: host.code, name: 'Béla' });
    await leaveLobby(store, { code: host.code, token: host.token });
    const view = await peek(store, host.code, bela.token);
    expect(view.me.isHost).toBe(true);
    await leaveLobby(store, { code: host.code, token: bela.token });
    await expect(getState(store, { code: host.code, token: bela.token })).rejects.toThrow(/Nincs ilyen/);
  });
});

/** A human who plays the first non-claim legal move each time. */
async function playHandAsHuman(store: MemoryStore, code: string, token: string): Promise<LobbyView> {
  for (let i = 0; i < 400; i++) {
    const view = await peek(store, code, token);
    const hand = view.match!.hand;
    if (hand.phase === 'ended') return view;
    const moves = hand.legalMoves.filter((m) => m.type !== 'claim');
    const claim = hand.legalMoves.find((m) => m.type === 'claim');
    if (claim && hand.points && hand.points[view.me.seat]! >= 66) {
      await playMove(store, { code, token, move: claim });
      continue;
    }
    if (moves.length === 0) throw new Error(`Stuck: nothing to play in phase ${hand.phase}`);
    const pick: Move =
      hand.phase === 'declare' ? moves.find((m) => m.type === 'declare' && m.kind === 'none')! : moves[0]!;
    await playMove(store, { code, token, move: pick });
  }
  throw new Error('Hand did not finish');
}

describe.each<[Mode, number]>([
  ['1v1', 1],
  ['2v1', 2],
  ['2v2', 3],
])('playing %s against bots', (mode, bots) => {
  it('runs hands through to the end of a match', async () => {
    const { store, host } = await make(mode, { startScore: 30 });
    const auth = { code: host.code, token: host.token };
    for (let i = 0; i < bots; i++) await addBot(store, auth);
    await startGame(store, auth, mulberry32(42));

    let hands = 0;
    for (;;) {
      const view = await playHandAsHuman(store, host.code, host.token);
      hands++;
      expect(view.match!.hand.result).toBeTruthy();
      if (view.match!.over) break;
      await startNextHand(store, { ...auth, handNumber: view.match!.handNumber }, mulberry32(hands));
      expect(hands).toBeLessThan(500);
    }
    const view = await peek(store, host.code, host.token);
    expect(view.match!.out.length).toBeGreaterThan(0);

    const again = await rematch(store, auth, mulberry32(7));
    expect(again.view.match!.over).toBe(false);
    expect(again.view.match!.scores.every((s) => s === 30)).toBe(true);
  });
});

describe('moves', () => {
  it('uses the seat of the sender and refuses illegal or out-of-turn moves', async () => {
    const { store, host } = await make('1v1');
    const bela = await joinLobby(store, { code: host.code, name: 'Béla' });
    await startGame(store, { code: host.code, token: host.token }, mulberry32(3));

    const hv = await peek(store, host.code, host.token);
    const bv = await peek(store, host.code, bela.token);
    const waiting = hv.match!.hand.legalMoves.length === 0 ? host : bela;
    const waitingView = waiting === host ? hv : bv;
    const acting = waiting === host ? bela : host;

    // Whoever may not act cannot, even by claiming to be the other seat.
    const forged = { type: 'declare', seat: waitingView.me.seat === 0 ? 1 : 0, kind: 'none' };
    await expect(playMove(store, { code: host.code, token: waiting.token, move: forged })).rejects.toThrow(/nem megengedett/);
    await expect(playMove(store, { code: host.code, token: acting.token, move: { type: 'cheat' } })).rejects.toThrow();
  });

  it('starts the next hand only once when pressed twice', async () => {
    const { store, host } = await make('2v1');
    const auth = { code: host.code, token: host.token };
    await addBot(store, auth);
    await addBot(store, auth);
    await startGame(store, auth, mulberry32(5));
    const ended = await playHandAsHuman(store, host.code, host.token);
    const n = ended.match!.handNumber;
    if (ended.match!.over) return;
    await startNextHand(store, { ...auth, handNumber: n }, mulberry32(1));
    await startNextHand(store, { ...auth, handNumber: n }, mulberry32(2));
    expect((await peek(store, host.code, host.token)).match!.handNumber).toBe(n + 1);
  });

  it('hides points from the view when the host turned them off', async () => {
    const { store, host } = await make('1v1', { showPoints: false });
    const auth = { code: host.code, token: host.token };
    await addBot(store, auth);
    await startGame(store, auth, mulberry32(8));
    expect((await peek(store, host.code, host.token)).match!.hand.points).toBeNull();
  });
});

describe('http layer', () => {
  it('routes actions, checks methods and reports errors as JSON', async () => {
    const store = new MemoryStore();
    const created = await handleApi(store, {
      method: 'POST',
      action: 'create',
      query: {},
      body: { name: 'Anna', mode: '1v1', startScore: 40, showPoints: true },
    });
    expect(created.status).toBe(200);
    const { code, token } = created.body as { code: string; token: string };

    const state = await handleApi(store, { method: 'GET', action: 'state', query: { code }, headers: { 'x-player-token': token }, body: undefined });
    expect(state.status).toBe(200);
    expect((await handleApi(store, { method: 'POST', action: 'state', query: {}, body: {} })).status).toBe(405);
    expect((await handleApi(store, { method: 'GET', action: 'create', query: {}, body: {} })).status).toBe(405);
    expect((await handleApi(store, { method: 'POST', action: 'nope', query: {}, body: {} })).status).toBe(404);
    const bad = await handleApi(store, { method: 'GET', action: 'state', query: { code }, headers: { 'x-player-token': 'x' }, body: undefined });
    // A token in the URL is not accepted any more, so it can never end up in a log by accident.
    const inUrl = await handleApi(store, { method: 'GET', action: 'state', query: { code, token }, body: undefined });
    expect(inUrl.status).toBe(403);
    expect(bad).toEqual({ status: 403, body: { error: 'Nem vagy tagja ennek a szobának' } });
  });
});

describe('turn clock', () => {
  let t = 1_000_000;
  beforeEach(() => {
    t = 1_000_000;
    clock.now = () => t;
  });
  afterEach(() => {
    clock.now = () => Date.now();
  });

  const setup = async (mode: Mode = '1v1', bots = 1) => {
    const { store, host } = await make(mode);
    const auth = { code: host.code, token: host.token };
    for (let i = 0; i < bots; i++) await addBot(store, auth);
    await startGame(store, auth, mulberry32(21));
    return { store, host, auth };
  };

  it('gives the player on turn 60 seconds, measured on the server clock', async () => {
    const { store, host } = await setup();
    const view = await peek(store, host.code, host.token);
    expect(view.match!.hand.turn).toBe(view.me.seat);
    expect(view.turnDeadline).toBe(t + TURN_SECONDS * 1000);
    expect(view.serverTime).toBe(t);
  });

  it('does nothing before the time is up', async () => {
    const { store, host } = await setup();
    const before = await peek(store, host.code, host.token);
    t += (TURN_SECONDS - 1) * 1000;
    const after = await peek(store, host.code, host.token);
    expect(after.version).toBe(before.version);
    expect(after.me.missed).toBe(0);
  });

  it('plays a move for a player who runs out of time and restarts the clock', async () => {
    const { store, host } = await setup('2v1', 2);
    const before = await peek(store, host.code, host.token);
    t += TURN_SECONDS * 1000 + 1;
    const after = await peek(store, host.code, host.token);
    expect(after.version).toBeGreaterThan(before.version);
    expect(after.me.missed).toBe(1);
    expect(JSON.stringify(after.match!.hand)).not.toBe(JSON.stringify(before.match!.hand));
    expect(after.turnDeadline).toBe(t + TURN_SECONDS * 1000);
  });

  it('a move the player makes resets their timeout count and restarts the clock', async () => {
    const { store, host, auth } = await setup();
    t += TURN_SECONDS * 1000 + 1;
    expect((await peek(store, host.code, host.token)).me.missed).toBe(1);
    const view = await peek(store, host.code, host.token);
    const move = view.match!.hand.legalMoves.find((m) => m.type !== 'claim')!;
    t += 5000;
    const next = await playMove(store, { ...auth, move });
    expect(next.view.me.missed).toBe(0);
    expect(next.view.turnDeadline).toBe(t + TURN_SECONDS * 1000);
  });

  it('treats a player as away after two timeouts in a row and shortens their clock', async () => {
    const { store, host } = await setup('2v1', 2);
    for (let i = 0; i < 2; i++) {
      t += TURN_SECONDS * 1000 + 1;
      await peek(store, host.code, host.token);
    }
    const view = await peek(store, host.code, host.token);
    expect(view.me.missed).toBe(2);
    expect(view.turnDeadline).toBe(t + AWAY_SECONDS * 1000);
  });

  it('keeps the game moving through a whole hand when nobody plays', async () => {
    const { store, host } = await setup('1v1');
    let view = await peek(store, host.code, host.token);
    for (let i = 0; i < 200 && view.match!.hand.phase !== 'ended'; i++) {
      t += 61_000;
      view = await peek(store, host.code, host.token);
    }
    expect(view.match!.hand.phase).toBe('ended');
    expect(view.turnDeadline).toBeNull();
  });

  it('the move played for an absent player is never a Kész! claim', () => {
    const h = scenario({ mode: '2v1', hands: ['9m 9p', '9z 9t', 'Um Uz'], trump: 'tok' });
    h.points = [70, 0, 0];
    h.tricksWon = [3, 0, 0];
    h.tricksPlayed = 3;
    h.claimWindow = 0;
    expect(botMove(h, 0, mulberry32(1))?.type).toBe('claim');
    expect(botMove(h, 0, mulberry32(1), false)?.type).toBe('play');
  });
});

describe('strangers', () => {
  it('cannot make the server move for an idle player, even after the clock ran out', async () => {
    clock.now = () => 5_000_000;
    const { store, host } = await make('1v1');
    await addBot(store, { code: host.code, token: host.token });
    await startGame(store, { code: host.code, token: host.token }, mulberry32(21));
    const before = await peek(store, host.code, host.token);
    clock.now = () => 5_000_000 + 120_000;
    await expect(getState(store, { code: host.code, token: 'nope' })).rejects.toThrow(/Nem vagy tagja/);
    clock.now = () => 5_000_000;
    const after = await peek(store, host.code, host.token);
    expect(after.version).toBe(before.version);
    clock.now = () => Date.now();
  });
});
