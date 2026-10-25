import { legalMoves } from './engine';
import type {
  Card,
  Declaration,
  HandResult,
  MatchState,
  Mode,
  Move,
  Phase,
  Play,
  Settings,
  Suit,
} from './types';

/**
 * What one player is allowed to know about the hand. Never contains other hands or the talon order.
 * Every seat number and every per-seat list uses TABLE seats (one entry per player in the lobby),
 * so the screen never has to care that a player has left and the hand is smaller now.
 */
export interface HandView {
  phase: Phase;
  /** The mode being played right now: it shrinks as players leave (2v2, then 2v1, then 1v1). */
  mode: Mode;
  /** Table seats that are playing this hand, in table order. */
  activeSeats: number[];
  mySeat: number;
  turn: number;
  leader: number;
  caller: number;
  /** Empty for a player who has already left the game. */
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
  /** Seat that called kontra (double points), or null. */
  kontra: number | null;
  lastMeld: { seat: number; suit: Suit; points: number; trick: number } | null;
  claimAvailable: boolean;
  legalMoves: Move[];
  result: HandResult | null;
  /** Final card points per seat, shown once the hand is over even when counts were hidden. */
  finalPoints: number[] | null;
  /** Filled in only when the hand is over. `sides` is -1 for seats that did not play this hand. */
  revealed: { hands: Card[][]; sides: number[] } | null;
}

export interface MatchView {
  settings: Settings;
  scores: number[];
  dealer: number;
  handNumber: number;
  /** Seats that went down to zero, in the order they left. */
  out: number[];
  /** Seats that left at the end of the hand that just finished. */
  lastOut: number[];
  over: boolean;
  /** Best to worst, once the match is over. */
  ranking: number[] | null;
  hand: HandView;
}

export function viewFor(match: MatchState, seat: number): MatchView {
  const h = match.hand;
  const ended = h.phase === 'ended';
  const total = match.scores.length;
  const local = match.seats.indexOf(seat);
  const playing = local >= 0;

  const toTable = (i: number) => match.seats[i]!;
  const tableSeat = (i: number | null) => (i === null ? null : toTable(i));
  /** Turns a list with one entry per hand seat into one entry per table seat. */
  const spread = <T,>(values: T[], fill: T): T[] => {
    const out = Array.from({ length: total }, () => fill);
    values.forEach((v, i) => (out[toTable(i)] = v));
    return out;
  };
  const plays = (list: Play[]) => list.map((p) => ({ ...p, seat: toTable(p.seat) }));

  const hand: HandView = {
    phase: h.phase,
    mode: h.mode,
    activeSeats: match.seats,
    mySeat: seat,
    turn: toTable(h.turn),
    leader: toTable(h.leader),
    caller: toTable(h.caller),
    myHand: playing ? h.hands[local]! : [],
    handSizes: spread(h.hands.map((x) => x.length), 0),
    trumpSuit: h.trumpSuit,
    trumpCard: h.covered === null ? h.trumpCard : null,
    stockCount: h.stock.length,
    covered: tableSeat(h.covered),
    calledCard: h.calledCard,
    trick: plays(h.trick),
    lastTrick: h.lastTrick ? plays(h.lastTrick) : null,
    tricksWon: spread(h.tricksWon, 0),
    myTricks: playing ? h.won[local]! : [],
    points: match.settings.showPoints ? spread(h.points, 0) : null,
    declaration: h.declaration ? { ...h.declaration, by: toTable(h.declaration.by) } : null,
    kontra: tableSeat(h.kontra),
    lastMeld: h.lastMeld ? { ...h.lastMeld, seat: toTable(h.lastMeld.seat) } : null,
    claimAvailable: playing && h.phase === 'play' && h.claimWindow === local && h.declaration?.kind !== 'durko',
    legalMoves: playing ? legalMoves(h, local).map((m) => ({ ...m, seat })) : [],
    result: h.result,
    finalPoints: ended ? spread(h.points, 0) : null,
    revealed: ended ? { hands: spread(h.hands, [] as Card[]), sides: spread(h.sides, -1) } : null,
  };
  return {
    settings: match.settings,
    scores: match.scores,
    dealer: match.dealer,
    handNumber: match.handNumber,
    out: match.out,
    lastOut: match.lastOut,
    over: match.over,
    ranking: match.ranking,
    hand,
  };
}
