import { RANKS, SUITS, type Card, type Mode, type Rank } from './types';

export type Rng = () => number;

const POINTS: Record<Rank, number> = {
  ace: 11,
  ten: 10,
  king: 4,
  over: 3,
  under: 2,
  nine: 0,
};

export const cardPoints = (c: Card): number => POINTS[c.rank];
export const rankIndex = (c: Card): number => RANKS.indexOf(c.rank);
export const cardId = (c: Card): string => `${c.suit}-${c.rank}`;
export const sameCard = (a: Card, b: Card): boolean => a.suit === b.suit && a.rank === b.rank;

export function makeDeck(mode: Mode): Card[] {
  const ranks = mode === '1v1' ? RANKS.filter((r) => r !== 'nine') : RANKS;
  return SUITS.flatMap((suit) => ranks.map((rank) => ({ suit, rank })));
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
