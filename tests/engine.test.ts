import { describe, expect, it } from 'vitest';
import {
  applyMatchMove,
  applyMove,
  cardId,
  currentWinner,
  legalMoves,
  mulberry32,
  newMatch,
  nextHand,
  startHand,
  tableAmount,
  viewFor,
  type HandState,
  type MatchState,
} from '../src';
import { c, checkConservation, hasMove, play, playableCodes, scenario } from './helpers';

describe('dealing', () => {
  it('1v1: 4 cards, the caller names the adutt, then 4 more, and 4 cards stay face down', () => {
    const h = startHand('1v1', 0, mulberry32(1));
    expect(h.hands.map((x) => x.length)).toEqual([4, 4]);
    expect(h.undealt).toHaveLength(12);
    expect(h.leader).toBe(1); // the non-dealer is the caller and leads
    expect(h.caller).toBe(1);
    expect(h.phase).toBe('callTrump');
    expect(legalMoves(h, 0)).toEqual([]);

    const suit = h.hands[1]![0]!.suit;
    const after = applyMove(h, { type: 'callTrump', seat: 1, suit });
    expect(after.trumpSuit).toBe(suit);
    expect(after.hands.map((x) => x.length)).toEqual([8, 8]);
    expect(after.undealt).toHaveLength(4);
    expect(after.sides).toEqual([1, 0]);
    expect(after.phase).toBe('declare');
    checkConservation(after);
  });

  it('2v1: 4 cards, the caller names the adu from them, then 4 more', () => {
    const h = startHand('2v1', 2, mulberry32(2));
    expect(h.caller).toBe(0);
    expect(h.phase).toBe('callTrump');
    expect(h.hands.map((x) => x.length)).toEqual([4, 4, 4]);
    expect(h.undealt).toHaveLength(12);

    // Only suits the caller really holds may be named.
    const held = new Set(h.hands[0]!.map((x) => x.suit));
    const offered = legalMoves(h, 0).flatMap((m) => (m.type === 'callTrump' ? [m.suit] : []));
    expect(new Set(offered)).toEqual(held);
    expect(legalMoves(h, 1)).toEqual([]);

    const suit = h.hands[0]![0]!.suit;
    const after = applyMove(h, { type: 'callTrump', seat: 0, suit });
    expect(after.trumpSuit).toBe(suit);
    expect(after.hands.map((x) => x.length)).toEqual([8, 8, 8]);
    expect(after.undealt).toHaveLength(0);
    expect(after.phase).toBe('declare');
    expect(after.declareQueue).toEqual([0]);
    expect(after.sides).toEqual([0, 1, 1]);
    checkConservation(after);
  });

  it('2v2: 3 cards, the caller names a card, whose suit is the adu, then 3 more', () => {
    const h = startHand('2v2', 3, mulberry32(3));
    expect(h.caller).toBe(0);
    expect(h.phase).toBe('callCard');
    expect(h.hands.map((x) => x.length)).toEqual([3, 3, 3, 3]);
    expect(legalMoves(h, 0).filter((m) => m.type === 'callCard')).toHaveLength(24);

    const after = applyMove(h, { type: 'callCard', seat: 0, card: c('Az') });
    expect(after.trumpSuit).toBe('zold');
    expect(after.hands.map((x) => x.length)).toEqual([6, 6, 6, 6]);
    checkConservation(after);
  });

  it('2v2: the holder of the called card is the caller\'s partner', () => {
    const h = startHand('2v2', 3, mulberry32(4));
    for (const card of [c('At'), c('Kz'), c('9m'), c('Up')]) {
      const after = applyMove(h, { type: 'callCard', seat: 0, card });
      const holder = after.hands.findIndex((hand) => hand.some((x) => cardId(x) === cardId(card)));
      const side0 = after.sides.flatMap((s, seat) => (s === 0 ? [seat] : []));
      expect(side0).toContain(0);
      expect(side0).toContain(holder);
      expect(side0.length).toBe(holder === 0 ? 1 : 2);
    }
  });

  it('2v2: calling a card you hold yourself puts the caller alone against three', () => {
    const h = startHand('2v2', 3, mulberry32(5));
    const own = h.hands[0]![0]!;
    const after = applyMove(h, { type: 'callCard', seat: 0, card: own });
    expect(after.sides).toEqual([0, 1, 1, 1]);
  });
});

