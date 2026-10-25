import { useState } from 'react';
import { cardId, cardPoints, currentWinner, sameCard, type Card, type LobbyView, type Move, type Suit } from '../src';
import { CardBack, CardFace, SuitIcon, cardLabel } from './Card';
import { REASON_TEXT, SUIT_NAME, tricksText } from './labels';
import { formatClock, useCountdown } from './useCountdown';

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
  const [pairSuit, setPairSuit] = useState<Suit | null>(null);
  const [showTricks, setShowTricks] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const secondsLeft = useCountdown(view.turnDeadline, view.serverTime);

  const name = (seat: number) => players[seat]?.name ?? '?';
  const pos = (seat: number): Pos => {
    const r = (seat - me + n) % n;
    if (r === 0) return 'bottom';
    if (n === 2) return 'top';
    if (n === 3) return r === 1 ? 'left' : 'right';
    return r === 1 ? 'left' : r === 2 ? 'top' : 'right';
  };

  const clock = (seat: number) =>
    hand.turn === seat && hand.phase !== 'ended' && secondsLeft !== null ? (
      <span className={`clock ${secondsLeft <= 10 ? 'low' : ''}`} role="timer" aria-label={`${secondsLeft} másodperc van hátra`}>
        ⏱ {formatClock(secondsLeft)}
      </span>
    ) : null;

  const legal = hand.legalMoves;
  const plays = legal.filter((m): m is PlayMove => m.type === 'play');
  const playable = new Set(plays.filter((m) => !m.meld).map((m) => cardId(m.card)));
  const melds = plays.filter((m) => m.meld);
  const pairSuits = [...new Set(melds.map((m) => m.card.suit))] as Suit[];
  const isMyTurn = hand.phase === 'play' && hand.turn === me;
  const myDecision = hand.turn === me && hand.phase !== 'ended';
  const send = (move: Move) => run(() => actions.move({ ...move, seat: me }));

  const clickCard = (card: Card) => {
    if (!isMyTurn || !playable.has(cardId(card))) return;
    if (melds.some((m) => sameCard(m.card, card))) setPending(card);
    else send({ type: 'play', seat: me, card });
  };

  const trickCards = hand.trick.length > 0 ? hand.trick : (hand.lastTrick ?? []);
  const showingLast = hand.trick.length === 0 && trickCards.length > 0;
  const lastWinner = hand.lastTrick && hand.lastTrick.length > 0 ? currentWinner(hand.lastTrick, hand.trumpSuit).seat : null;
  const decl = hand.declaration;
  const calledHeld = hand.calledCard ? hand.myHand.some((c) => sameCard(c, hand.calledCard!)) : false;

  const claim = legal.find((m) => m.type === 'claim');
  const swap = legal.find((m) => m.type === 'swapTrump');
  const cover = legal.find((m) => m.type === 'cover');
  const forfeit = legal.find((m) => m.type === 'forfeit');
  const pairValue = (suit: Suit) => (suit === hand.trumpSuit ? 40 : 20);

  const askForfeit = () => {
    if (forfeit && window.confirm('Feladod a leosztást?\n\nA többiek mindegyike 6 ponttal megy lejjebb.')) send(forfeit);
  };

  // ---- status line ------------------------------------------------------
  let status = '';
  if (hand.phase === 'callTrump') {
    status = hand.caller === me ? 'Te vagy a hívó: válaszd ki az aduttot.' : `${name(hand.caller)} aduttot választ…`;
  } else if (hand.phase === 'callCard') {
    status =
      hand.caller === me
        ? 'Te vagy a hívó: nevezz meg egy lapot. A színe lesz az adutt, akinél az van, az a titkos társad.'
        : `${name(hand.caller)} lapot nevez meg…`;
  } else if (hand.phase === 'declare') {
    status = hand.turn === me ? 'Bemondhatsz Snapszert vagy Durchot, vagy kezdődhet a játék.' : `${name(hand.turn)} dönt a bemondásról…`;
  } else if (hand.phase === 'kontra') {
    status = hand.turn === me ? `Kontrázol, vagy játszol? (${name(hand.caller)} a hívó)` : `${name(hand.turn)} dönt: kontra vagy játék…`;
  } else if (hand.phase === 'play') {
    if (isMyTurn) {
      status = plays.length < hand.myHand.length && hand.trick.length > 0 ? 'Te jössz. Csak a kiemelt lapok játszhatók ki.' : 'Te jössz.';
    } else {
      status = `${name(hand.turn)} következik…`;
    }
  }
  const role =
    hand.calledCard && hand.phase !== 'callCard'
      ? calledHeld
        ? hand.caller === me
          ? 'Magadnak hívtál lapot: egyedül játszol a többiek ellen.'
          : `Nálad van a hívott lap: te vagy ${name(hand.caller)} titkos társa.`
        : hand.caller === me
          ? 'A társad nála van, aki a hívott lapot tartja. Senki sem tudja, ki az.'
          : ''
      : '';

  // ---- pieces -----------------------------------------------------------
  const stats = (seat: number) => {
    const bits = [tricksText(hand.tricksWon[seat]!)];
    if (hand.points) bits.push(`${hand.points[seat]} pont`);
    return bits.join(' · ');
  };

  const opponent = (seat: number) => (
    <div key={seat} className={`opp pos-${pos(seat)} ${hand.turn === seat && hand.phase !== 'ended' ? 'turn' : ''}`} style={{ gridArea: pos(seat) }}>
      <div className="opp-name">
        {players[seat]!.bot && <span aria-hidden>🤖 </span>}
        {name(seat)}
        {hand.caller === seat && n > 2 && <span className="tag">hívó</span>}
        {hand.kontra === seat && <span className="tag kontra">kontra</span>}
      </div>
      <div className="backs" aria-label={`${hand.handSizes[seat]} lap`}>
        {Array.from({ length: hand.handSizes[seat]! }, (_, i) => (
          <CardBack key={i} size="tiny" />
        ))}
      </div>
      <div className="stats">{stats(seat)}</div>
      {clock(seat)}
    </div>
  );

  const opponents = Array.from({ length: n }, (_, s) => s)
    .filter((s) => s !== me)
    .map(opponent);

  return (
    <div className="table-screen">
      <header className="topbar">
        <div className="scores" aria-label="Hátralévő pontok">
          {players.map((p, i) => (
            <span key={p.id} className={`score ${i === me ? 'me' : ''} ${match.scores[i]! === Math.min(...match.scores) ? 'lead' : ''}`}>
              <small>{i === me ? `${p.name} (te)` : p.name}</small>
              <b>{match.scores[i]}</b>
            </span>
          ))}
        </div>
        <div className="meta">
          <span>
            {view.settings.mode} · {match.handNumber}. leosztás
          </span>
          <button className="link" onClick={() => setShowRules(true)}>
            Szabályok
          </button>
          <button className="link" onClick={onLeave}>
            Kilépés
          </button>
        </div>
      </header>

      <div className="board">
        {opponents}
        <div className="center" style={{ gridArea: 'center' }}>
          <div className="chips">
            {hand.trumpSuit && (
              <span className={`chip adu s-${hand.trumpSuit}`}>
                Adutt: <SuitIcon suit={hand.trumpSuit} size={24} /> <b>{SUIT_NAME[hand.trumpSuit]}</b>
              </span>
            )}
            {decl && (
              <span className="chip warn">
                {name(decl.by)}: {decl.kind === 'snapszer' ? 'Snapszer' : 'Durch'}!
              </span>
            )}
            {hand.kontra !== null && <span className="chip warn">Kontra: {name(hand.kontra)} (dupla pont)</span>}
            {hand.covered !== null && <span className="chip warn">A talont {name(hand.covered)} betakarta</span>}
            {hand.calledCard && (
              <span className="chip called">
                Hívott lap: <CardFace card={hand.calledCard} size="tiny" />
              </span>
            )}
          </div>

          <div className={`trick ${showingLast ? 'last' : ''}`}>
            {trickCards.map((p) => (
              <div key={`${p.seat}-${cardId(p.card)}`} className={`slot pos-${pos(p.seat)} ${showingLast && p.seat === lastWinner ? 'won' : ''}`} style={{ gridArea: pos(p.seat) }}>
                <CardFace card={p.card} />
                <small>{p.seat === me ? 'te' : name(p.seat)}</small>
              </div>
            ))}
            {trickCards.length === 0 && <p className="muted mid">Az asztal üres</p>}
          </div>
          {showingLast && lastWinner !== null && hand.phase !== 'ended' && (
            <p className="caption">{lastWinner === me ? 'Te viszed' : `${name(lastWinner)} viszi`} az ütést</p>
          )}
          {!showingLast && hand.lastTrick && hand.lastTrick.length > 0 && (
            <div className="last-row">
              <small>Előző ütés</small>
              {hand.lastTrick.map((p) => (
                <CardFace key={cardId(p.card)} card={p.card} size="tiny" />
              ))}
            </div>
          )}
        </div>
        {view.settings.mode === '1v1' && hand.stockCount > 0 && (
          <div className="talon" style={{ gridArea: 'left' }} aria-label={`Talon, ${hand.stockCount} lap`}>
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
        <p className="status" aria-live="polite">
          {status}
        </p>

        {hand.phase === 'callTrump' && hand.caller === me && (
          <div className="actions">
            {legal.filter((m): m is Extract<Move, { type: 'callTrump' }> => m.type === 'callTrump').map((m) => (
              <button key={m.suit} className={`btn suit-btn s-${m.suit}`} disabled={busy} onClick={() => send(m)}>
                <SuitIcon suit={m.suit} size={24} /> {SUIT_NAME[m.suit]}
              </button>
            ))}
            {forfeit && (
              <button className="btn danger" disabled={busy} onClick={askForfeit}>
                Feladom (6)
              </button>
            )}
          </div>
        )}

        {hand.phase === 'callCard' && hand.caller === me && (
          <>
            <CardPicker moves={legal} busy={busy} onPick={send} />
            {forfeit && (
              <div className="actions">
                <button className="btn danger" disabled={busy} onClick={askForfeit}>
                  Feladom (6)
                </button>
              </div>
            )}
          </>
        )}

        {hand.phase === 'declare' && hand.turn === me && (
          <div className="actions">
            <button className="btn primary" disabled={busy} onClick={() => send({ type: 'declare', seat: me, kind: 'none' })}>
              Kezdődjön a játék
            </button>
            <button className="btn" disabled={busy} title="66 pontot érsz el, mielőtt a másik oldal ütést nyerne" onClick={() => send({ type: 'declare', seat: me, kind: 'snapszer' })}>
              Snapszer (12)
            </button>
            <button className="btn" disabled={busy} title="Minden ütést megnyersz" onClick={() => send({ type: 'declare', seat: me, kind: 'durko' })}>
              Durch (32)
            </button>
            {forfeit && (
              <button className="btn danger" disabled={busy} title="A többiek 6 ponttal mennek lejjebb" onClick={askForfeit}>
                Feladom (6)
              </button>
            )}
          </div>
        )}

        {hand.phase === 'kontra' && hand.turn === me && (
          <div className="actions">
            <button className="btn kontra" disabled={busy} title="A leosztás dupla pontot ér" onClick={() => send({ type: 'kontra', seat: me, kontra: true })}>
              Kontra (dupla pont)
            </button>
            <button className="btn primary" disabled={busy} onClick={() => send({ type: 'kontra', seat: me, kontra: false })}>
              Játék
            </button>
          </div>
        )}

        {hand.phase === 'play' && (swap || cover || claim || pairSuits.length > 0) && (
          <div className="actions">
            {claim && (
              <button
                className="btn kesz"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('Kész!-t mondasz?\n\nHa a csapatodnak nincs meg a 66 pontja, elveszted a leosztást.')) send(claim);
                }}
              >
                Kész!
              </button>
            )}
            {pairSuits.map((suit) => (
              <button key={suit} className="btn pair" disabled={busy} onClick={() => setPairSuit(suit)}>
                {pairValue(suit)} bemondása <SuitIcon suit={suit} size={20} /> {SUIT_NAME[suit]}
                {suit === hand.trumpSuit ? ' (adutt)' : ''}
              </button>
            ))}
            {swap && (
              <button className="btn" disabled={busy} onClick={() => send(swap)}>
                Adutt alsó cseréje
              </button>
            )}
            {cover && (
              <button className="btn" disabled={busy} onClick={() => send(cover)}>
                Talon betakarása
              </button>
            )}
          </div>
        )}

        {view.me.missed >= 2 && <p className="away">Kétszer lejárt az időd, ezért gyorsan lépünk helyetted. Lépj egyet, hogy átvedd a játékot.</p>}
        <div className={`me-bar ${myDecision ? 'turn' : ''}`}>
          <span>
            <b>{name(me)}</b> · {stats(me)}
          </span>
          {clock(me)}
          <button className="link" onClick={() => setShowTricks(true)}>
            Ütéseim ({hand.tricksWon[me]})
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
              {pending.suit === hand.trumpSuit ? 40 : 20} bemondása és kijátszás
            </button>
            <button
              className="btn"
              disabled={busy}
              onClick={() => {
                send({ type: 'play', seat: me, card: pending });
                setPending(null);
              }}
            >
              Csak kijátszás
            </button>
          </div>
        </Modal>
      )}

      {pairSuit && (
        <Modal onClose={() => setPairSuit(null)} title={`${pairValue(pairSuit)} bemondása – ${SUIT_NAME[pairSuit]}`}>
          <p>Melyik lapot játszod ki? A másikat megmutatod.</p>
          <div className="pair-choice">
            {melds
              .filter((m) => m.card.suit === pairSuit)
              .map((m) => (
                <CardFace
                  key={cardId(m.card)}
                  card={m.card}
                  onClick={() => {
                    send(m);
                    setPairSuit(null);
                  }}
                />
              ))}
          </div>
        </Modal>
      )}

      {showTricks && (
        <Modal onClose={() => setShowTricks(false)} title="Az ütéseid lapjai">
          {hand.myTricks.length === 0 ? (
            <p className="muted">Még nem nyertél ütést.</p>
          ) : (
            <>
              <div className="mini-grid">
                {hand.myTricks.map((c) => (
                  <CardFace key={cardId(c)} card={c} size="tiny" />
                ))}
              </div>
              <p className="hint">Lapok összértéke: {hand.myTricks.reduce((s, c) => s + cardPoints(c), 0)} pont</p>
            </>
          )}
        </Modal>
      )}

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

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
          Bezár
        </button>
      </div>
    </div>
  );
}

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Szabályok röviden" onClose={onClose}>
      <ul className="rules">
        <li>
          <b>Cél:</b> 66 pont összegyűjtése, majd <b>Kész!</b> mondása – vagy ha senki sem mondta, az utolsó ütés megnyerése.
        </li>
        <li>
          <b>Lapértékek:</b> Ász 11, Tízes 10, Király 4, Felső 3, Alsó 2, Kilences 0.
        </li>
        <li>
          <b>Adutt:</b> a hívó által választott szín, minden más színt üt.
        </li>
        <li>
          <b>Kötelező:</b> színt kell követni, és ha lehet, ütni. Ha nincs a színből lapod, aduttot kell tenned, ha az sincs, bármit.
        </li>
        <li>
          <b>20 / 40:</b> Király + Felső együtt a kezedben kihíváskor bemondható: 20 pont, aduttban 40. A pont akkor számít, ha már nyertél ütést.
        </li>
        <li>
          <b>Kész!</b> csak ütés megnyerése után mondható (1v1-ben bemondás után is). Hibás Kész!-nél elveszted a leosztást.
        </li>
        <li>
          <b>Pontozás:</b> a nyertes oldal ennyivel megy lejjebb: 2 (az ellenfélnek legalább 33 pontja volt), 4 (kevesebb, de volt ütése), 6 (ütés nélkül maradt). Snapszer 12, minden ütés 22, Durch 32.
        </li>
        <li>
          <b>Kontra:</b> a hívó ellenfelei kontrázhatnak (2v1, 2v2): a leosztás dupla pontot ér.
        </li>
        <li>
          <b>Feladás:</b> a hívó játék előtt feladhatja: a többiek 6 ponttal mennek lejjebb.
        </li>
        <li>
          <b>Idő:</b> minden döntésre 1 perced van. Ha lejár, lép helyetted a gép.
        </li>
        <li>
          <b>Győzelem:</b> aki először ér nullára.
        </li>
      </ul>
    </Modal>
  );
}

