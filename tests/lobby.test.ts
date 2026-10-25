import { describe, expect, it } from 'vitest';
import { mulberry32, type LobbyView, type Mode, type Move } from '../src';
import { handleApi } from '../server/http';
import {
  addBot,
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
import { MemoryStore } from '../server/store';

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
    await expect(createLobby(store, { name: '  ', mode: '1v1', startScore: 30 })).rejects.toThrow(/name/);
    await expect(createLobby(store, { name: 'A', mode: '5v5', startScore: 30 })).rejects.toThrow(/mode/);
    await expect(createLobby(store, { name: 'A', mode: '1v1', startScore: 25 })).rejects.toThrow(/score/i);
  });

  it('lets friends join with the code in any case, until it is full', async () => {
    const { store, host } = await make('1v1');
    const bela = await joinLobby(store, { code: host.code.toLowerCase(), name: 'Béla' });
    expect(bela.code).toBe(host.code);
    await expect(joinLobby(store, { code: host.code, name: 'Cili' })).rejects.toThrow(/full/);
    await expect(joinLobby(store, { code: 'ZZZZ', name: 'Cili' })).rejects.toThrow(/No lobby/);
  });

  it('refuses a duplicate name and restores a seat for a known token', async () => {
    const { store, host } = await make('2v1');
    await expect(joinLobby(store, { code: host.code, name: 'anna' })).rejects.toThrow(/name/);
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
    await expect(getState(store, { code: host.code, token: 'nope' })).rejects.toThrow(/not part/);
    await expect(getState(store, { code: host.code, token: other.host.token })).rejects.toThrow(/not part/);
  });
});

describe('host controls', () => {
  it('only the host changes settings, adds bots, removes players and starts', async () => {
    const { store, host } = await make('2v1');
    const bela = await joinLobby(store, { code: host.code, name: 'Béla' });
    const asBela = { code: host.code, token: bela.token };
    await expect(updateSettings(store, { ...asBela, settings: { startScore: 60 } })).rejects.toThrow(/host/);
    await expect(addBot(store, asBela)).rejects.toThrow(/host/);
    await expect(startGame(store, asBela)).rejects.toThrow(/host/);

    const asHost = { code: host.code, token: host.token };
    const updated = await updateSettings(store, { ...asHost, settings: { startScore: 60, showPoints: false } });
    expect(updated.view.settings).toEqual({ mode: '2v1', startScore: 60, showPoints: false });
    await expect(updateSettings(store, { ...asHost, settings: { mode: '1v1' } })).resolves.toBeTruthy();
    await expect(addBot(store, asHost)).rejects.toThrow(/full/);
  });

  it('cannot shrink the mode below the number of players, and cannot start short', async () => {
    const { store, host } = await make('2v2');
    const asHost = { code: host.code, token: host.token };
    await joinLobby(store, { code: host.code, name: 'B' });
    await joinLobby(store, { code: host.code, name: 'C' });
    await expect(updateSettings(store, { ...asHost, settings: { mode: '1v1' } })).rejects.toThrow(/more players/);
    await expect(startGame(store, asHost)).rejects.toThrow(/1 more/);
  });

  it('fills seats with bots, names them, and lets the host remove a player', async () => {
    const { store, host } = await make('2v2');
    const asHost = { code: host.code, token: host.token };
    await addBot(store, asHost);
    const view = (await addBot(store, asHost)).view;
    expect(view.players.map((p) => p.name)).toEqual(['Anna', 'Bot 1', 'Bot 2']);
    const removed = await removePlayer(store, { ...asHost, playerId: view.players[1]!.id });
    expect(removed.view.players.map((p) => p.name)).toEqual(['Anna', 'Bot 2']);
    await expect(removePlayer(store, { ...asHost, playerId: host.playerId })).rejects.toThrow(/host/);
  });

  it('hands the lobby to another human when the host leaves, and deletes an empty one', async () => {
    const { store, host } = await make('2v1');
    const bela = await joinLobby(store, { code: host.code, name: 'Béla' });
    await leaveLobby(store, { code: host.code, token: host.token });
    const view = await peek(store, host.code, bela.token);
    expect(view.me.isHost).toBe(true);
    await leaveLobby(store, { code: host.code, token: bela.token });
    await expect(getState(store, { code: host.code, token: bela.token })).rejects.toThrow(/No lobby/);
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
      if (view.match!.winners) break;
      await startNextHand(store, { ...auth, handNumber: view.match!.handNumber }, mulberry32(hands));
      expect(hands).toBeLessThan(80);
    }
    const view = await peek(store, host.code, host.token);
    expect(view.match!.scores.some((s) => s <= 0)).toBe(true);

    const again = await rematch(store, auth, mulberry32(7));
    expect(again.view.match!.winners).toBeNull();
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
    await expect(playMove(store, { code: host.code, token: waiting.token, move: forged })).rejects.toThrow(/not allowed/);
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
    if (ended.match!.winners) return;
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

    const state = await handleApi(store, { method: 'GET', action: 'state', query: { code, token }, body: undefined });
    expect(state.status).toBe(200);
    expect((await handleApi(store, { method: 'POST', action: 'state', query: {}, body: {} })).status).toBe(405);
    expect((await handleApi(store, { method: 'GET', action: 'create', query: {}, body: {} })).status).toBe(405);
    expect((await handleApi(store, { method: 'POST', action: 'nope', query: {}, body: {} })).status).toBe(404);
    const bad = await handleApi(store, { method: 'GET', action: 'state', query: { code, token: 'x' }, body: undefined });
    expect(bad).toEqual({ status: 403, body: { error: 'You are not part of this lobby' } });
  });
});