describe('declarations', () => {
  it('only the caller declares in 2v1, then the others answer kontra or play, then the caller leads', () => {
    let h = startHand('2v1', 2, mulberry32(6));
    h = applyMove(h, { type: 'callTrump', seat: 0, suit: h.hands[0]![0]!.suit });
    expect(legalMoves(h, 1)).toEqual([]);
    h = applyMove(h, { type: 'declare', seat: 0, kind: 'none' });
    expect(h.phase).toBe('kontra');
    expect(h.turn).toBe(1);
    expect(legalMoves(h, 0)).toEqual([]);
    expect(legalMoves(h, 2)).toEqual([]);
    h = applyMove(h, { type: 'kontra', seat: 1, kontra: false });
    expect(h.turn).toBe(2);
    h = applyMove(h, { type: 'kontra', seat: 2, kontra: false });
    expect(h.phase).toBe('play');
    expect(h.turn).toBe(0);
    expect(h.kontra).toBeNull();
  });

  it('1v1 works like 2v1: the caller declares, the other player answers kontra or play', () => {
    let h = startHand('1v1', 0, mulberry32(7));
    h = applyMove(h, { type: 'callTrump', seat: 1, suit: h.hands[1]![0]!.suit });
    expect(legalMoves(h, 0)).toEqual([]);
    expect(hasMove(h, 1, { type: 'forfeit', seat: 1 })).toBe(true);
    h = applyMove(h, { type: 'declare', seat: 1, kind: 'none' });
    expect(h.phase).toBe('kontra');
    expect(h.turn).toBe(0);
    h = applyMove(h, { type: 'kontra', seat: 0, kontra: true });
    expect(h.phase).toBe('play');
    expect(h.kontra).toBe(0);
    expect(h.turn).toBe(1);
  });

  it('a kontra by one opponent ends the question and doubles what the hand is worth', () => {
    let h = startHand('2v2', 3, mulberry32(8));
    h = applyMove(h, { type: 'callCard', seat: 0, card: c('Az') });
    h = applyMove(h, { type: 'declare', seat: 0, kind: 'none' });
    expect(h.kontraQueue).toEqual([1, 2, 3]);
    h = applyMove(h, { type: 'kontra', seat: 1, kontra: false });
    h = applyMove(h, { type: 'kontra', seat: 2, kontra: true });
    expect(h.phase).toBe('play');
    expect(h.kontra).toBe(2);
    expect(legalMoves(h, 3)).not.toContainEqual({ type: 'kontra', seat: 3, kontra: true });

    // Same table as always, then doubled: opponents under 33 with a trick are worth 4, so 8.
    h.hands = [['9m'], ['9p'], ['9z'], ['Um']].map((codes) => codes.map(c));
    h.sides = [0, 1, 1, 0];
    h.tricksWon = [0, 1, 0, 0];
    h.tricksPlayed = 1;
    h.points = [0, 5, 0, 0];
    h.turn = 0;
    h.trumpSuit = 'tok';
    h = play(play(play(play(h, 0, '9m'), 1, '9p'), 2, '9z'), 3, 'Um');
    expect(h.result).toMatchObject({ kontra: true, amount: 8, reason: 'lastTrick' });
  });

  it('the caller can forfeit before playing: everybody else goes down 6', () => {
    let h = startHand('2v2', 3, mulberry32(9));
    expect(hasMove(h, 0, { type: 'forfeit', seat: 0 })).toBe(true);
    expect(hasMove(h, 1, { type: 'forfeit', seat: 1 })).toBe(false);
    h = applyMove(h, { type: 'callCard', seat: 0, card: c('At') });
    expect(hasMove(h, 0, { type: 'forfeit', seat: 0 })).toBe(true);
    h = applyMove(h, { type: 'forfeit', seat: 0 });
    expect(h.phase).toBe('ended');
    expect(h.result).toEqual({ winnerSide: 1, amount: 6, reason: 'forfeit', kontra: false });
    expect(h.sides).toEqual([0, 1, 1, 1]);
  });

  it('forfeiting is possible in every step before play, but not during play or after a kontra step', () => {
    let h = startHand('2v1', 2, mulberry32(10));
    expect(hasMove(h, 0, { type: 'forfeit', seat: 0 })).toBe(true); // choosing the adutt
    h = applyMove(h, { type: 'callTrump', seat: 0, suit: h.hands[0]![0]!.suit });
    expect(hasMove(h, 0, { type: 'forfeit', seat: 0 })).toBe(true); // declaring
    h = applyMove(h, { type: 'declare', seat: 0, kind: 'none' });
    expect(hasMove(h, 0, { type: 'forfeit', seat: 0 })).toBe(false);
    h = applyMove(applyMove(h, { type: 'kontra', seat: 1, kontra: false }), { type: 'kontra', seat: 2, kontra: false });
    expect(legalMoves(h, 0).some((m) => m.type === 'forfeit')).toBe(false);
  });

});

