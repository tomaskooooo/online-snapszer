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
      return `play:${m.seat}:${cardId(m.card)}:${m.meld ? 1 : 0}`;
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
    stock: [],
    trumpSuit: null,
    trumpCard: null,
    calledCard: null,
    covered: null,
    sides: [],
    declaration: null,
    declareQueue: [],
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
  if (h.mode === '1v1') return [0, 1];
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

export function startHand(mode: Mode, dealer: number, rng: Rng): HandState {
  const h = createBareHand(mode, dealer);
  const deck = shuffle(makeDeck(mode), rng);
  const order = seatOrder(h.leader, h.n);
  const deal = (count: number) => {
    for (const s of order) for (let i = 0; i < count; i++) h.hands[s]!.push(deck.shift()!);
  };

  if (mode === '1v1') {
    deal(3);
    const trump = deck.shift()!;
    deal(2);
    h.trumpCard = trump;
    h.trumpSuit = trump.suit;
    h.stock = [...deck, trump];
    h.phase = 'declare';
    h.declareQueue = [h.leader, dealer];
    h.turn = h.leader;
  } else {
    deal(mode === '2v1' ? 4 : 3);
    h.undealt = deck;
    h.phase = mode === '2v1' ? 'callTrump' : 'callCard';
    h.turn = h.caller;
  }
  return h;
}

function dealSecondRound(h: HandState): void {
  const per = h.mode === '2v1' ? 4 : 3;
  for (const s of seatOrder(h.caller, h.n)) {
    for (let i = 0; i < per; i++) h.hands[s]!.push(h.undealt.shift()!);
  }
  h.sides = computeSides(h);
  h.phase = 'declare';
  h.declareQueue = [h.caller];
  h.turn = h.caller;
}

// ---------------------------------------------------------------------------
// Trick rules
// ---------------------------------------------------------------------------

const isStrict = (h: HandState): boolean =>
  h.mode !== '1v1' || h.covered !== null || h.stock.length === 0;

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
  if (h.trick.length === 0 || !isStrict(h)) return hand;

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
    // The caller (2v1 and 2v2) may give up before a card is played.
    if (h.mode !== '1v1') declares.push({ type: 'forfeit', seat });
    return declares;
  }

  if (h.phase === 'kontra') {
    if (h.kontraQueue[0] !== seat) return [];
    return [
      { type: 'kontra', seat, kontra: true },
      { type: 'kontra', seat, kontra: false },
    ];
  }

  if (h.claimWindow === seat && h.declaration?.kind !== 'durko') {
    moves.push({ type: 'claim', seat });
  }
  if (h.turn !== seat) return moves;

  const hand = h.hands[seat]!;
  if (h.trick.length > 0) {
    for (const card of followableCards(h, seat)) moves.push({ type: 'play', seat, card });
    return moves;
  }

  for (const card of hand) moves.push({ type: 'play', seat, card });

  // A pair (Király + Felső) can be declared on any lead: 20, or 40 in adutt.
  for (const suit of SUITS) {
    const king = hand.find((c) => c.suit === suit && c.rank === 'king');
    const over = hand.find((c) => c.suit === suit && c.rank === 'over');
    if (king && over) {
      moves.push({ type: 'play', seat, card: king, meld: true });
      moves.push({ type: 'play', seat, card: over, meld: true });
    }
  }

  if (h.mode === '1v1') {
    if (h.covered === null && h.stock.length > 0) {
      const hasUnder = hand.some((c) => c.suit === h.trumpSuit && c.rank === 'under');
      if (hasUnder && h.stock.length >= 3) moves.push({ type: 'swapTrump', seat });
      moves.push({ type: 'cover', seat });
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
  for (const side of [0, 1]) {
    if (h.tricksPlayed > 0 && sideStats(h, side).tricks === h.tricksPlayed) {
      const durko = h.declaration?.kind === 'durko' && h.declaration.side === side;
      endHand(h, { winnerSide: side, amount: durko ? 32 : 22, reason: durko ? 'durkoWon' : 'allTricks' });
      return;
    }
  }
  if (h.covered !== null) {
    const loser = h.sides[h.covered]!;
    endHand(h, tableResult(h, 1 - loser, loser, 'coverFailed'));
    return;
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

  if (h.mode === '1v1' && h.covered === null && h.stock.length > 0) {
    h.hands[winner]!.push(h.stock.shift()!);
    h.hands[1 - winner]!.push(h.stock.shift()!);
    if (h.stock.length === 0) h.trumpCard = null;
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
      } else if (h.mode === '1v1') {
        h.phase = 'play';
        h.turn = h.leader;
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

    case 'swapTrump': {
      const hand = h.hands[seat]!;
      const idx = hand.findIndex((c) => c.suit === h.trumpSuit && c.rank === 'under');
      const under = hand[idx]!;
      hand[idx] = h.trumpCard!;
      h.stock[h.stock.length - 1] = under;
      h.trumpCard = under;
      break;
    }

    case 'cover':
      h.covered = seat;
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
      break;
    }
  }
  return h;
}

// ---------------------------------------------------------------------------
// Match
// ---------------------------------------------------------------------------

export function newMatch(settings: Settings, rng: Rng, firstDealer = 0): MatchState {
  const n = playerCount(settings.mode);
  return {
    settings,
    scores: Array.from({ length: n }, () => settings.startScore),
    dealer: firstDealer,
    handNumber: 1,
    hand: startHand(settings.mode, firstDealer, rng),
    winners: null,
  };
}

export function applyMatchMove(match: MatchState, move: Move): MatchState {
  if (match.winners) throw new Error('Match is over');
  const hand = applyMove(match.hand, move);
  const next: MatchState = { ...match, hand };
  if (hand.phase === 'ended' && match.hand.phase !== 'ended') {
    const r = hand.result!;
    next.scores = match.scores.map((score, seat) => (hand.sides[seat] === r.winnerSide ? score - r.amount : score));
    const winners = next.scores.flatMap((s, seat) => (s <= 0 ? [seat] : []));
    next.winners = winners.length > 0 ? winners : null;
  }
  return next;
}

export function nextHand(match: MatchState, rng: Rng): MatchState {
  if (match.winners) throw new Error('Match is over');
  if (match.hand.phase !== 'ended') throw new Error('Hand is still running');
  const dealer = (match.dealer + 1) % match.hand.n;
  return {
    ...match,
    dealer,
    handNumber: match.handNumber + 1,
    hand: startHand(match.settings.mode, dealer, rng),
  };
}
