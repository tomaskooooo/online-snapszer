import { legalMoves } from './engine';
import type {
  Card,
  Declaration,
  HandResult,
  MatchState,
  Move,
  Phase,
  Play,
  Settings,
  Suit,
} from './types';

/** What one player is allowed to know about the hand. Never contains other hands or the talon order. */
export interface HandView {
  phase: Phase;
  mySeat: number;
  turn: number;
  leader: number;
  caller: number;
  myHand: Card[];
  handSizes: number[];
  trumpSuit: Suit | null;
  /** Face-up talon card, or null once the talon is gone or covered. */
  trumpCard: Card | null;
  stockCount: number;
  covered: number | null;
  calledCard: Card | null;
  trick: Play[];
  lastTrick: Play[] | null;
  tricksWon: number[];
  /** Cards of the tricks this player won, so they can count for themselves. */
  myTricks: Card[];
  /** Card points per seat. Null when the host turned point counts off. */
  points: number[] | null;
  declaration: Declaration | null;
  lastMeld: { seat: number; suit: Suit; points: number } | null;
  claimAvailable: boolean;
  legalMoves: Move[];
  result: HandResult | null;
  /** Filled in only when the hand is over. */
  revealed: { hands: Card[][]; sides: number[] } | null;
}

export interface MatchView {
  settings: Settings;
  scores: number[];
  dealer: number;
  handNumber: number;
  winners: number[] | null;
  hand: HandView;
}

export function viewFor(match: MatchState, seat: number): MatchView {
  const h = match.hand;
  const ended = h.phase === 'ended';
  const hand: HandView = {
    phase: h.phase,
    mySeat: seat,
    turn: h.turn,
    leader: h.leader,
    caller: h.caller,
    myHand: h.hands[seat]!,
    handSizes: h.hands.map((x) => x.length),
    trumpSuit: h.trumpSuit,
    trumpCard: h.covered === null ? h.trumpCard : null,
    stockCount: h.stock.length,
    covered: h.covered,
    calledCard: h.calledCard,
    trick: h.trick,
    lastTrick: h.lastTrick,
    tricksWon: h.tricksWon,
    myTricks: h.won[seat]!,
    points: match.settings.showPoints ? h.points : null,
    declaration: h.declaration,
    lastMeld: h.lastMeld,
    claimAvailable: h.phase === 'play' && h.claimWindow === seat && h.declaration?.kind !== 'durko',
    legalMoves: legalMoves(h, seat),
    result: h.result,
    revealed: ended ? { hands: h.hands, sides: h.sides } : null,
  };
  return {
    settings: match.settings,
    scores: match.scores,
    dealer: match.dealer,
    handNumber: match.handNumber,
    winners: match.winners,
    hand,
  };
}