describe('strict play', () => {
  const base = (hand: string, trick: [number, string][]): HandState => {
    const h = scenario({ mode: '2v1', hands: ['9m', hand, 'Am'], trump: 'tok' });
    h.trick = trick.map(([seat, code]) => ({ seat, card: c(code) }));
    h.turn = trick.length;
    return h;
  };

  it('must beat the led suit when possible', () => {
    const h = base('Tp 9p Ap Ut', [[0, 'Kp']]);
    expect(playableCodes(h, 1)).toEqual(['piros-ace', 'piros-ten']);
  });

  it('must still follow suit when it cannot beat', () => {
    const h = base('9p Up Az', [[0, 'Ap']]);
    expect(playableCodes(h, 1)).toEqual(['piros-nine', 'piros-under']);
  });

  it('must play adu when it has no card of the led suit', () => {
    const h = base('At 9t Az', [[0, 'Kp']]);
    expect(playableCodes(h, 1)).toEqual(['tok-ace', 'tok-nine']);
  });

  it('may play anything with neither the suit nor adu', () => {
    const h = base('Az 9m', [[0, 'Kp']]);
    expect(playableCodes(h, 1)).toEqual(['makk-nine', 'zold-ace']);
  });

  it('must beat an adu that is already winning the trick', () => {
    const h = scenario({ mode: '2v1', hands: ['9m', 'Am', 'Ut Tt Zz'], trump: 'tok' });
    h.trick = [
      { seat: 0, card: c('Kp') },
      { seat: 1, card: c('9t') },
    ];
    h.turn = 2;
    expect(playableCodes(h, 2)).toEqual(['tok-ten', 'tok-under']);
  });

  it('plays any adu when none beats the winning adu', () => {
    const h = scenario({ mode: '2v1', hands: ['9m', 'Am', 'Ut 9t Zz'], trump: 'tok' });
    h.trick = [
      { seat: 0, card: c('Kp') },
      { seat: 1, card: c('Tt') },
    ];
    h.turn = 2;
    expect(playableCodes(h, 2)).toEqual(['tok-nine', 'tok-under']);
  });

  it('with the led suit it need not beat an adu that cut the trick', () => {
    const h = scenario({ mode: '2v1', hands: ['9m', 'Am', 'Ap Uz'], trump: 'tok' });
    h.trick = [
      { seat: 0, card: c('Kp') },
      { seat: 1, card: c('9t') },
    ];
    h.turn = 2;
    expect(playableCodes(h, 2)).toEqual(['piros-ace']);
  });

  it('when adu is led, follow adu and beat it if possible', () => {
    const h = base('At Kt 9z', [[0, 'Ut']]);
    expect(playableCodes(h, 1)).toEqual(['tok-ace', 'tok-king']);
  });

  it('the trick goes to the highest adu, else the highest card of the led suit', () => {
    const win = (plays: [number, string][]) =>
      currentWinner(plays.map(([seat, code]) => ({ seat, card: c(code) })), 'tok').seat;
    expect(win([[0, 'Ap'], [1, '9t'], [2, 'Tp']])).toBe(1);
    expect(win([[0, 'Kp'], [1, 'Az'], [2, 'Tp']])).toBe(2);
    expect(win([[0, 'Kp'], [1, '9t'], [2, 'Ut']])).toBe(2);
    expect(win([[0, 'Tp'], [1, 'Kp'], [2, 'Ap']])).toBe(2);
  });

  it('rejects a card the rules do not allow', () => {
    const h = base('Tp 9p Ap Ut', [[0, 'Kp']]);
    expect(() => play(h, 1, '9p')).toThrow(/Illegal/);
    expect(() => play(h, 2, 'Am')).toThrow(/Illegal/); // not their turn
  });
});

