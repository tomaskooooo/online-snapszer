import {
  cardId,
  cardPoints,
  makeDeck,
  rankIndex,
  sameCard,
  shuffle,
  type Rng,
} from './cards';
import {
  SUITS,
  type Card,
  type HandResult,
  type HandState,
  type MatchState,
  type Mode,
  type Move,
  type Play,
  type Settings,
  type Suit,
} from './types';

export const playerCount = (mode: Mode): number => (mode === '1v1' ? 2 : mode === '2v1' ? 3 : 4);

const seatOrder = (start: number, n: number): number[] =>
  Array.from({ length: n }, (_, i) => (start + i) % n);

export function moveKey(m: Move): string {
  switch (m.type) {
    case 'callTrump':
      return `callTrump:${m.seat}:${m.suit}`;
    case 'callCard':
      return `callCard:${m.seat}:${cardId(m.card)}`;
    case 'declare':
      return `declare:${m.seat}:${m.kind}`;
    case 'play':
      return `play:${m.seat}:${cardId(m.card)}:${m.meld ? 1 : 0}${m.enough ? 'e' : ''}`;
    case 'kontra':
      return `kontra:${m.seat}:${m.kontra ? 1 : 0}`;
    default:
      return `${m.type}:${m.seat}`;
  }
}

/** Empty hand state in the play phase. startHand and the tests build on it. */
export function createBareHand(mode: Mode, dealer: number): HandState {
  const n = playerCount(mode);
  const leader = (dealer + 1) % n;
  const zeros = () => Array.from({ length: n }, () => 0);
  const h: HandState = {
    mode,
    n,
    dealer,
    leader,
    caller: leader,
    phase: 'play',
    hands: Array.from({ length: n }, () => []),
    undealt: [],
    trumpSuit: null,
    calledCard: null,
    sides: [],
    declaration: null,
    declareQueue: [],
    special: null,
    kontra: null,
    kontraQueue: [],
    turn: leader,
    trick: [],
    won: Array.from({ length: n }, () => []),
    tricksWon: zeros(),
    points: zeros(),
    pendingMeld: zeros(),
    tricksPlayed: 0,
    claimWindow: null,
    lastTrickWinner: null,
    lastTrick: null,
    lastMeld: null,
    result: null,
  };
  h.sides = computeSides(h);
  return h;
}

function computeSides(h: HandState): number[] {
  const sides = Array.from({ length: h.n }, () => 1);
  sides[h.caller] = 0;
  if (h.mode === '2v2' && h.calledCard) {
    const called = h.calledCard;
    h.hands.forEach((hand, seat) => {
      if (hand.some((c) => sameCard(c, called))) sides[seat] = 0;
    });
  }
  return sides;
}

export function startHand(mode: Mode, dealer: number, rng: Rng, special = false): HandState {
  const h = createBareHand(mode, dealer);
  const deck = shuffle(makeDeck(mode), rng);
  const order = seatOrder(h.leader, h.n);
  const deal = (count: number) => {
    for (const s of order) for (let i = 0; i < count; i++) h.hands[s]!.push(deck.shift()!);
  };

  // The deciding round: no adutt, no declarations, everybody just plays eight cards.
  if (special) {
    deal(8);
    h.undealt = deck;
    h.special = 'decider';
    h.sides = computeSides(h);
    h.phase = 'play';
    h.turn = h.leader;
    return h;
  }

  // Every mode is dealt in two rounds. In 1v1 and 2v1 the caller names the adutt after the
  // first four cards; in 2v2 the caller names a card after three. Unused cards stay face down.
  deal(mode === '2v2' ? 3 : 4);
  h.undealt = deck;
  h.phase = mode === '2v2' ? 'callCard' : 'callTrump';
  h.turn = h.caller;
  return h;
}

function dealSecondRound(h: HandState): void {
  const per = h.mode === '2v2' ? 3 : 4;
  for (const s of seatOrder(h.caller, h.n)) {
    for (let i = 0; i < per; i++) h.hands[s]!.push(h.undealt.shift()!);
  }
  h.sides = computeSides(h);
  h.phase = 'declare';
  h.declareQueue = [h.caller];
  h.turn = h.caller;
}

/** True once the called card has been played, which reveals the teams in 2v2. */
export function calledCardOut(h: HandState): boolean {
  const called = h.calledCard;
  if (!called) return true;
  return h.won.some((pile) => pile.some((c) => sameCard(c, called))) || h.trick.some((p) => sameCard(p.card, called));
}

/** "Elég!" may be said: never in the deciding round, and in 2v2 not before the called card is out. */
export function claimsOpen(h: HandState): boolean {
  return !h.special && (h.mode !== '2v2' || calledCardOut(h));
}

// ---------------------------------------------------------------------------
// Trick rules
// ---------------------------------------------------------------------------

