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
  | 'snapszerWon'
  | 'snapszerFailed'
  | 'durkoWon'
  | 'durkoFailed'
  | 'forfeit'
  | 'decider';

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
  /** Seat that leads the first trick. This is also the caller. */
  leader: number;
  caller: number;
  phase: Phase;
  hands: Card[][];
  /** Cards not dealt yet (the second round), and in 1v1 the ones that are never dealt. */
  undealt: Card[];
  trumpSuit: Suit | null;
  calledCard: Card | null;
  /** Seat to side. Side 0 is the caller's side. */
  sides: number[];
  declaration: Declaration | null;
  declareQueue: number[];
  /** The no-adutt deciding round that is played when two players are left, or null. */
  special: 'decider' | null;
  /** Seat that answered with a kontra (double points), or null. */
  kontra: number | null;
  /** Seats that still have to answer "kontra or play". */
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
  lastMeld: { seat: number; suit: Suit; points: number; trick: number } | null;
  result: HandResult | null;
}

export type Move =
  | { type: 'callTrump'; seat: number; suit: Suit }
  | { type: 'callCard'; seat: number; card: Card }
  | { type: 'declare'; seat: number; kind: 'snapszer' | 'durko' | 'none' }
  | { type: 'forfeit'; seat: number }
  | { type: 'kontra'; seat: number; kontra: boolean }
  | { type: 'play'; seat: number; card: Card; meld?: boolean; enough?: boolean }
  | { type: 'claim'; seat: number };

export interface MatchState {
  settings: Settings;
  /** Remaining score per seat, counting down. */
  scores: number[];
  /** Table seat of the dealer. */
  dealer: number;
  handNumber: number;
  /** The running hand. Its seat numbers are positions in `seats`, not table seats. */
  hand: HandState;
  /** Table seats still playing this hand, in table order. The hand's seat i is table seat seats[i]. */
  seats: number[];
  /** Table seats that have gone down to zero, in the order they left. */
  out: number[];
  /** Seats that left at the end of the most recent hand. */
  lastOut: number[];
  /** True once only one player is left. */
  over: boolean;
  /** Best to worst, filled in when the match is over. */
  ranking: number[] | null;
}