describe('scoring table', () => {
  it('2 / 4 / 6 by what the loser collected', () => {
    expect(tableAmount(33, 0)).toBe(2);
    expect(tableAmount(60, 5)).toBe(2);
    expect(tableAmount(32, 1)).toBe(4);
    expect(tableAmount(0, 1)).toBe(4);
    expect(tableAmount(0, 0)).toBe(6);
  });
});

describe('"Kész!" claims', () => {
  const claimScenario = (points: number[], tricks: number[]) => {
    const h = scenario({ mode: '2v1', hands: ['9m 9p', '9z 9t', 'Um Uz'], trump: 'tok' });
    h.points = points;
    h.tricksWon = tricks;
    h.tricksPlayed = tricks.reduce((a, b) => a + b, 0);
    h.claimWindow = 0;
    return h;
  };

  it('a correct claim wins and scores by the loser side', () => {
    const h = applyMove(claimScenario([70, 0, 0], [3, 0, 0]), { type: 'claim', seat: 0 });
    expect(h.result).toEqual({ winnerSide: 0, amount: 6, reason: 'claim', kontra: false });
    expect(h.phase).toBe('ended');
  });

  it('pools the two opponents in 2v1', () => {
    const h = applyMove(claimScenario([70, 20, 15], [3, 1, 1]), { type: 'claim', seat: 0 });
    expect(h.result).toMatchObject({ winnerSide: 0, amount: 2 });
    const h2 = applyMove(claimScenario([70, 20, 10], [3, 1, 1]), { type: 'claim', seat: 0 });
    expect(h2.result).toMatchObject({ winnerSide: 0, amount: 4 });
  });

  it('a false claim gives the hand to the other side, scored by the claimer\'s points', () => {
    const a = applyMove(claimScenario([50, 0, 0], [3, 0, 0]), { type: 'claim', seat: 0 });
    expect(a.result).toEqual({ winnerSide: 1, amount: 2, reason: 'falseClaim', kontra: false });
    const b = applyMove(claimScenario([20, 0, 0], [1, 0, 0]), { type: 'claim', seat: 0 });
    expect(b.result).toMatchObject({ winnerSide: 1, amount: 4 });
    const d = applyMove(claimScenario([0, 0, 0], [0, 0, 0]), { type: 'claim', seat: 0 });
    expect(d.result).toMatchObject({ winnerSide: 1, amount: 6 });
  });

  it('is only possible right after winning a trick, and not under durkó', () => {
    const h = claimScenario([70, 0, 0], [3, 0, 0]);
    expect(hasMove(h, 0, { type: 'claim', seat: 0 })).toBe(true);
    expect(hasMove(h, 1, { type: 'claim', seat: 1 })).toBe(false);
    const played = play(h, 0, '9m');
    expect(hasMove(played, 0, { type: 'claim', seat: 0 })).toBe(false);
    h.declaration = { kind: 'durko', side: 0, by: 0 };
    expect(hasMove(h, 0, { type: 'claim', seat: 0 })).toBe(false);
  });

  it('winning a trick opens the claim window for the winner', () => {
    let h = scenario({ mode: '2v1', hands: ['Ap 9m', '9p 9z', '9t Uz'], trump: 'tok' });
    h = play(h, 0, 'Ap');
    h = play(h, 1, '9p');
    h = play(h, 2, '9t'); // 2 has no piros but adu: forced
    expect(h.tricksWon).toEqual([0, 0, 1]);
    expect(h.claimWindow).toBe(2);
    expect(h.turn).toBe(2);
  });
});

