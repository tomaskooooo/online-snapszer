import { useRef, useState } from 'react';
import { cardId, type Card } from '../src';
import { CardFace } from './Card';

export type DragState = 'idle' | 'ready' | 'over' | 'blocked';

interface Props {
  /** The cards in the order the player arranged them. */
  cards: Card[];
  /** Cards the rules allow right now. */
  playable: Set<string>;
  /** True when it is this player's turn to put a card down. */
  canPlay: boolean;
  onReorder: (ids: string[]) => void;
  /** A playable card was dropped on the table. */
  onPlay: (card: Card) => void;
  /** A card that may not be played now was dropped on the table. */
  onReject: (card: Card) => void;
  /** Tells the table how to light up while a card is being dragged. */
  onDragState: (state: DragState) => void;
}

interface Active {
  id: string;
  card: Card;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  moved: boolean;
}

const overTable = (x: number, y: number) => !!document.elementFromPoint(x, y)?.closest('[data-dropzone="table"]');

/**
 * The player's cards. Drag a card sideways to reorder; drag it onto the table to play it.
 * Pointer events are used instead of HTML drag and drop so that it works with a finger too.
 */
export function Hand({ cards, playable, canPlay, onReorder, onPlay, onReject, onDragState }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const items = useRef(new Map<string, HTMLElement>());
  const active = useRef<Active | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const ids = cards.map(cardId);

  const finish = () => {
    active.current = null;
    setGhost(null);
    setDraggingId(null);
    onDragState('idle');
  };

  const down = (e: React.PointerEvent<HTMLElement>, card: Card) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    active.current = {
      id: cardId(card),
      card,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
  };

  const move = (e: React.PointerEvent<HTMLElement>) => {
    const a = active.current;
    if (!a) return;
    if (!a.moved) {
      if (Math.hypot(e.clientX - a.startX, e.clientY - a.startY) < 6) return;
      a.moved = true;
      setDraggingId(a.id);
    }
    setGhost({ x: e.clientX - a.offsetX, y: e.clientY - a.offsetY });

    const hot = overTable(e.clientX, e.clientY);
    const allowed = canPlay && playable.has(a.id);
    onDragState(hot ? (allowed ? 'over' : 'blocked') : allowed ? 'ready' : 'idle');

    // Dragging inside the hand rearranges it live.
    const zone = wrap.current?.getBoundingClientRect();
    if (!hot && zone && e.clientY > zone.top - 40) {
      const others = ids.filter((id) => id !== a.id);
      const index = others.filter((id) => {
        const r = items.current.get(id)?.getBoundingClientRect();
        return r ? r.left + r.width / 2 < e.clientX : false;
      }).length;
      const next = [...others.slice(0, index), a.id, ...others.slice(index)];
      if (next.some((id, i) => id !== ids[i])) onReorder(next);
    }
  };

  const up = (e: React.PointerEvent<HTMLElement>) => {
    const a = active.current;
    if (!a) return;
    if (a.moved && overTable(e.clientX, e.clientY)) {
      if (canPlay && playable.has(a.id)) onPlay(a.card);
      else onReject(a.card);
    }
    finish();
  };

  const dragged = draggingId ? cards.find((c) => cardId(c) === draggingId) : undefined;

  return (
    <>
      <div ref={wrap} className="hand" role="list" style={{ '--count': cards.length } as React.CSSProperties}>
        {cards.map((card) => {
          const id = cardId(card);
          return (
            <div
              role="listitem"
              key={id}
              ref={(el) => {
                if (el) items.current.set(id, el);
                else items.current.delete(id);
              }}
              className={`hand-item ${draggingId === id ? 'lifted' : ''}`}
              onPointerDown={(e) => down(e, card)}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={finish}
            >
              <CardFace
                card={card}
                // A keyboard press (detail 0) plays the card; mouse and touch have to drag it.
                onClick={(e) => {
                  if (e.detail === 0 && canPlay && playable.has(id)) onPlay(card);
                }}
                dimmed={canPlay && !playable.has(id)}
                playable={canPlay && playable.has(id)}
              />
            </div>
          );
        })}
      </div>
      {dragged && ghost && (
        <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y, width: active.current?.width, height: active.current?.height }} aria-hidden>
          <CardFace card={dragged} />
        </div>
      )}
    </>
  );
}