function HandEnd({ view, busy, run, actions, onLeave }: Props) {
  const match = view.match!;
  const hand = match.hand;
  const result = hand.result!;
  const revealed = hand.revealed!;
  const players = view.players;
  const me = view.me.seat;
  const isWinner = (seat: number) => revealed.sides[seat] === result.winnerSide;
  const winnerSeats = revealed.sides.flatMap((_, seat) => (isWinner(seat) ? [seat] : []));
  const iWon = isWinner(me);
  const list = (seats: number[]) => seats.map((s) => (s === me ? 'Te' : players[s]!.name)).join(' és ');
  const matchOver = match.winners !== null;
  const matchWon = matchOver && match.winners!.includes(me);

  const title = matchOver
    ? matchWon
      ? 'Megnyerted a mérkőzést! 🎉'
      : `${list(match.winners!)} nyerte a mérkőzést`
    : iWon
      ? 'Megnyerted a leosztást!'
      : 'Elvesztetted a leosztást';

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="A leosztás véget ért">
      <div className="dialog wide">
        <h2 className={`banner ${(matchOver ? matchWon : iWon) ? 'win' : 'lose'}`}>{title}</h2>
        <p>
          {REASON_TEXT[result.reason]}. <strong>{list(winnerSeats)}</strong> {winnerSeats.length > 1 ? 'mennek' : winnerSeats[0] === me ? 'mész' : 'megy'} lejjebb{' '}
          <strong>{result.amount} ponttal</strong>.
          {result.kontra && <span className="kontra-note"> Kontra volt, ezért dupla pont.</span>}
        </p>

        <table className="result-table">
          <thead>
            <tr>
              <th>Játékos</th>
              {view.settings.mode === '2v2' && <th>Oldal</th>}
              <th>Kártyapont</th>
              <th>Változás</th>
              <th>Hátra</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <tr key={p.id} className={isWinner(i) ? 'won' : 'lost'}>
                <td>
                  <span className="result-badge">{isWinner(i) ? 'NYERT' : 'VESZTETT'}</span> {i === me ? `${p.name} (te)` : p.name}
                </td>
                {view.settings.mode === '2v2' && <td>{isWinner(i) ? 'nyertesek' : 'vesztesek'}</td>}
                <td>{hand.finalPoints?.[i] ?? '–'}</td>
                <td className="delta">{isWinner(i) ? `−${result.amount}` : '0'}</td>
                <td>
                  <b>{match.scores[i]}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="row">
          <button className="btn" onClick={onLeave}>
            Kilépés
          </button>
          {!matchOver && (
            <button className="btn primary" disabled={busy} onClick={() => run(() => actions.nextHand(match.handNumber))}>
              Következő leosztás
            </button>
          )}
          {matchOver && view.me.isHost && (
            <button className="btn primary" disabled={busy} onClick={() => run(actions.rematch)}>
              Visszavágó
            </button>
          )}
        </div>
        {matchOver && !view.me.isHost && <p className="hint">Várakozás, hogy a gazda visszavágót indítson…</p>}
      </div>
    </div>
  );
}