describe('Snapszer and durkó', () => {
  const twoCards = () => scenario({ mode: '2v1', hands: ['9p 9m', 'Ap Am', 'Tz Uz'], trump: 'tok' });

  it('Snapszer fails immediately when the other side wins a trick: opponents get 12', () => {
    let h = twoCards();
    h.declaration = { kind: 'snapszer', side: 0, by: 0 };
    h = play(h, 0, '9p');
    h = play(h, 1, 'Ap');
    h = play(h, 2, 'Tz');
    expect(h.result).toEqual({ winnerSide: 1, amount: 12, reason: 'snapszerFailed', kontra: false });
  });

  it('durkó fails immediately when the other side wins a trick: opponents get 32', () => {
    let h = twoCards();
    h.declaration = { kind: 'durko', side: 0, by: 0 };
    h = play(h, 0, '9p');
    h = play(h, 1, 'Ap');
    h = play(h, 2, 'Tz');
    expect(h.result).toEqual({ winnerSide: 1, amount: 32, reason: 'durkoFailed', kontra: false });
  });

  it('a Snapszer holder pressing "Kész!" with 66 wins 12', () => {
    const h = twoCards();
    h.declaration = { kind: 'snapszer', side: 0, by: 0 };
    h.points = [70, 0, 0];
    h.tricksWon = [4, 0, 0];
    h.tricksPlayed = 4;
    h.claimWindow = 0;
    expect(applyMove(h, { type: 'claim', seat: 0 }).result).toEqual({ winnerSide: 0, amount: 12, reason: 'snapszerWon', kontra: false });
  });

  it('a Snapszer holder pressing "Kész!" without 66 loses 12', () => {
    const h = twoCards();
    h.declaration = { kind: 'snapszer', side: 0, by: 0 };
    h.points = [40, 0, 0];
    h.tricksWon = [3, 0, 0];
    h.tricksPlayed = 3;
    h.claimWindow = 0;
    expect(applyMove(h, { type: 'claim', seat: 0 }).result).toEqual({ winnerSide: 1, amount: 12, reason: 'snapszerFailed', kontra: false });
  });

  it('winning every trick scores 22, or 32 with durkó declared', () => {
    const oneCard = () => scenario({ mode: '2v1', hands: ['Ap', '9p', '9z'], trump: 'tok' });
    let h = play(play(play(oneCard(), 0, 'Ap'), 1, '9p'), 2, '9z');
    expect(h.result).toEqual({ winnerSide: 0, amount: 22, reason: 'allTricks', kontra: false });

    h = oneCard();
    h.declaration = { kind: 'durko', side: 0, by: 0 };
    h = play(play(play(h, 0, 'Ap'), 1, '9p'), 2, '9z');
    expect(h.result).toEqual({ winnerSide: 0, amount: 32, reason: 'durkoWon', kontra: false });
  });

  it('without a claim the last trick wins, scored by the loser side', () => {
    // Opponents already hold 40 points, the caller side takes the last trick.
    let h = scenario({ mode: '2v1', hands: ['Ap', '9p', '9z'], trump: 'tok' });
    h.tricksWon = [1, 1, 0];
    h.tricksPlayed = 2;
    h.points = [10, 40, 0];
    h = play(play(play(h, 0, 'Ap'), 1, '9p'), 2, '9z');
    expect(h.result).toEqual({ winnerSide: 0, amount: 2, reason: 'lastTrick', kontra: false });
  });

  it('having 66 but not claiming loses if the other side wins the last trick', () => {
    let h = scenario({ mode: '2v1', hands: ['9p', 'Ap', '9z'], trump: 'tok' });
    h.tricksWon = [3, 0, 0];
    h.tricksPlayed = 3;
    h.points = [80, 0, 0];
    h = play(play(play(h, 0, '9p'), 1, 'Ap'), 2, '9z');
    expect(h.result).toMatchObject({ winnerSide: 1, reason: 'lastTrick', amount: 2 });
  });
});

