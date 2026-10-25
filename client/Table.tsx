import { useState } from 'react';
import { cardId, cardPoints, currentWinner, sameCard, type Card, type LobbyView, type Move, type Suit } from '../src';
import { CardBack, CardFace, SuitIcon, cardLabel } from './Card';
import { REASON_TEXT, SUIT_NAME } from './labels';

type Pos = 'bottom' | 'left' | 'top' | 'right';
type PlayMove = Extract<Move, { type: 'play' }>;

interface Props {
  view: LobbyView;
  busy: boolean;
  run: (action: () => Promise<{ view: LobbyView }>) => void;
  actions: {
    move: (move: Move) => Promise<{ view: LobbyView }>;
    nextHand: (handNumber: number) => Promise<{ view: LobbyView }>;
    rematch: () => Promise<{ view: LobbyView }>;
  };
  onLeave: () => void;
}

export function Table({ view, busy, run, actions, onLeave }: Props) {
  const match = view.match!;
  const hand = match.hand;
  const players = view.players;
  const n = players.length;
  const me = view.me.seat;
  const [pending, setPending] = useState<Card | null>(null);
  const [showTricks, setShowTricks] = useState(false);

  const name = (seat: number) => players[seat]?.name ?? '?';
  const pos = (seat: number): Pos => {
    const r = (seat - me + n) % n;
    if (r === 0) return 'bottom';
    if (n === 2) return 'top';
    if (n === 3) return r === 1 ? 'left' : 'right';
    return r === 1 ? 'left' : r === 2 ? 'top' : 'right';
  };

  const legal = hand.legalMoves;
  const plays = legal.filter((m): m is PlayMove => m.type === 'play');
  const playable = new Set(plays.filter((m) => !m.meld).map((m) => cardId(m.card)));
  const melds = plays.filter((m) => m.meld);
  const isMyTurn = hand.phase === 'play' && hand.turn === me;
  const send = (move: Move) => run(() => actions.move({ ...move, seat: me }));

  const clickCard = (card: Card) => {
    if (!isMyTurn || !playable.has(cardId(card))) return;
    if (melds.some((m) => sameCard(m.card, card))) setPending(card);
    else send({ type: 'play', seat: me, card });
  };

  const trickCards = hand.trick.length > 0 ? hand.trick : (hand.lastTrick ?? []);
  const showingLast = hand.trick.length === 0 && trickCards.length > 0;
  const lastWinner = hand.lastTrick && hand.lastTrick.length > 0 ? currentWinner(hand.lastTrick, hand.trumpSuit).seat : null;
  const trumpName = hand.trumpSuit ? SUIT_NAME[hand.trumpSuit] : null;
  const decl = hand.declaration;
  const calledHeld = hand.calledCard ? hand.myHand.some((c) => sameCard(c, hand.calledCard!)) : false;

  const claim = legal.find((m) => m.type === 'claim');
  const swap = legal.find((m) => m.type === 'swapTrump');
  const cover = legal.find((m) => m.type === 'cover');

  // ---- status line ------------------------------------------------------
  let status = '';
  if (hand.phase === 'callTrump') {
    status = hand.caller === me ? 'You are the caller: choose the adu suit.' : `${name(hand.caller)} is choosing the adu…`;
  } else if (hand.phase === 'callCard') {
    status = hand.caller === me ? 'You are the caller: name a card. Its suit becomes adu and its holder is your secret partner.' : `${name(hand.caller)} is naming a card…`;
  } else if (hand.phase === 'declare') {
    status = hand.turn === me ? 'Declare a Snapszer or durkó, or just start playing.' : `${name(hand.turn)} is deciding whether to declare…`;
  } else if (hand.phase === 'play') {
    if (isMyTurn) {
      status = plays.length < hand.myHand.length && hand.trick.length > 0 ? 'Your turn. Only the highlighted cards are allowed.' : 'Your turn.';
    } else {
      status = `Waiting for ${name(hand.turn)}…`;
    }
  }
  const role =
    hand.calledCard && hand.phase !== 'callCard'
      ? calledHeld
        ? hand.caller === me
          ? 'You called a card you hold: you play alone against the others.'
          : `You hold the called card: you are ${name(hand.caller)}'s secret partner.`
        : hand.caller === me
          ? 'Your partner holds the called card. Nobody knows who it is.'
          : ''
      : '';

  // ---- pieces -----------------------------------------------------------
  const stats = (seat: number) => {
    const bits = [`${hand.tricksWon[seat]} trick${hand.tricksWon[seat] === 1 ? '' : 's'}`];
    if (hand.points) bits.push(`${hand.points[seat]} pts`);
    return bits.join(' · ');
  };

  const opponent = (seat: number) => (
    <div key={seat} className={`opp pos-${pos(seat)} ${hand.turn === seat && hand.phase !== 'ended' ? 'turn' : ''}`} style={{ gridArea: pos(seat) }}>
      <div className="opp-name">
        {players[seat]!.bot && <span aria-hidden>🤖 </span>}
        {name(seat)}
        {hand.caller === seat && n > 2 && <span className="tag">caller</span>}
      </div>
      <div className="backs" aria-label={`${hand.handSizes[seat]} cards`}>
        {Array.from({ length: hand.handSizes[seat]! }, (_, i) => (
          <CardBack key={i} size="tiny" />
        ))}
      </div>
      <div className="stats">{stats(seat)}</div>
    </div>
  );

  const dealOpps = Array.from({ length: n }, (_, s) => s).filter((s) => s !== me).map(opponent);

  return (
    <div className="table-screen">
      <header className="topbar">
        <div className="scores" aria-label="Scores">
          {players.map((p, i) => (
            <span key={p.id} className={`score ${i === me ? 'me' : ''} ${match.scores[i]! === Math.min(...match.scores) ? 'lead' : ''}`}>
              <small>{p.name}</small>
              <b>{match.scores[i]}</b>
            </span>
          ))}
        </div>
        <div className="meta">
          <span>
            {view.settings.mode} · hand {match.handNumber}
          </span>
          <button className="link" onClick={onLeave}>
            Leave
          </button>
        </div>
      </header>

      <div className="board">
        {dealOpps}
        <div className="center" style={{ gridArea: 'center' }}>
          <div className="chips">
            {hand.trumpSuit && (
              <span className={`chip adu s-${hand.trumpSuit}`}>
                <SuitIcon suit={hand.trumpSuit} size={18} /> Adu: {trumpName}
              </span>
            )}
            {decl && <span className="chip warn">{name(decl.by)}: {decl.kind === 'snapszer' ? 'Snapszer' : 'Durkó'}!</span>}
            {hand.covered !== null && <span className="chip warn">Talon covered by {name(hand.covered)}</span>}
            {hand.calledCard && (
              <span className="chip called">
                Called: <CardFace card={hand.calledCard} size="tiny" />
              </span>
            )}
          </div>

          <div className={`trick ${showingLast ? 'last' : ''}`}>
            {trickCards.map((p) => (
              <div key={`${p.seat}-${cardId(p.card)}`} className={`slot pos-${pos(p.seat)} ${showingLast && p.seat === lastWinner ? 'won' : ''}`} style={{ gridArea: pos(p.seat) }}>
                <CardFace card={p.card} />
                <small>{p.seat === me ? 'you' : name(p.seat)}</small>
              </div>
            ))}
            {trickCards.length === 0 && <p className="muted mid">The table is empty</p>}
          </div>
          {showingLast && lastWinner !== null && hand.phase !== 'ended' && (
            <p className="caption">{lastWinner === me ? 'You take' : `${name(lastWinner)} takes`} the trick</p>
          )}
          {!showingLast && hand.lastTrick && hand.lastTrick.length > 0 && (
            <div className="last-row">
              <small>Last trick</small>
              {hand.lastTrick.map((p) => (
                <CardFace key={cardId(p.card)} card={p.card} size="tiny" />
              ))}
            </div>
          )}

        </div>
        {view.settings.mode === '1v1' && hand.stockCount > 0 && (
          <div className="talon" style={{ gridArea: 'left' }} aria-label={`Talon, ${hand.stockCount} cards`}>
            {hand.trumpCard && <CardFace card={hand.trumpCard} size="small" />}
            <div className="pile">
              <CardBack size="small" />
              <b>{hand.stockCount - (hand.trumpCard ? 1 : 0)}</b>
            </div>
          </div>
        )}
      </div>

      <section className="dock">
        {role && <p className="role">{role}</p>}
        <p className="status" aria-live="polite">{status}</p>

        {hand.phase === 'callTrump' && hand.caller === me && (
          <div className="actions">
            {legal.filter((m): m is Extract<Move, { type: 'callTrump' }> => m.type === 'callTrump').map((m) => (
              <button key={m.suit} className={`btn suit-btn s-${m.suit}`} disabled={busy} onClick={() => send(m)}>
                <SuitIcon suit={m.suit} size={22} /> {SUIT_NAME[m.suit]}
              </button>
            ))}
          </div>
        )}

        {hand.phase === 'callCard' && hand.caller === me && <CardPicker moves={legal} busy={busy} onPick={send} />}

        {hand.phase === 'declare' && hand.turn === me && (
          <div className="actions">
            <button className="btn primary" disabled={busy} onClick={() => send({ type: 'declare', seat: me, kind: 'none' })}>
              Just play
            </button>
            <button className="btn" disabled={busy} title="Reach 66 before anyone on the other side wins a trick" onClick={() => send({ type: 'declare', seat: me, kind: 'snapszer' })}>
              Snapszer (12)
            </button>
            <button className="btn" disabled={busy} title="Win every single trick" onClick={() => send({ type: 'declare', seat: me, kind: 'durko' })}>
              Durkó (32)
            </button>
          </div>
        )}

        {hand.phase === 'play' && (swap || cover || claim) && (
          <div className="actions">
            {claim && (
              <button
                className="btn kesz"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('Call Kész!?\n\nIf your side has fewer than 66 points, you lose the hand.')) send(claim);
                }}
              >
                Kész!
              </button>
            )}
            {swap && (
              <button className="btn" disabled={busy} onClick={() => send(swap)}>
                Swap trump Alsó
              </button>
            )}
            {cover && (
              <button className="btn" disabled={busy} onClick={() => send(cover)}>
                Cover talon
              </button>
            )}
          </div>
        )}

        <div className={`me-bar ${isMyTurn ? 'turn' : ''}`}>
          <span>
            <b>{name(me)}</b> · {stats(me)}
          </span>
          <button className="link" onClick={() => setShowTricks(true)}>
            My tricks ({hand.tricksWon[me]})
          </button>
        </div>

        <div className="hand" role="list" style={{ '--count': hand.myHand.length } as React.CSSProperties}>
          {hand.myHand.map((card) => (
            <div role="listitem" key={cardId(card)}>
              <CardFace card={card} onClick={isMyTurn ? () => clickCard(card) : undefined} dimmed={isMyTurn && !playable.has(cardId(card))} playable={isMyTurn && playable.has(cardId(card))} />
            </div>
          ))}
        </div>
      </section>

      {pending && (
        <Modal onClose={() => setPending(null)} title={cardLabel(pending)}>
          <div className="stack tight">
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => {
                send({ type: 'play', seat: me, card: pending, meld: true });
                setPending(null);
              }}
            >
              Declare {pending.suit === hand.trumpSuit ? 40 : 20} and play it
            </button>
            <button
              className="btn"
              disabled={busy}
              onClick={() => {
                send({ type: 'play', seat: me, card: pending });
                setPending(null);
              }}
            >
              Just play it
            </button>
          </div>
        </Modal>
      )}

      {showTricks && (
        <Modal onClose={() => setShowTricks(false)} title="Cards in your tricks">
          {hand.myTricks.length === 0 ? (
            <p className="muted">You have not won a trick yet.</p>
          ) : (
            <>
              <div className="mini-grid">
                {hand.myTricks.map((c) => (
                  <CardFace key={cardId(c)} card={c} size="tiny" />
                ))}
              </div>
              <p className="hint">Card total: {hand.myTricks.reduce((s, c) => s + cardPoints(c), 0)}</p>
            </>
          )}
        </Modal>
      )}

      {hand.phase === 'ended' && <HandEnd view={view} busy={busy} run={run} actions={actions} onLeave={onLeave} />}
    </div>
  );
}

