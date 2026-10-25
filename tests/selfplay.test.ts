import { describe, expect, it } from 'vitest';
import { cardPoints, mulberry32, startHand, type Mode, type ResultReason } from '../src';
import { checkConservation, playRandomHand } from './helpers';

const TRICKS: Record<Mode, number> = { '1v1': 10, '2v1': 8, '2v2': 6 };
const AMOUNTS = new Set([2, 4, 6, 12, 22, 32]);

describe.each<Mode>(['1v1', '2v1', '2v2'])('random full games: %s', (mode) => {
  const reasons = new Set<ResultReason>();

  it('every hand ends with a legal result and no card is ever lost', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const rng = mulberry32(seed * 7919);
      const dealer = seed % (mode === '1v1' ? 2 : mode === '2v1' ? 3 : 4);
      const start = startHand(mode, dealer, rng);
      const end = playRandomHand(start, rng, {
        declareChance: seed % 3 === 0 ? 0.5 : 0.05,
        falseClaimChance: seed % 5 === 0 ? 0.2 : 0,
        onStep: checkConservation,
      });

      const r = end.result!;
      expect(AMOUNTS.has(r.amount)).toBe(true);
      expect([0, 1]).toContain(r.winnerSide);
      reasons.add(r.reason);

      if (r.reason === 'lastTrick' || r.reason === 'allTricks' || r.reason === 'durkoWon' || r.reason === 'coverFailed') {
        // Played out: every card is in a won pile and the 120 points add up.
        // A covered talon is never played, so those hands end earlier and short of 120.
        if (end.covered === null && end.hands.every((h) => h.length === 0)) {
          expect(end.tricksPlayed).toBe(TRICKS[mode]);
          const total = end.won.flat().reduce((s, card) => s + cardPoints(card), 0);
          expect(total).toBe(120);
        }
      }
      if (r.reason === 'snapszerFailed' || r.reason === 'durkoFailed') {
        expect(r.amount).toBe(r.reason === 'durkoFailed' ? 32 : 12);
        expect(r.winnerSide).not.toBe(end.declaration!.side);
      }
      if (r.reason === 'snapszerWon') expect(r.amount).toBe(12);
      if (r.reason === 'allTricks') expect(r.amount).toBe(22);
      if (r.reason === 'durkoWon') expect(r.amount).toBe(32);
    }
  });

  it('exercises the main result paths', () => {
    // Re-run a smaller batch so this test stands alone.
    for (let seed = 1; seed <= 400; seed++) {
      const rng = mulberry32(seed * 104729);
      const start = startHand(mode, seed % 2, rng);
      reasons.add(playRandomHand(start, rng, { declareChance: seed % 3 === 0 ? 0.5 : 0.05, falseClaimChance: 0.2 }).result!.reason);
    }
    for (const expected of ['lastTrick', 'claim', 'falseClaim', 'snapszerFailed', 'durkoFailed'] as ResultReason[]) {
      expect(reasons, `no ${expected} seen in ${mode}`).toContain(expected);
    }
    if (mode === '1v1') expect(reasons).toContain('coverFailed');
  });
});