describe('pairs', () => {
  it('a pair is credited only after its owner wins a trick: 20, or 40 in adu', () => {
    let h = scenario({ mode: '1v1', hands: ['Kz Fz 9m', '9z Am 9p'], trump: 'tok', turn: 0 });
    h = play(h, 0, 'Kz', true);
    expect(h.pendingMeld[0]).toBe(20);
    expect(h.points[0]).toBe(0);
    expect(h.lastMeld).toEqual({ seat: 0, suit: 'zold', points: 20, trick: 0 });
    h = play(h, 1, '9z');
    expect(h.points[0]).toBe(4 + 20);
    expect(h.pendingMeld[0]).toBe(0);

    let t = scenario({ mode: '1v1', hands: ['Kt Ft 9m', '9t Am 9p'], trump: 'tok', turn: 0 });
    t = play(t, 0, 'Kt', true);
    t = play(t, 1, '9t');
    expect(t.points[0]).toBe(4 + 40);
  });

  it('a pair that loses its trick stays pending', () => {
    let h = scenario({ mode: '1v1', hands: ['Kz Fz 9m', 'Az Am 9p'], trump: 'tok', turn: 0 });
    h = play(h, 0, 'Kz', true);
    h = play(h, 1, 'Az');
    expect(h.points[0]).toBe(0);
    expect(h.pendingMeld[0]).toBe(20);
  });

  it('with a trick already won the pair counts at once, and "Kész!" can follow', () => {
    let h = scenario({ mode: '1v1', hands: ['Kz Fz 9m', '9z Am 9p'], trump: 'tok', turn: 0 });
    h.tricksWon = [1, 0];
    h.points = [50, 0];
    h = play(h, 0, 'Kz', true);
    expect(h.points[0]).toBe(70);
    expect(hasMove(h, 0, { type: 'claim', seat: 0 })).toBe(true);
    expect(applyMove(h, { type: 'claim', seat: 0 }).result).toMatchObject({ winnerSide: 0, reason: 'claim' });
  });

  it('a pair can be declared on a lead in every mode, but needs both cards', () => {
    for (const mode of ['2v1', '2v2'] as const) {
      const hands = mode === '2v1' ? ['Kz Fz 9m', '9m 9p', 'Am Ap'] : ['Kz Fz 9m', '9m 9p', 'Am Ap', 'Um Up'];
      const table = scenario({ mode, hands, trump: 'tok' });
      expect(legalMoves(table, 0).filter((m) => m.type === 'play' && m.meld && !m.enough)).toHaveLength(2);
    }
    const one = scenario({ mode: '1v1', hands: ['Kz 9z', '9m 9p'], trump: 'tok', turn: 0 });
    expect(legalMoves(one, 0).some((m) => m.type === 'play' && m.meld)).toBe(false);
  });

  it('pairs score 20, or 40 in adutt, in a three player hand too', () => {
    let h = scenario({ mode: '2v1', hands: ['Kz Fz 9m', '9z Am 9p', 'Um Ap Up'], trump: 'tok' });
    h = play(h, 0, 'Fz', true);
    expect(h.lastMeld).toEqual({ seat: 0, suit: 'zold', points: 20, trick: 0 });
    h = play(play(h, 1, '9z'), 2, 'Um');
    expect(h.points[0]).toBe(5 + 20);

    let t = scenario({ mode: '2v1', hands: ['Kt Ft 9m', '9t Am 9p', 'Um Ap Up'], trump: 'tok' });
    t = play(play(play(t, 0, "Kt", true), 1, "9t"), 2, "Um");
    expect(t.points[0]).toBe(6 + 40);
  });
});