function CardPicker({ moves, busy, onPick }: { moves: Move[]; busy: boolean; onPick: (m: Move) => void }) {
  const calls = moves.filter((m): m is Extract<Move, { type: 'callCard' }> => m.type === 'callCard');
  const suits = [...new Set(calls.map((m) => m.card.suit))] as Suit[];
  return (
    <div className="picker">
      {suits.map((suit) => (
        <div key={suit} className="picker-row">
          {calls.filter((m) => m.card.suit === suit).map((m) => (
            <CardFace key={cardId(m.card)} card={m.card} size="tiny" onClick={busy ? undefined : () => onPick(m)} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
        <button className="link close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function HandEnd({ view, busy, run, actions, onLeave }: Props) {
  const match = view.match!;
  const hand = match.hand;
  const result = hand.result!;
  const revealed = hand.revealed!;
  const players = view.players;
  const me = view.me.seat;
  const winnerSeats = revealed.sides.flatMap((s, seat) => (s === result.winnerSide ? [seat] : []));
  const iWon = winnerSeats.includes(me);
  const names = (seats: number[]) => seats.map((s) => (s === me ? 'You' : players[s]!.name)).join(' & ');
  const matchOver = match.winners !== null;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Hand finished">
      <div className="dialog wide">
        <h2 className={iWon ? 'win' : 'lose'}>{matchOver ? (match.winners!.includes(me) ? 'You won the match!' : `${names(match.winners!)} won the match`) : iWon ? 'You won the hand' : 'You lost the hand'}</h2>
        <p>
          {REASON_TEXT[result.reason]}. <strong>{names(winnerSeats)}</strong> {winnerSeats.length > 1 || winnerSeats[0] === me ? 'go' : 'goes'} down by <strong>{result.amount}</strong>.
        </p>

        <table className="result-table">
          <thead>
            <tr>
              <th>Player</th>
              {view.settings.mode === '2v2' && <th>Side</th>}
              <th>Card points</th>
              <th>Left to go</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <tr key={p.id} className={revealed.sides[i] === result.winnerSide ? 'won' : ''}>
                <td>{i === me ? `${p.name} (you)` : p.name}</td>
                {view.settings.mode === '2v2' && <td>{revealed.sides[i] === result.winnerSide ? 'winners' : 'losers'}</td>}
                <td>{hand.finalPoints?.[i] ?? '–'}</td>
                <td>
                  <b>{match.scores[i]}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="row">
          <button className="btn" onClick={onLeave}>
            Leave
          </button>
          {!matchOver && (
            <button className="btn primary" disabled={busy} onClick={() => run(() => actions.nextHand(match.handNumber))}>
              Next hand
            </button>
          )}
          {matchOver && view.me.isHost && (
            <button className="btn primary" disabled={busy} onClick={() => run(actions.rematch)}>
              Rematch
            </button>
          )}
        </div>
        {matchOver && !view.me.isHost && <p className="hint">Waiting for the host to start a rematch…</p>}
      </div>
    </div>
  );
}
