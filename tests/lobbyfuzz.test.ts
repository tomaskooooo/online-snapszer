import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mulberry32, type LobbyView, type Mode, type Move } from '../src';
import {
  addBot,
  clock,
  createLobby,
  getState,
  joinLobby,
  playMove,
  rematch,
  startGame,
  startNextHand,
} from '../server/lobby';
import { MemoryStore } from '../server/store';

let now = 0;
beforeEach(() => {
  now = 1_000_000;
  clock.now = () => now;
});
afterEach(() => {
  clock.now = () => Date.now();
});

interface Human {
  token: string;
  name: string;
}

/**
 * Plays whole matches through the lobby layer: humans that move, humans that go quiet so the
 * clock plays for them, bots, players who have left and watch, and "next hand" pressed by anyone.
 */
describe.each<[Mode, number]>([
  ['1v1', 1],
  ['2v1', 1],
  ['2v1', 2],
  ['2v2', 1],
  ['2v2', 2],
  ['2v2', 3],
])('lobby fuzz: %s with %i human(s)', (mode, humanCount) => {
  it('finishes, keeps every secret, and never hangs', async () => {
    const needed = mode === '1v1' ? 2 : mode === '2v1' ? 3 : 4;
    for (let seed = 1; seed <= 12; seed++) {
      const rng = mulberry32(seed * 7001 + humanCount);
      const store = new MemoryStore();
      const host = await createLobby(store, { name: 'H0', mode, startScore: 30, showPoints: seed % 2 === 0 });
      const humans: Human[] = [{ token: host.token, name: 'H0' }];
      for (let i = 1; i < humanCount; i++) {
        const j = await joinLobby(store, { code: host.code, name: `H${i}` });
        humans.push({ token: j.token, name: `H${i}` });
      }
      for (let i = humanCount; i < needed; i++) await addBot(store, { code: host.code, token: host.token });
      await startGame(store, { code: host.code, token: host.token }, rng);

      const view = async (h: Human): Promise<LobbyView> => {
        const res = await getState(store, { code: host.code, token: h.token });
        if (!('view' in res)) throw new Error('expected a view');
        return res.view;
      };

      let rounds = 0;
      for (;;) {
        expect(++rounds, `lobby ${seed} never finishes`).toBeLessThan(6000);
        const views = await Promise.all(humans.map(view));
        const m = views[0]!.match!;

        // Nobody ever receives a token, in any view.
        const allJson = JSON.stringify(views);
        for (const h of humans) expect(allJson).not.toContain(h.token);

        if (m.over) {
          expect(m.ranking).toHaveLength(needed);
          // A rematch brings everybody back.
          const again = await rematch(store, { code: host.code, token: host.token }, rng);
          expect(again.view.match!.over).toBe(false);
          expect(again.view.match!.scores.every((s) => s === 30)).toBe(true);
          break;
        }

        if (m.hand.phase === 'ended') {
          // Any human may press it, even one who is out; pressing twice is harmless.
          const presser = humans[Math.floor(rng() * humans.length)]!;
          await startNextHand(store, { code: host.code, token: presser.token, handNumber: m.handNumber }, rng);
          await startNextHand(store, { code: host.code, token: presser.token, handNumber: m.handNumber }, rng);
          continue;
        }

        const mover = views.findIndex((v) => v.match!.hand.legalMoves.some((mv) => mv.type !== 'claim'));
        if (mover < 0) {
          // A bot or nobody is on the clock: nothing should be waiting for a human here.
          expect(views[0]!.turnDeadline, 'game is stuck with no human to move and no clock').not.toBeNull();
          now += 61_000;
          continue;
        }

        // A human who is "away" lets the clock play: time passes and the server moves for them.
        if (rng() < 0.15) {
          now += 61_000;
          continue;
        }

        const v = views[mover]!;
        const legal = v.match!.hand.legalMoves;
        const pool = legal.filter((mv) => mv.type !== 'claim' && mv.type !== 'forfeit');
        const claim = legal.find((mv) => mv.type === 'claim');
        let move: Move = pool[Math.floor(rng() * pool.length)] ?? legal[0]!;
        if (claim && rng() < 0.3) move = claim;
        now += 1000;
        await playMove(store, { code: host.code, token: humans[mover]!.token, move });
      }
    }
  });
});