describe('match', () => {
  const matchWith = (hand: HandState, scores: number[], extra: Partial<MatchState> = {}): MatchState => ({
    settings: { mode: hand.mode, startScore: 40, showPoints: true },
    scores,
    dealer: hand.dealer,
    handNumber: 1,
    hand,
    seats: scores.map((_, i) => i),
    out: [],
    lastOut: [],
    over: false,
    ranking: null,
    ...extra,
  });

  it('subtracts the amount from each member of the winning side', () => {
    const h = scenario({ mode: '2v2', hands: ['9m', '9p', '9z', 'Um'], trump: 'tok' });
    h.sides = [0, 1, 0, 1];
    h.points = [40, 0, 30, 0];
    h.tricksWon = [2, 0, 2, 0];
    h.tricksPlayed = 4;
    h.claimWindow = 2;
    const m = applyMatchMove(matchWith(h, [40, 40, 40, 40]), { type: 'claim', seat: 2 });
    expect(m.scores).toEqual([34, 40, 34, 40]);
    expect(m.over).toBe(false);
    expect(m.out).toEqual([]);
  });

  const threePlayerExit = () => {
    const h = scenario({ mode: '2v1', hands: ['9m 9p', '9z 9t', 'Um Uz'], trump: 'tok' });
    h.points = [70, 0, 0];
    h.tricksWon = [3, 0, 0];
    h.tricksPlayed = 3;
    h.claimWindow = 0;
    return applyMatchMove(matchWith(h, [6, 40, 40]), { type: 'claim', seat: 0 });
  };

  it('a player who reaches zero leaves, and the other two carry on one against one', () => {
    const m = threePlayerExit();
    expect(m.scores[0]).toBe(0);
    expect(m.out).toEqual([0]);
    expect(m.lastOut).toEqual([0]);
    expect(m.over).toBe(false);

    const next = nextHand(m, mulberry32(3));
    expect(next.seats).toEqual([1, 2]);
    expect(next.hand.mode).toBe('1v1');
    expect(next.hand.n).toBe(2);
    expect(next.scores).toEqual([0, 40, 40]);
    expect(next.dealer).toBe(1); // the deal skips the player who left
    expect(next.lastOut).toEqual([]);
    expect(() => applyMatchMove(next, { type: 'declare', seat: 0, kind: 'none' })).toThrow(/no longer/);
  });

  it('shows a player who left the table without their cards, using table seats everywhere', () => {
    const next = nextHand(threePlayerExit(), mulberry32(3));
    const gone = viewFor(next, 0).hand;
    expect(gone.myHand).toEqual([]);
    expect(gone.legalMoves).toEqual([]);
    expect(gone.activeSeats).toEqual([1, 2]);
    expect(gone.handSizes).toEqual([0, 4, 4]);
    expect(gone.mode).toBe('1v1');

    const playing = viewFor(next, 1).hand;
    expect(playing.myHand).toEqual(next.hand.hands[0]);
    expect(playing.mySeat).toBe(1);
    expect(playing.turn === 1 || playing.turn === 2).toBe(true);
    for (const move of playing.legalMoves) expect(move.seat).toBe(1);
  });

  it('the match ends when one player is left, and the ranking runs from first out to last', () => {
    const h = scenario({ mode: '1v1', hands: ['9m 9p', '9z 9t'], trump: 'tok' });
    h.points = [70, 0];
    h.tricksWon = [3, 0];
    h.tricksPlayed = 3;
    h.claimWindow = 0;
    const m = matchWith(h, [-2, 4, 10], { seats: [1, 2], out: [0], dealer: 0 });
    const end = applyMatchMove(m, { type: 'claim', seat: 1 }); // seat 1 wins 6, so 4 - 6 < 0
    expect(end.out).toEqual([0, 1]);
    expect(end.over).toBe(true);
    expect(end.ranking).toEqual([0, 1, 2]);
    expect(() => nextHand(end, mulberry32(1))).toThrow();
    expect(() => applyMatchMove(end, { type: 'declare', seat: 2, kind: 'none' })).toThrow();
  });

  it('two partners who finish together leave together, the lower score first', () => {
    const h = scenario({ mode: '2v2', hands: ['9m 9p', '9z 9t', 'Um Uz', 'Up Ut'], trump: 'tok' });
    h.sides = [0, 0, 1, 1];
    h.points = [40, 30, 0, 0];
    h.tricksWon = [2, 2, 0, 0];
    h.tricksPlayed = 4;
    h.claimWindow = 0;
    const m = applyMatchMove(matchWith(h, [5, 3, 40, 40]), { type: 'claim', seat: 0 });
    expect(m.scores).toEqual([-1, -3, 40, 40]);
    expect(m.out).toEqual([1, 0]);
    expect(m.over).toBe(false);
    expect(nextHand(m, mulberry32(2)).hand.mode).toBe('1v1');
  });

  it('a four player table shrinks to three when one player leaves', () => {
    const h = scenario({ mode: '2v2', hands: ['9m', '9p', '9z', 'Um'], trump: 'tok' });
    h.sides = [0, 1, 1, 1];
    h.points = [70, 0, 0, 0];
    h.tricksWon = [3, 0, 0, 0];
    h.tricksPlayed = 3;
    h.claimWindow = 0;
    const m = applyMatchMove(matchWith(h, [4, 40, 40, 40]), { type: 'claim', seat: 0 });
    expect(m.out).toEqual([0]);
    const next = nextHand(m, mulberry32(4));
    expect(next.hand.mode).toBe('2v1');
    expect(next.seats).toEqual([1, 2, 3]);
  });

  it('deals the next hand with the dealer moved on', () => {
    const rng = mulberry32(9);
    let m = newMatch({ mode: '2v1', startScore: 30, showPoints: false }, rng);
    expect(m.scores).toEqual([30, 30, 30]);
    expect(() => nextHand(m, rng)).toThrow();
    m = { ...m, hand: { ...m.hand, phase: 'ended' } };
    const n = nextHand(m, rng);
    expect(n.dealer).toBe(1);
    expect(n.handNumber).toBe(2);
    expect(n.hand.caller).toBe(2);
    expect(n.hand.phase).toBe('callTrump');
  });
});