export function currentWinner(plays: Play[], trump: Suit | null): Play {
  let best = plays[0]!;
  for (const p of plays.slice(1)) {
    const b = best.card;
    const c = p.card;
    if (c.suit === b.suit) {
      if (rankIndex(c) > rankIndex(b)) best = p;
    } else if (c.suit === trump) {
      best = p;
    }
  }
  return best;
}

/** Cards the seat may play when following a lead. */
export function followableCards(h: HandState, seat: number): Card[] {
  const hand = h.hands[seat]!;
  if (h.trick.length === 0) return hand;

  const led = h.trick[0]!.card.suit;
  const winning = currentWinner(h.trick, h.trumpSuit).card;

  const sameSuit = hand.filter((c) => c.suit === led);
  if (sameSuit.length > 0) {
    if (winning.suit === led) {
      const higher = sameSuit.filter((c) => rankIndex(c) > rankIndex(winning));
      return higher.length > 0 ? higher : sameSuit;
    }
    return sameSuit;
  }

  const trumps = hand.filter((c) => c.suit === h.trumpSuit);
  if (trumps.length > 0) {
    if (winning.suit === h.trumpSuit) {
      const higher = trumps.filter((c) => rankIndex(c) > rankIndex(winning));
      return higher.length > 0 ? higher : trumps;
    }
    return trumps;
  }
  return hand;
}

// ---------------------------------------------------------------------------
// Legal moves
// ---------------------------------------------------------------------------

export function legalMoves(h: HandState, seat: number): Move[] {
  if (h.phase === 'ended' || seat < 0 || seat >= h.n) return [];
  const moves: Move[] = [];

  if (h.phase === 'callTrump') {
    if (seat !== h.caller) return [];
    const suits = new Set(h.hands[seat]!.map((c) => c.suit));
    for (const suit of SUITS) if (suits.has(suit)) moves.push({ type: 'callTrump', seat, suit });
    moves.push({ type: 'forfeit', seat });
    return moves;
  }

  if (h.phase === 'callCard') {
    if (seat !== h.caller) return [];
    for (const card of makeDeck(h.mode)) moves.push({ type: 'callCard', seat, card });
    moves.push({ type: 'forfeit', seat });
    return moves;
  }

  if (h.phase === 'declare') {
    if (h.declareQueue[0] !== seat) return [];
    const declares: Move[] = [
      { type: 'declare', seat, kind: 'snapszer' },
      { type: 'declare', seat, kind: 'durko' },
      { type: 'declare', seat, kind: 'none' },
    ];
    // The caller may give up before a card is played.
    declares.push({ type: 'forfeit', seat });
    return declares;
  }

  if (h.phase === 'kontra') {
    if (h.kontraQueue[0] !== seat) return [];
    // The caller's own partner is asked like everybody else (so nobody can tell who it is),
    // but he may only play.
    if (h.sides[seat] === h.sides[h.caller]) return [{ type: 'kontra', seat, kontra: false }];
    return [
      { type: 'kontra', seat, kontra: true },
      { type: 'kontra', seat, kontra: false },
    ];
  }

  const mayClaim = claimsOpen(h);
  if (mayClaim && h.claimWindow === seat && h.declaration?.kind !== 'durko') {
    moves.push({ type: 'claim', seat });
  }
  if (h.turn !== seat) return moves;

  const hand = h.hands[seat]!;
  if (h.trick.length > 0) {
    for (const card of followableCards(h, seat)) moves.push({ type: 'play', seat, card });
    return moves;
  }

  for (const card of hand) moves.push({ type: 'play', seat, card });

  // A pair (Király + Felső) can be declared on any lead: 20, or 40 in adutt. Not in the deciding round.
  for (const suit of h.special ? [] : SUITS) {
    const king = hand.find((c) => c.suit === suit && c.rank === 'king');
    const over = hand.find((c) => c.suit === suit && c.rank === 'over');
    if (king && over) {
      for (const card of [king, over]) {
        moves.push({ type: 'play', seat, card, meld: true });
        // "Elég!": declare the pair and claim 66 in the same breath.
        if (mayClaim && h.declaration?.kind !== 'durko') moves.push({ type: 'play', seat, card, meld: true, enough: true });
      }
    }
  }

  return moves;
}

// ---------------------------------------------------------------------------
// Applying moves
// ---------------------------------------------------------------------------

export function sideStats(h: HandState, side: number): { points: number; tricks: number } {
  let points = 0;
  let tricks = 0;
  h.sides.forEach((s, seat) => {
    if (s === side) {
      points += h.points[seat]!;
      tricks += h.tricksWon[seat]!;
    }
  });
  return { points, tricks };
}

