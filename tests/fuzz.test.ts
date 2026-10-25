import { describe, expect, it } from 'vitest';
import {
  applyMatchMove,
  cardId,
  legalMoves,
  mulberry32,
  newMatch,
  nextHand,
  playerCount,
  viewFor,
  type Card,
  type MatchState,
  type Mode,
  type Move,
} from '../src';
import { checkConservation } from './helpers';

/** Everything a view may show about cards that are not the viewer's own. */
function publicCards(m: MatchState): Set<string> {
  const h = m.hand;
  const ids = new Set<string>();
  const add = (c: Card) => ids.add(cardId(c));
  h.trick.forEach((p) => add(p.card));
  h.lastTrick?.forEach((p) => add(p.card));
  if (h.calledCard) add(h.calledCard);
  return ids;
}

/** One seat at a time may act (apart from a claim window); anything else is a stuck or double turn. */
function actingSeats(m: MatchState): number[] {
  const h = m.hand;
  return Array.from({ length: h.n }, (_, i) => i).filter((i) => legalMoves(h, i).some((mv) => mv.type !== 'claim'));
}

function checkViews(m: MatchState): void {
  const h = m.hand;
  if (h.phase === 'ended') return;
  const open = publicCards(m);
  for (const seat of m.seats.concat(m.out)) {
    const json = JSON.stringify(viewFor(m, seat));
    m.seats.forEach((other, local) => {
      if (other === seat) return;
      for (const card of h.hands[local]!) {
        if (open.has(cardId(card))) continue;
        expect(json, `seat ${seat} can see a hidden card of seat ${other}`).not.toContain(JSON.stringify(card));
      }
    });
    for (const card of h.undealt) expect(json).not.toContain(JSON.stringify(card));
  }
}

function pickMove(m: MatchState, rng: () => number): { move: Move; seat: number } {
  const h = m.hand;
  const seats = actingSeats(m);
  expect(seats, `phase ${h.phase}: exactly one seat must be able to act`).toHaveLength(1);
  const local = seats[0]!;
  const moves = legalMoves(h, local);

  // Claims by any seat are possible too; take one now and then, true or false.
  const claimers = Array.from({ length: h.n }, (_, i) => i).filter((i) => legalMoves(h, i).some((mv) => mv.type === 'claim'));
  if (claimers.length > 0 && rng() < 0.25) {
    const seat = claimers[Math.floor(rng() * claimers.length)]!;
    return { move: { type: 'claim', seat }, seat: m.seats[seat]! };
  }

  const pool = moves.filter((mv) => mv.type !== 'claim');
  const rare = pool.filter((mv) => mv.type === 'forfeit' || (mv.type === 'declare' && mv.kind !== 'none') || (mv.type === 'play' && mv.enough) || (mv.type === 'kontra' && mv.kontra));
  const common = pool.filter((mv) => !rare.includes(mv));
  const useRare = rare.length > 0 && (common.length === 0 || rng() < 0.08);
  const from = useRare ? rare : common;
  return { move: from[Math.floor(rng() * from.length)]!, seat: m.seats[local]! };
}

describe.each<Mode>(['1v1', '2v1', '2v2'])('whole matches with random moves: %s', (mode) => {
  it('never get stuck, lose a card, leak a hand or break the score', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rng = mulberry32(seed * 31337);
      let m = newMatch({ mode, startScore: 30, showPoints: seed % 2 === 0 }, rng, seed % playerCount(mode));
      const startPlayers = playerCount(mode);
      let hands = 0;
      let steps = 0;

      while (!m.over) {
        expect(++hands, `match ${seed} never ends`).toBeLessThan(400);
        while (m.hand.phase !== 'ended') {
          expect(++steps, `match ${seed}: a hand never ends`).toBeLessThan(60000);
          const { move, seat } = pickMove(m, rng);
          m = applyMatchMove(m, { ...move, seat });
          checkConservation(m.hand);
          if (steps % 7 === 0) checkViews(m);
        }

        // After every hand the table is consistent.
        const stillIn = m.seats.filter((s) => !m.out.includes(s));
        expect(new Set(m.out).size, 'a player left twice').toBe(m.out.length);
        expect(m.out.length + (m.over ? 0 : stillIn.length)).toBeLessThanOrEqual(startPlayers);
        for (const s of m.out) expect(m.scores[s]! <= 0 || m.hand.special === 'decider').toBe(true);
        for (const s of stillIn) if (!m.over) expect(m.scores[s]!, 'a player at zero is still in').toBeGreaterThan(0);
        for (const seat of m.seats) viewFor(m, seat); // must never throw

        if (m.over) break;
        m = nextHand(m, rng);
      }

      expect(m.ranking, `match ${seed}`).toHaveLength(startPlayers);
      expect(new Set(m.ranking).size).toBe(startPlayers);
    }
  });
});
