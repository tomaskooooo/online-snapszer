export const SUITS = ['tok', 'zold', 'piros', 'makk'] as const;
export type Suit = (typeof SUITS)[number];

/** Low to high. The 9 only exists in the 24-card modes. */
export const RANKS = ['nine', 'under', 'over', 'king', 'ten', 'ace'] as const;
export type Rank = (typeof RANKS)[number];

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type Mode = '1v1' | '2v1' | '2v2';
export type StartScore = 30 | 40 | 50 | 60;

export interface Settings {
  mode: Mode;
  startScore: StartScore;
  /** When false the views carry no card point counts. */
  showPoints: boolean;
}

export type Phase = 'callTrump' | 'callCard' | 'declare' | 'kontra' | 'play' | 'ended';

export interface Play {
  seat: number;
  card: Card;
}

export interface Declaration {
  kind: 'snapszer' | 'durko';
  side: number;
  by: number;
}

export type ResultReason =
  | 'claim'
  | 'falseClaim'
  | 'lastTrick'
  | 'allTricks'
  | 'coverFailed'
  | 'snapszerWon'
  | 'snapszerFailed'
  | 'durkoWon'
  | 'durkoFailed'
  | 'forfeit';

export interface HandResult {
  winnerSide: number;
  /** Points the winners go down by, already doubled when a kontra was called. */
  amount: number;
  reason: ResultReason;
  kontra: boolean;
}

export interface HandState {
  mode: Mode;
  n: number;
  dealer: number;
  /** Seat that leads the first trick. In 2v1 and 2v2 this is also the caller. */
  leader: number;
  caller: number;
  phase: Phase;
  hands: Card[][];
  /** Cards not yet dealt (second round in 2v1 and 2v2). */
  undealt: Card[];
  /** 1v1 talon. The last element is the face-up trump card. */
  stock: Card[];
  trumpSuit: Suit | null;
  trumpCard: Card | null;
  calledCard: Card | null;
  /** Seat that covered the talon (1v1), or null. */
  covered: number | null;
  /** Seat to side. Side 0 is the caller's side in 2v1 and 2v2. */
  sides: number[];
  declaration: Declaration | null;
  declareQueue: number[];
  /** Seat that answered with a kontra (double points), or null. */
  kontra: number | null;
  /** Seats that still have to answer "kontra or play" (2v1 and 2v2). */
  kontraQueue: number[];
  turn: number;
  trick: Play[];
  won: Card[][];
  tricksWon: number[];
  points: number[];
  /** Pair points waiting for their owner to win a first trick. */
  pendingMeld: number[];
  tricksPlayed: number;
  /** Seat that may press "Kész!" right now. */
  claimWindow: number | null;
  lastTrickWinner: number | null;
  lastTrick: Play[] | null;
  lastMeld: { seat: number; suit: Suit; points: number } | null;
  result: HandResult | null;
}

export type Move =
  | { type: 'callTrump'; seat: number; suit: Suit }
  | { type: 'callCard'; seat: number; card: Card }
  | { type: 'declare'; seat: number; kind: 'snapszer' | 'durko' | 'none' }
  | { type: 'forfeit'; seat: number }
  | { type: 'kontra'; seat: number; kontra: boolean }
  | { type: 'play'; seat: number; card: Card; meld?: boolean }
  | { type: 'swapTrump'; seat: number }
  | { type: 'cover'; seat: number }
  | { type: 'claim'; seat: number };

export interface MatchState {
  settings: Settings;
  /** Remaining score per seat, counting down. */
  scores: number[];
  dealer: number;
  handNumber: number;
  hand: HandState;
  /** Seats that reached 0 or below. Null while the match runs. */
  winners: number[] | null;
}
