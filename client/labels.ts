import type { Mode, Rank, ResultReason, Suit } from '../src';

export const SUIT_NAME: Record<Suit, string> = { tok: 'Tök', zold: 'Zöld', piros: 'Piros', makk: 'Makk' };

export const RANK_NAME: Record<Rank, string> = {
  ace: 'Ász',
  ten: 'Tízes',
  king: 'Király',
  over: 'Felső',
  under: 'Alsó',
  nine: 'Kilences',
};

export const MODE_INFO: Record<Mode, { title: string; players: number; blurb: string }> = {
  '1v1': { title: '1v1', players: 2, blurb: 'Klasszikus kétszemélyes játék talonnal, 20-40 bemondással és az adutt alsó cseréjével.' },
  '2v1': { title: '2v1', players: 3, blurb: 'Három játékos. A hívó választja az aduttot, és egyedül játszik a másik kettő ellen.' },
  '2v2': { title: '2v2', players: 4, blurb: 'Négy játékos. A hívó megnevez egy lapot, akinél az van, az a titkos társa.' },
};

export const REASON_TEXT: Record<ResultReason, string> = {
  claim: 'Kész! – megvolt a 66 pont',
  falseClaim: 'Hibás Kész! – nem volt meg a 66 pont',
  lastTrick: 'Senki sem mondott Kész!-t, az utolsó ütés döntött',
  allTricks: 'Minden ütést megnyert',
  coverFailed: 'A talont betakarta, de nem érte el a 66 pontot',
  snapszerWon: 'A Snapszer sikerült',
  snapszerFailed: 'A Snapszer nem sikerült',
  durkoWon: 'A Durch sikerült',
  durkoFailed: 'A Durch nem sikerült',
  forfeit: 'A hívó feladta a leosztást',
};

export const tricksText = (n: number) => `${n} ütés`;
