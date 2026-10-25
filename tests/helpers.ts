import { makeDeck, cardId, mulberry32, type Rng } from '../src/cards';
import { applyMove, createBareHand, legalMoves, sideStats } from '../src/engine';
import type { Card, HandState, Mode, Move, Rank, Suit } from '../src/types';

const RANK_CODES: Record<string, Rank> = {
  A: 'ace',
  T: 'ten',
  K: 'king',
  F: 'over',
  U: 'under',
  '9': 'nine',
};
const SUIT_CODES: Record<string, Suit> = { t: 'tok', z: 'zold', p: 'piros', m: 'makk' };

/** "At" is the Tök Ász, "Kz" the Zöld Király, "Up" the Piros Alsó. */
export function c(code: string): Card {
  return { rank: RANK_CODES[code[0]!]!, suit: SUIT_CODES[code[1]!]! };
}

export const cs = (codes: string): Card[] => (codes.trim() === '' ? [] : codes.trim().split(/\s+/).map(c));

/** A hand in the play phase with the given hands, ready for a scenario. */
export function scenario(opts: {
  mode: Mode;
  hands: string[];
  trump: Suit;
  turn?: number;
  stock?: string;
  trumpCard?: string;
  dealer?: number;
}): HandState {
  const h = createBareHand(opts.mode, opts.dealer ?? opts.hands.length - 1);
  h.hands = opts.hands.map(cs);
  h.trumpSuit = opts.trump;
  h.turn = opts.turn ?? h.leader;
  if (opts.stock) {
    h.stock = cs(opts.stock);
    h.trumpCard = h.stock[h.stock.length - 1]!;
  }
  return h;
}

export function play(h: HandState, seat: number, code: string, meld = false): HandState {
  return applyMove(h, { type: 'play', seat, card: c(code), ...(meld ? { meld: true } : {}) });
}

export const hasMove = (h: HandState, seat: number, m: Move): boolean =>
  legalMoves(h, seat).some((x) => JSON.stringify(x) === JSON.stringify(m));

export const playableCodes = (h: HandState, seat: number): string[] =>
  legalMoves(h, seat)
    .filter((m) => m.type === 'play' && !m.meld)
    .map((m) => cardId((m as Extract<Move, { type: 'play' }>).card))
    .sort();

/** Every card of the mode must appear exactly once across all zones. */
export function allCards(h: HandState): Card[] {
  return [
    ...h.hands.flat(),
    ...h.undealt,
    ...h.stock,
    ...h.trick.map((p) => p.card),
    ...h.won.flat(),
  ];
}

export function checkConservation(h: HandState): void {
  const ids = allCards(h).map(cardId).sort();
  const expected = makeDeck(h.mode).map(cardId).sort();
  if (JSON.stringify(ids) !== JSON.stringify(expected)) {
    throw new Error(`Cards not conserved: have ${ids.length}, expected ${expected.length}`);
  }
}

/**
 * Plays a hand with random legal moves. Claims "Kész!" only when the side really
 * has 66 and a coin flip says so, so most hands run to the end.
 */
export function playRandomHand(
  start: HandState,
  rng: Rng,
  opts: { declareChance?: number; falseClaimChance?: number; onStep?: (h: HandState) => void } = {},
): HandState {
  let h = start;
  let guard = 0;
  while (h.phase !== 'ended') {
    if (++guard > 500) throw new Error('Hand did not terminate');
    const seats = Array.from({ length: h.n }, (_, i) => i);
    const actors = seats.filter((s) => legalMoves(h, s).length > 0);
    if (actors.length === 0) throw new Error('No seat can move');

    let move: Move | undefined;
    const claimer = actors.find((s) => legalMoves(h, s).some((m) => m.type === 'claim'));
    if (claimer !== undefined) {
      const real = sideStats(h, h.sides[claimer]!).points >= 66;
      if ((real && rng() < 0.6) || (!real && rng() < (opts.falseClaimChance ?? 0))) {
        move = { type: 'claim', seat: claimer };
      }
    }
    if (!move) {
      const seat = actors.find((s) => legalMoves(h, s).some((m) => m.type !== 'claim'))!;
      const moves = legalMoves(h, seat).filter((m) => m.type !== 'claim');
      if (h.phase === 'declare') {
        const roll = rng();
        const chance = opts.declareChance ?? 0.1;
        const kind = roll < chance / 2 ? 'snapszer' : roll < chance ? 'durko' : 'none';
        move = { type: 'declare', seat, kind };
      } else if (h.phase === 'callCard' || h.phase === 'callTrump') {
        move = moves[Math.floor(rng() * moves.length)]!;
      } else {
        // Prefer plain plays so swaps and covers stay occasional.
        const plain = moves.filter((m) => m.type === 'play');
        const special = moves.filter((m) => m.type !== 'play' || m.meld);
        move = special.length > 0 && rng() < 0.12 ? special[Math.floor(rng() * special.length)]! : plain[Math.floor(rng() * plain.length)]!;
      }
    }
    h = applyMove(h, move);
    opts.onStep?.(h);
  }
  return h;
}

export { mulberry32 };
