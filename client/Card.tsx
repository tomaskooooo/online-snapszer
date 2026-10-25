import type { Card, Rank, Suit } from '../src';
import { RANK_NAME, SUIT_NAME } from './labels';

const PATHS: Record<Suit, React.ReactNode> = {
  piros: <path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" />,
  tok: (
    <>
      <path d="M12 2.6a1.7 1.7 0 0 1 1.6 2.3c3 .8 4.9 3.4 4.9 6.6V16l2 2.3v.9H3.5v-.9l2-2.3v-4.5c0-3.2 1.9-5.8 4.9-6.6A1.7 1.7 0 0 1 12 2.6z" />
      <circle cx="12" cy="21" r="1.9" />
    </>
  ),
  zold: (
    <>
      <path d="M4.5 19.5C4 10 10 4 20 3.5c.5 10-5.5 16-15.5 16z" />
      <path d="M4.5 19.5 15 9" stroke="#fbf6e8" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </>
  ),
  makk: (
    <>
      <path d="M4.8 10.6C4.8 7 8 4.8 12 4.8s7.2 2.2 7.2 5.8z" />
      <path d="M6.4 12c0 5.6 3 9.2 5.6 9.2s5.6-3.6 5.6-9.2z" />
      <rect x="11.2" y="2.2" width="1.6" height="3" rx=".8" />
    </>
  ),
};

/** Small suit symbol for chips and buttons. */
export function SuitIcon({ suit, size = 20 }: { suit: Suit; size?: number }) {
  return (
    <svg className={`suit-icon s-${suit}`} viewBox="0 0 24 24" width={size} height={size} fill="currentColor" role="img" aria-label={SUIT_NAME[suit]}>
      {PATHS[suit]}
    </svg>
  );
}

export function cardLabel(card: Card): string {
  return `${SUIT_NAME[card.suit]} ${RANK_NAME[card.rank]}`;
}

/** File names of the card art in public/cards. */
const SUIT_FILE: Record<Suit, string> = { tok: 'bell', zold: 'leaf', piros: 'heart', makk: 'acorn' };
const RANK_FILE: Record<Rank, string> = { ace: 'ace', ten: 'ten', king: 'king', over: 'ober', under: 'unter', nine: 'nine' };
export const cardImage = (card: Card): string => `/cards/${SUIT_FILE[card.suit]}-${RANK_FILE[card.rank]}.png`;

interface FaceProps {
  card: Card;
  onClick?: () => void;
  /** Dim a card that cannot be played right now. */
  dimmed?: boolean;
  playable?: boolean;
  size?: 'normal' | 'small' | 'tiny';
}

export function CardFace({ card, onClick, dimmed, playable, size = 'normal' }: FaceProps) {
  const cls = ['card', 'face', `size-${size}`, dimmed && 'dimmed', playable && 'playable'].filter(Boolean).join(' ');
  const label = cardLabel(card);
  const img = <img src={cardImage(card)} alt={label} draggable={false} />;
  if (!onClick) {
    return (
      <div className={cls} title={label}>
        {img}
      </div>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} disabled={dimmed} aria-label={label} title={label}>
      {img}
    </button>
  );
}

export function CardBack({ size = 'small' }: { size?: 'normal' | 'small' | 'tiny' }) {
  return (
    <div className={`card back size-${size}`} aria-hidden>
      <img src="/cards/back.png" alt="" draggable={false} />
    </div>
  );
}
