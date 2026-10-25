import type { Card, Rank, Suit } from '../src';
import { RANK_NAME, SUIT_NAME } from './labels';

/** The painted suit symbols from the card deck itself (public/cards/suit-*.png). */
export function SuitIcon({ suit, size = 20, className = '' }: { suit: Suit; size?: number | string; className?: string }) {
  return (
    <img
      className={`suit-icon s-${suit} ${className}`}
      src={`/cards/suit-${SUIT_FILE[suit]}.png`}
      alt={SUIT_NAME[suit]}
      style={{ height: size, width: 'auto' }}
      draggable={false}
    />
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
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
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
    <button type="button" className={cls} onClick={onClick} aria-disabled={dimmed || undefined} aria-label={label} title={label}>
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
