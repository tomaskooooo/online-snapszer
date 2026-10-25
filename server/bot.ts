import { legalMoves, sideStats, sameCard, rankIndex, type Rng } from '../src';
import type { HandState, Move, Suit } from '../src/types';

/**
 * A simple player for empty seats. It plays legal cards at random, takes obvious
 * pair and swap chances, and only presses "Kész!" when it really has 66.
 */
export function botMove(h: HandState, seat: number, rng: Rng, allowClaim = true): Move | null {
  const legal = legalMoves(h, seat);
  if (legal.length === 0) return null;

  const claim = legal.find((m) => m.type === 'claim');
  if (allowClaim && claim && sideStats(h, h.sides[seat]!).points >= 66) return claim;

  const moves = legal.filter((m) => m.type !== 'claim');
  if (moves.length === 0) return null;
  const pick = <T>(items: T[]): T => items[Math.floor(rng() * items.length)]!;

  const hand = h.hands[seat]!;
  const suitCount = (s: Suit) => hand.filter((c) => c.suit === s).length;

  switch (h.phase) {
    case 'callTrump': {
      const calls = moves.filter((m): m is Extract<Move, { type: 'callTrump' }> => m.type === 'callTrump');
      return calls.reduce((best, m) => (suitCount(m.suit) > suitCount(best.suit) ? m : best));
    }
    case 'callCard': {
      const calls = moves.filter((m): m is Extract<Move, { type: 'callCard' }> => m.type === 'callCard');
      const foreign = calls.filter((m) => !hand.some((c) => sameCard(c, m.card)));
      const best = foreign.reduce((a, m) => {
        const score = (x: typeof m) => suitCount(x.card.suit) * 10 + rankIndex(x.card);
        return score(m) > score(a) ? m : a;
      });
      return best;
    }
    case 'declare':
      return moves.find((m) => m.type === 'declare' && m.kind === 'none') ?? moves[0]!;
    case 'kontra':
      return moves.find((m) => m.type === 'kontra' && !m.kontra) ?? moves[0]!;
    default: {
      const swap = moves.find((m) => m.type === 'swapTrump');
      if (swap) return swap;
      const melds = moves.filter((m) => m.type === 'play' && m.meld);
      const trumpMeld = melds.find((m) => m.type === 'play' && m.card.suit === h.trumpSuit);
      if (trumpMeld) return trumpMeld;
      if (melds.length > 0) return melds[0]!;
      const plain = moves.filter((m) => m.type === 'play' && !m.meld);
      return plain.length > 0 ? pick(plain) : pick(moves);
    }
  }
}