/** 2 / 4 / 6 table, by what the losing side collected. */
export function tableAmount(loserPoints: number, loserTricks: number): number {
  if (loserPoints >= 33) return 2;
  return loserTricks > 0 ? 4 : 6;
}

type PlainResult = Omit<HandResult, 'kontra'>;

function endHand(h: HandState, result: PlainResult): void {
  const doubled = h.kontra !== null;
  h.phase = 'ended';
  h.result = { ...result, amount: result.amount * (doubled ? 2 : 1), kontra: doubled };
  h.claimWindow = null;
}

function tableResult(h: HandState, winnerSide: number, loserSide: number, reason: HandResult['reason']): PlainResult {
  const loser = sideStats(h, loserSide);
  return { winnerSide, amount: tableAmount(loser.points, loser.tricks), reason };
}

function resolveClaim(h: HandState, seat: number): void {
  const side = h.sides[seat]!;
  const other = 1 - side;
  const mine = sideStats(h, side);
  const decl = h.declaration;
  const ownSnapszer = decl?.kind === 'snapszer' && decl.side === side;

  if (mine.points >= 66) {
    if (ownSnapszer) endHand(h, { winnerSide: side, amount: 12, reason: 'snapszerWon' });
    else endHand(h, tableResult(h, side, other, 'claim'));
  } else if (ownSnapszer) {
    endHand(h, { winnerSide: other, amount: 12, reason: 'snapszerFailed' });
  } else {
    endHand(h, tableResult(h, other, side, 'falseClaim'));
  }
}

function finishPlayedOut(h: HandState): void {
  if (h.special) {
    endHand(h, { winnerSide: h.sides[h.lastTrickWinner!]!, amount: 0, reason: 'decider' });
    return;
  }
  for (const side of [0, 1]) {
    if (h.tricksPlayed > 0 && sideStats(h, side).tricks === h.tricksPlayed) {
      const durko = h.declaration?.kind === 'durko' && h.declaration.side === side;
      endHand(h, { winnerSide: side, amount: durko ? 32 : 22, reason: durko ? 'durkoWon' : 'allTricks' });
      return;
    }
  }
  const winnerSide = h.sides[h.lastTrickWinner!]!;
  endHand(h, tableResult(h, winnerSide, 1 - winnerSide, 'lastTrick'));
}

function resolveTrick(h: HandState): void {
  const win = currentWinner(h.trick, h.trumpSuit);
  const winner = win.seat;
  const cards = h.trick.map((p) => p.card);

  h.won[winner]!.push(...cards);
  h.tricksWon[winner]!++;
  h.points[winner]! += cards.reduce((sum, c) => sum + cardPoints(c), 0);
  if (h.pendingMeld[winner]! > 0) {
    h.points[winner]! += h.pendingMeld[winner]!;
    h.pendingMeld[winner] = 0;
  }
  h.tricksPlayed++;
  h.lastTrick = h.trick;
  h.lastTrickWinner = winner;
  h.trick = [];

  const decl = h.declaration;
  if (decl && h.sides[winner] !== decl.side) {
    const durko = decl.kind === 'durko';
    endHand(h, {
      winnerSide: h.sides[winner]!,
      amount: durko ? 32 : 12,
      reason: durko ? 'durkoFailed' : 'snapszerFailed',
    });
    return;
  }

  if (h.hands.every((hand) => hand.length === 0)) {
    finishPlayedOut(h);
    return;
  }
  h.turn = winner;
  h.claimWindow = winner;
}

export function applyMove(prev: HandState, move: Move): HandState {
  const legal = legalMoves(prev, move.seat);
  if (!legal.some((m) => moveKey(m) === moveKey(move))) {
    throw new Error(`Illegal move: ${moveKey(move)}`);
  }
  const h = structuredClone(prev);
  const seat = move.seat;
  h.claimWindow = null;

  switch (move.type) {
    case 'callTrump':
      h.trumpSuit = move.suit;
      dealSecondRound(h);
      break;

    case 'callCard':
      h.calledCard = move.card;
      h.trumpSuit = move.card.suit;
      dealSecondRound(h);
      break;

    case 'declare':
      h.declareQueue.shift();
      if (move.kind !== 'none') {
        h.declaration = { kind: move.kind, side: h.sides[seat]!, by: seat };
        h.declareQueue = [];
      }
      if (h.declareQueue.length > 0) {
        h.turn = h.declareQueue[0]!;
      } else {
        // Everyone except the caller may now answer with a kontra.
        h.phase = 'kontra';
        h.kontraQueue = Array.from({ length: h.n - 1 }, (_, i) => (h.caller + 1 + i) % h.n);
        h.turn = h.kontraQueue[0]!;
      }
      break;

    case 'kontra':
      h.kontraQueue.shift();
      if (move.kontra) {
        h.kontra = seat;
        h.kontraQueue = [];
      }
      if (h.kontraQueue.length === 0) {
        h.phase = 'play';
        h.turn = h.leader;
      } else {
        h.turn = h.kontraQueue[0]!;
      }
      break;

    case 'forfeit':
      // Everybody else goes down, partner or not.
      h.sides = Array.from({ length: h.n }, (_, s) => (s === h.caller ? 0 : 1));
      endHand(h, { winnerSide: 1, amount: 6, reason: 'forfeit' });
      break;

    case 'claim':
      resolveClaim(h, seat);
      break;

    case 'play': {
      const hand = h.hands[seat]!;
      hand.splice(hand.findIndex((c) => sameCard(c, move.card)), 1);
      h.trick.push({ seat, card: move.card });
      if (move.meld) {
        const points = move.card.suit === h.trumpSuit ? 40 : 20;
        h.lastMeld = { seat, suit: move.card.suit, points, trick: h.tricksPlayed };
        if (h.tricksWon[seat]! > 0) h.points[seat]! += points;
        else h.pendingMeld[seat]! += points;
        h.claimWindow = seat;
      }
      if (h.trick.length === h.n) resolveTrick(h);
      else h.turn = (seat + 1) % h.n;
      if (move.enough && h.phase !== 'ended') resolveClaim(h, seat);
      break;
    }
  }
  return h;
}

