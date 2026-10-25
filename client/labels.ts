import type { Mode, Rank, ResultReason, Suit } from '../src';

export const SUIT_NAME: Record<Suit, string> = { tok: 'Tök', zold: 'Zöld', piros: 'Piros', makk: 'Makk' };

export const RANK_NAME: Record<Rank, string> = {
  ace: 'Ász',
  ten: 'Tízes',
  king: 'Király',
  over: 'Felső',
  under: 'Alsó',
  nine: '9',
};

/** Short index shown in a card corner, where cards overlap in a hand. */
export const RANK_CORNER: Record<Rank, string> = {
  ace: 'Ász',
  ten: '10',
  king: 'Kir',
  over: 'Fel',
  under: 'Als',
  nine: '9',
};

export const MODE_INFO: Record<Mode, { title: string; players: number; blurb: string }> = {
  '1v1': { title: '1v1', players: 2, blurb: 'Classic two-player game with a talon, pairs and trump swap.' },
  '2v1': { title: '2v1', players: 3, blurb: 'Three players. The caller picks the adu and plays alone against the other two.' },
  '2v2': { title: '2v2', players: 4, blurb: 'Four players. The caller names a card; its holder is the secret partner.' },
};

export const REASON_TEXT: Record<ResultReason, string> = {
  claim: 'Kész! was called with 66 or more',
  falseClaim: 'Kész! was called without 66 points',
  lastTrick: 'Nobody called Kész!, so the last trick decided it',
  allTricks: 'Every trick was taken',
  coverFailed: 'The talon was covered but 66 was never reached',
  snapszerWon: 'Snapszer succeeded',
  snapszerFailed: 'Snapszer failed',
  durkoWon: 'Durkó succeeded',
  durkoFailed: 'Durkó failed',
};