describe('what players may see', () => {
  const fresh = () => {
    let m = newMatch({ mode: '1v1', startScore: 40, showPoints: false }, mulberry32(11));
    m = applyMatchMove(m, { type: 'callTrump', seat: 1, suit: m.hand.hands[1]![0]!.suit });
    return applyMatchMove(m, { type: 'declare', seat: 1, kind: 'none' });
  };

  it('never contains the other player\'s hand or the cards nobody was dealt', () => {
    const m = fresh();
    const json = JSON.stringify(viewFor(m, 1));
    for (const card of m.hand.hands[0]!) expect(json).not.toContain(JSON.stringify(card));
    for (const card of m.hand.undealt) expect(json).not.toContain(JSON.stringify(card));
    expect(viewFor(m, 1).hand.myHand).toEqual(m.hand.hands[1]);
    expect(viewFor(m, 1).hand.revealed).toBeNull();
  });

  it('hides point counts unless the host allows them', () => {
    const m = fresh();
    expect(viewFor(m, 0).hand.points).toBeNull();
    const shown = { ...m, settings: { ...m.settings, showPoints: true } };
    expect(viewFor(shown, 0).hand.points).toEqual([0, 0]);
    // The player can always look through their own won tricks.
    expect(viewFor(m, 0).hand.myTricks).toEqual([]);
  });
});

describe('"Elég!" together with a pair', () => {
  const pairHand = (points: number, tricks: number) => {
    const h = scenario({ mode: '2v1', hands: ['Kz Fz 9m', '9z Am 9p', 'Um Ap Up'], trump: 'tok' });
    h.tricksWon = [tricks, 0, 0];
    h.tricksPlayed = tricks;
    h.points = [points, 0, 0];
    return h;
  };
  const enough = (h: HandState) => applyMove(h, { type: 'play', seat: 0, card: c('Kz'), meld: true, enough: true });

  it('claims at once, counting the pair: 66 or more wins the hand', () => {
    const done = enough(pairHand(50, 2));
    expect(done.phase).toBe('ended');
    expect(done.result).toEqual({ winnerSide: 0, amount: 6, reason: 'claim', kontra: false });
  });

  it('with too few points the claim is false and the hand is lost', () => {
    const done = enough(pairHand(30, 2)); // 30 + 20 = 50
    expect(done.result).toMatchObject({ winnerSide: 1, reason: 'falseClaim', amount: 2 });
  });

  it('a pair does not count before its owner has won a trick, so "Elég!" fails then', () => {
    const done = enough(pairHand(0, 0));
    expect(done.result).toMatchObject({ winnerSide: 1, reason: 'falseClaim', amount: 6 });
  });

  it('is offered with every pair card, but not while durkó is declared', () => {
    const h = pairHand(50, 2);
    const offered = legalMoves(h, 0).filter((m) => m.type === 'play' && m.enough);
    expect(offered).toHaveLength(2);
    h.declaration = { kind: 'durko', side: 0, by: 0 };
    expect(legalMoves(h, 0).some((m) => m.type === 'play' && m.enough)).toBe(false);
    // The plain declaration is still allowed.
    expect(legalMoves(h, 0).some((m) => m.type === 'play' && m.meld && !m.enough)).toBe(true);
  });
});