// ---------------------------------------------------------------------------
// Match
// ---------------------------------------------------------------------------

/** The game mode for a number of players still at the table. */
export const modeForPlayers = (count: number): Mode => (count <= 2 ? '1v1' : count === 3 ? '2v1' : '2v2');

export function newMatch(settings: Settings, rng: Rng, firstDealer = 0): MatchState {
  const n = playerCount(settings.mode);
  return {
    settings,
    scores: Array.from({ length: n }, () => settings.startScore),
    dealer: firstDealer,
    handNumber: 1,
    hand: startHand(settings.mode, firstDealer, rng),
    seats: Array.from({ length: n }, (_, i) => i),
    out: [],
    lastOut: [],
    over: false,
    ranking: null,
  };
}

/**
 * Applies a move made by a table seat. When a hand ends, the winners go down; anybody
 * who reaches zero leaves, and the rest play on with fewer players (4 -> 3 -> 2).
 * The match is over when only one player is left, and that player comes last.
 */
export function applyMatchMove(match: MatchState, move: Move): MatchState {
  if (match.over) throw new Error('Match is over');
  const local = match.seats.indexOf(move.seat);
  if (local < 0) throw new Error('That player is no longer in the game');
  const hand = applyMove(match.hand, { ...move, seat: local });
  const next: MatchState = { ...match, hand };
  if (hand.phase === 'ended' && match.hand.phase !== 'ended' && hand.special) {
    // The player who took the last trick finishes ahead of the other one.
    const winner = match.seats[hand.lastTrickWinner!]!;
    const loser = match.seats.find((s) => s !== winner)!;
    next.lastOut = [winner];
    next.out = [...match.out, winner];
    next.over = true;
    next.ranking = [...next.out, loser];
  } else if (hand.phase === 'ended' && match.hand.phase !== 'ended') {
    const r = hand.result!;
    next.scores = match.scores.map((score, seat) => {
      const i = match.seats.indexOf(seat);
      return i >= 0 && hand.sides[i] === r.winnerSide ? score - r.amount : score;
    });
    // Whoever is at zero or below leaves; the lowest score leaves first.
    const leaving = match.seats.filter((seat) => next.scores[seat]! <= 0).sort((a, b) => next.scores[a]! - next.scores[b]!);
    next.lastOut = leaving;
    next.out = [...match.out, ...leaving];
    const staying = match.seats.filter((seat) => !leaving.includes(seat));
    if (staying.length <= 1) {
      next.over = true;
      next.ranking = [...next.out, ...staying];
    }
  }
  return next;
}

export function nextHand(match: MatchState, rng: Rng): MatchState {
  if (match.over) throw new Error('Match is over');
  if (match.hand.phase !== 'ended') throw new Error('Hand is still running');
  const seats = match.seats.filter((seat) => !match.out.includes(seat));
  // The deal moves to the next player still at the table.
  const total = match.scores.length;
  let dealer = (match.dealer + 1) % total;
  while (!seats.includes(dealer)) dealer = (dealer + 1) % total;
  // Two players left after a bigger game, both with more than 10 points to go: one round
  // without adutt decides it, instead of grinding down the rest of the points.
  const decider = match.settings.mode !== '1v1' && seats.length === 2 && seats.every((s) => match.scores[s]! > 10);
  return {
    ...match,
    dealer,
    seats,
    lastOut: [],
    handNumber: match.handNumber + 1,
    hand: startHand(modeForPlayers(seats.length), seats.indexOf(dealer), rng, decider),
  };
}
