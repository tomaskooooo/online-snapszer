import { useEffect, useMemo, useRef, useState } from 'react';
import { cardId, cardPoints, currentWinner, rankIndex, sameCard, type Card, type LobbyView, type Move, type Suit } from '../src';
import { CardBack, CardFace, SuitIcon, cardLabel } from './Card';
import { FolkBorder, PalinkaSet, PlatePair, Pogacsa, Shelf, TulipJug } from './Folk';
import { Hand, type DragState } from './Hand';
import { REASON_TEXT, SUIT_NAME, tricksText } from './labels';
import { formatClock, useCountdown } from './useCountdown';

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
  const me = view.me.seat;
  const [pending, setPending] = useState<Card | null>(null);
  const [pairSuit, setPairSuit] = useState<Suit | null>(null);
  const [showTricks, setShowTricks] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [enoughOn, setEnoughOn] = useState(false);
  const [manual, setManual] = useState<string[] | null>(null);
  const [dragState, setDragState] = useState<DragState>('idle');
  const [notice, setNotice] = useState('');
  const secondsLeft = useCountdown(view.turnDeadline, view.serverTime);

  // A freshly declared 20 or 40 gets a full-screen celebration for everybody at the table.
  const meld = hand.lastMeld;
  const meldKey = meld ? `${match.handNumber}:${meld.trick}` : null;
  const seenMeld = useRef<string | null | undefined>(undefined);
  const [celebration, setCelebration] = useState<NonNullable<typeof meld> | null>(null);
  useEffect(() => {
    // The first render only records what is already there, so a reload does not replay old news.
    const isNew = seenMeld.current !== undefined && meldKey !== null && meldKey !== seenMeld.current;
    seenMeld.current = meldKey;
    if (!isNew || !meld) return;
    setCelebration(meld);
    const timer = setTimeout(() => setCelebration(null), 3400);
    return () => clearTimeout(timer);
  }, [meldKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setManual(null), [match.handNumber]);

  const name = (seat: number) => players[seat]?.name ?? '?';
  // Players who already went down to zero watch from the side; the others sit around the table.
  const active = hand.activeSeats;
  const iPlay = active.includes(me);
  const place = (seat: number) => match.out.indexOf(seat) + 1;

  const clock = (seat: number) =>
    hand.turn === seat && hand.phase !== 'ended' && secondsLeft !== null ? (
      <span className={`clock ${secondsLeft <= 10 ? 'low' : ''}`} role="timer" aria-label={`${secondsLeft} másodperc van hátra`}>
        ⏱ {formatClock(secondsLeft)}
      </span>
    ) : null;

  const legal = hand.legalMoves;
  const plays = legal.filter((m): m is PlayMove => m.type === 'play');
  const playable = new Set(plays.filter((m) => !m.meld).map((m) => cardId(m.card)));
  const melds = plays.filter((m) => m.meld && !m.enough);
  const enoughMoves = plays.filter((m) => m.enough);
  const pairSuits = [...new Set(melds.map((m) => m.card.suit))] as Suit[];
  const isMyTurn = hand.phase === 'play' && hand.turn === me;
  const myDecision = hand.turn === me && hand.phase !== 'ended';
  const send = (move: Move) => run(() => actions.move({ ...move, seat: me }));

  // A card dropped on the table. Kings and Felsős that can form a pair ask how to play them first.
  const playCard = (card: Card) => {
    if (!isMyTurn || !playable.has(cardId(card))) return;
    if (melds.some((m) => sameCard(m.card, card))) setPending(card);
    else send({ type: 'play', seat: me, card });
  };
  const rejectCard = () => {
    setNotice(isMyTurn ? 'Ezt a lapot most nem játszhatod ki.' : 'Most nem te jössz.');
    setTimeout(() => setNotice(''), 2500);
  };
  const askEnough = (m: Move) => {
    if (window.confirm('Elég!-et mondasz?\n\nHa a csapatodnak a bemondással sincs meg a 66 pontja, elveszted a leosztást.')) send(m);
  };

  // Cards are shown in the order the player dragged them into, or sorted (adutt first) by default.
  const sortedHand = useMemo(() => {
    const suits: Suit[] = ['tok', 'zold', 'piros', 'makk'];
    const order = hand.trumpSuit ? [hand.trumpSuit, ...suits.filter((x) => x !== hand.trumpSuit)] : suits;
    return [...hand.myHand].sort((a, b) => order.indexOf(a.suit) - order.indexOf(b.suit) || rankIndex(b) - rankIndex(a));
  }, [hand.myHand, hand.trumpSuit]);
  const shownHand = useMemo(() => {
    if (!manual) return sortedHand;
    const byId = new Map(sortedHand.map((c) => [cardId(c), c]));
    const kept = manual.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
    return [...kept, ...sortedHand.filter((c) => !manual.includes(cardId(c)))];
  }, [manual, sortedHand]);

  const trickCards = hand.trick.length > 0 ? hand.trick : (hand.lastTrick ?? []);
  const showingLast = hand.trick.length === 0 && trickCards.length > 0;
  const lastWinner = hand.lastTrick && hand.lastTrick.length > 0 ? currentWinner(hand.lastTrick, hand.trumpSuit).seat : null;
  const decl = hand.declaration;
  const calledHeld = hand.calledCard ? hand.myHand.some((c) => sameCard(c, hand.calledCard!)) : false;

  const claim = legal.find((m) => m.type === 'claim');
  const forfeit = legal.find((m) => m.type === 'forfeit');
  const canKontra = legal.some((m) => m.type === 'kontra' && m.kontra);
  const pairValue = (suit: Suit) => (suit === hand.trumpSuit ? 40 : 20);

  const askForfeit = () => {
    if (forfeit && window.confirm('Feladod a leosztást?\n\nA többiek mindegyike 6 ponttal megy lejjebb.')) send(forfeit);
  };

  // ---- status line ------------------------------------------------------
  let status = '';
  if (hand.phase === 'callTrump') {
    status = hand.caller === me ? 'Te vagy a hívó: válaszd ki az aduttot.' : `${name(hand.caller)} aduttot választ…`;
  } else if (hand.phase === 'callCard') {
    status = hand.caller === me ? '' : `${name(hand.caller)} lapot nevez meg…`;
  } else if (hand.phase === 'declare') {
    status = hand.turn === me ? 'Bemondhatsz Snapszert vagy Durchot, vagy kezdődhet a játék.' : `${name(hand.turn)} dönt a bemondásról…`;
  } else if (hand.phase === 'kontra') {
    status =
      hand.turn === me
        ? canKontra
          ? `Kontrázol, vagy játszol? (${name(hand.caller)} a hívó)`
          : 'A hívó csapatában vagy, ezért nem kontrázhatsz. Nyomd meg a Játék gombot.'
        : `${name(hand.turn)} dönt: kontra vagy játék…`;
  } else if (hand.phase === 'play') {
    if (isMyTurn) {
      status = playable.size < hand.myHand.length && hand.trick.length > 0 ? 'Te jössz. Húzd az asztalra az egyik kiemelt lapot.' : 'Te jössz. Húzd a lapot az asztalra.';
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
    <div key={seat} className={`opp ${hand.turn === seat && hand.phase !== 'ended' ? 'turn' : ''}`}>
      <div className="opp-name">
        {players[seat]!.bot && <span aria-hidden>🤖 </span>}
        {name(seat)}
        {hand.caller === seat && <span className="tag">hívó</span>}
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

  // The other players in the order they sit after me.
  const myIndex = active.indexOf(me);
  const around = iPlay ? [...active.slice(myIndex + 1), ...active.slice(0, myIndex)] : active;
  const opponents = around.map(opponent);

  const playersList = (
    <ul className="players" aria-label="Játékosok">
      {players.map((p, i) => {
        const left = match.out.includes(i);
        const inHand = active.includes(i);
        const turn = inHand && hand.turn === i && hand.phase !== 'ended';
        return (
          <li key={p.id} className={`pl ${i === me ? 'me' : ''} ${turn ? 'turn' : ''} ${left ? 'left' : ''}`}>
            <span className="pl-avatar" aria-hidden>
              {p.bot ? '🤖' : p.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="pl-main">
              <b>{i === me ? `${p.name} (te)` : p.name}</b>
              <span className="pl-tags">
                {inHand && hand.caller === i && <span className="tag">hívó</span>}
                {hand.kontra === i && <span className="tag kontra">kontra</span>}
                {left && <span className="tag ok">{place(i)}. hely</span>}
              </span>
              {inHand && <small>{stats(i)}</small>}
            </span>
            <span className="pl-score">
              <b>{left ? '✓' : match.scores[i]}</b>
              <small>hátra</small>
            </span>
            {turn && clock(i)}
          </li>
        );
      })}
    </ul>
  );

  const infoPanel = (
    <div className="info">
      <div className="info-adu" aria-label="Adutt">
        <span className="info-label">Adutt</span>
        {hand.trumpSuit ? (
          <>
            <SuitIcon suit={hand.trumpSuit} size={92} />
            <b>{SUIT_NAME[hand.trumpSuit]}</b>
          </>
        ) : (
          <span className="info-none">{hand.special ? 'nincs adutt' : 'még nincs'}</span>
        )}
      </div>
      {hand.special && <p className="info-note">Döntő kör: aki az utolsó ütést viszi, az nyer.</p>}
      {hand.teamPoints !== null && hand.phase !== 'ended' && (
        <div className={`info-team ${hand.teamPoints >= 66 ? 'enough' : ''}`}>
          <span className="info-label">{hand.mode === '1v1' ? 'Pontjaid' : 'A csapatod pontja'}</span>
          <b>
            {hand.teamPoints} <small>/ 66</small>
          </b>
        </div>
      )}
      {hand.mode === '2v2' && !hand.special && !hand.claimsOpen && hand.phase !== 'ended' && (
        <p className="info-note">Elég!-et csak a hívott lap kijátszása után lehet mondani.</p>
      )}
      <p className="info-meta">
        {hand.mode} · {match.handNumber}. leosztás
      </p>
      {(decl || hand.kontra !== null) && (
        <div className="info-flags">
          {decl && (
            <span className="chip warn">
              {name(decl.by)}: {decl.kind === 'snapszer' ? 'Snapszer' : 'Durch'}!
            </span>
          )}
          {hand.kontra !== null && <span className="chip warn">Kontra: {name(hand.kontra)} (dupla pont)</span>}
        </div>
      )}
      {hand.calledCard && (
        <div className="info-box">
          <span className="info-label">Hívott lap</span>
          <CardFace card={hand.calledCard} size="small" />
        </div>
      )}
      {hand.lastTrick && hand.lastTrick.length > 0 && (
        <div className="info-box">
          <span className="info-label">{hand.trick.length === 0 ? 'Utolsó ütés' : 'Előző ütés'}</span>
          <div className="mini-row">
            {hand.lastTrick.map((p) => (
              <CardFace key={cardId(p.card)} card={p.card} size="tiny" />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="table-screen">
      <header className="topbar">
        <span className="brand">Snapszer <em>online</em></span>
        <div className="scores" aria-label="Hátralévő pontok">
          {players.map((p, i) => {
            const left = match.out.includes(i);
            return (
              <span key={p.id} className={`score ${i === me ? 'me' : ''} ${left ? 'left' : ''}`}>
                <small>{i === me ? `${p.name} (te)` : p.name}</small>
                <b>{left ? '✓' : match.scores[i]}</b>
                {left && <em>{place(i)}. hely</em>}
              </span>
            );
          })}
        </div>
        <div className="meta">
          <span>
            {hand.mode} · {match.handNumber}. leosztás
          </span>
          <button className="link" onClick={() => setShowRules(true)}>
            Szabályok
          </button>
          <button className="link" onClick={onLeave}>
            Kilépés
          </button>
        </div>
      </header>
      <FolkBorder />

      <div className="stage">
      <aside className="side side-left" aria-label="Játékosok">
        <PlatePair />
        {playersList}
        <Shelf>
          <TulipJug className="shelf-jug" />
        </Shelf>
      </aside>

      <div className="board">
        <div className="opps">{opponents}</div>

        <div className="chips">
          {hand.trumpSuit && (
            <span className={`chip adu s-${hand.trumpSuit}`}>
              Adutt: <SuitIcon suit={hand.trumpSuit} size={34} /> <b>{SUIT_NAME[hand.trumpSuit]}</b>
            </span>
          )}
          {decl && (
            <span className="chip warn">
              {name(decl.by)}: {decl.kind === 'snapszer' ? 'Snapszer' : 'Durch'}!
            </span>
          )}
          {hand.kontra !== null && <span className="chip warn">Kontra: {name(hand.kontra)} (dupla pont)</span>}
          {hand.calledCard && (
            <span className="chip called">
              Hívott lap: <CardFace card={hand.calledCard} size="tiny" />
            </span>
          )}
        </div>

        {hand.phase === 'callCard' && hand.caller === me ? (
          <div className="call-panel">
            <p className="call-title">Nevezz meg egy lapot</p>
            <p className="call-help">A színe lesz az adutt. Akinél az a lap van, az a titkos társad; ha a sajátodat nevezed meg, egyedül játszol.</p>
            <CardPicker moves={legal} busy={busy} onPick={send} />
          </div>
        ) : (
        <div className={`table-top drop-${dragState}`} data-dropzone="table">
          {hand.trumpSuit && <SuitIcon suit={hand.trumpSuit} size="46%" className="table-adu" />}
          <div className={`trick ${showingLast ? 'last' : ''}`}>
            {trickCards.map((p) => (
              <div key={`${p.seat}-${cardId(p.card)}`} className={`slot ${showingLast && p.seat === lastWinner ? 'won' : ''}`}>
                <CardFace card={p.card} />
                <small>{p.seat === me ? 'te' : name(p.seat)}</small>
              </div>
            ))}
            {trickCards.length === 0 && <p className="table-hint">{isMyTurn ? 'Húzd ide a lapot' : 'Az asztal üres'}</p>}
          </div>
          {showingLast && lastWinner !== null && hand.phase !== 'ended' && (
            <p className="caption">{lastWinner === me ? 'Te viszed' : `${name(lastWinner)} viszi`} az ütést</p>
          )}
        </div>
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

      <section className="dock">
        {role && <p className="role">{role}</p>}
        {status && (
          <p className="status" aria-live="polite">
            {status}
          </p>
        )}

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
            {canKontra && (
              <button className="btn kontra" disabled={busy} title="A leosztás dupla pontot ér" onClick={() => send({ type: 'kontra', seat: me, kontra: true })}>
                Kontra (dupla pont)
              </button>
            )}
            <button className="btn primary" disabled={busy} onClick={() => send({ type: 'kontra', seat: me, kontra: false })}>
              Játék
            </button>
          </div>
        )}

        {hand.phase === 'play' && (claim || pairSuits.length > 0) && (
          <div className="actions">
            {claim && (
              <button
                className="btn kesz"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('Elég!-et mondasz?\n\nHa a csapatodnak nincs meg a 66 pontja, elveszted a leosztást.')) send(claim);
                }}
              >
                Elég!
              </button>
            )}
            {pairSuits.map((suit) => (
              <button key={suit} className="btn pair" disabled={busy} onClick={() => setPairSuit(suit)}>
                {pairValue(suit)} bemondása <SuitIcon suit={suit} size={20} /> {SUIT_NAME[suit]}
                {suit === hand.trumpSuit ? ' (adutt)' : ''}
              </button>
            ))}
          </div>
        )}

        {!iPlay && (
          <p className="role">
            Már kimentél a játékból ({place(me)}. hely). Nézheted, ahogy a többiek játszanak tovább.
          </p>
        )}
        {view.me.missed >= 2 && <p className="away">Kétszer lejárt az időd, ezért gyorsan lépünk helyetted. Lépj egyet, hogy átvedd a játékot.</p>}
        {iPlay && (
        <div className={`me-bar ${myDecision ? 'turn' : ''}`}>
          <span>
            <b>{name(me)}</b> · {stats(me)}
            {(hand.pendingPoints?.[me] ?? 0) > 0 && <em className="pending"> (+{hand.pendingPoints![me]} függőben: számít, ha ütést nyersz)</em>}
          </span>
          {clock(me)}
          <button className="link" onClick={() => setManual(null)} title="Lapok rendezése: adutt elöl, színek és értékek szerint">
            Rendezés
          </button>
          <button className="link" onClick={() => setShowTricks(true)}>
            Ütéseim ({hand.tricksWon[me]})
          </button>
        </div>
        )}

        {notice && <p className="away">{notice}</p>}
        {iPlay && (
          <Hand
            cards={shownHand}
            playable={playable}
            canPlay={isMyTurn}
            onReorder={setManual}
            onPlay={playCard}
            onReject={rejectCard}
            onDragState={setDragState}
          />
        )}
      </section>

      <aside className="side side-right" aria-label="Játékinformáció">
        {infoPanel}
        <Shelf>
          <PalinkaSet className="shelf-palinka" />
          <Pogacsa className="shelf-pogacsa" />
        </Shelf>
      </aside>
      </div>

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
            {enoughMoves.some((m) => sameCard(m.card, pending)) && (
              <button
                className="btn kesz"
                disabled={busy}
                onClick={() => {
                  const m = enoughMoves.find((x) => sameCard(x.card, pending));
                  setPending(null);
                  if (m) askEnough(m);
                }}
              >
                {pending.suit === hand.trumpSuit ? 40 : 20} bemondása – Elég!
              </button>
            )}
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
        <Modal
          onClose={() => {
            setPairSuit(null);
            setEnoughOn(false);
          }}
          title={`${pairValue(pairSuit)} bemondása – ${SUIT_NAME[pairSuit]}`}>
          <p>Melyik lapot játszod ki? A másikat megmutatod.</p>
          {enoughMoves.length > 0 && (
            <label className="switch">
              <input type="checkbox" checked={enoughOn} onChange={(e) => setEnoughOn(e.target.checked)} />
              <span>Elég! – a bemondással meglesz a 66 pont</span>
            </label>
          )}
          <div className="pair-choice">
            {melds
              .filter((m) => m.card.suit === pairSuit)
              .map((m) => (
                <CardFace
                  key={cardId(m.card)}
                  card={m.card}
                  onClick={() => {
                    const chosen = enoughOn ? enoughMoves.find((x) => sameCard(x.card, m.card)) : m;
                    setPairSuit(null);
                    setEnoughOn(false);
                    if (!chosen) return;
                    if (enoughOn) askEnough(chosen);
                    else send(chosen);
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

      {celebration && (
        <MeldCelebration
          key={`${match.handNumber}:${celebration.trick}`}
          points={celebration.points}
          suit={celebration.suit}
          text={`${celebration.points === 40 ? 'Negyvenet' : 'Húszat'} ${celebration.seat === me ? 'hívtál' : 'hívott'}!`}
          who={celebration.seat === me ? null : name(celebration.seat)}
        />
      )}

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {hand.phase === 'ended' && <HandEnd view={view} busy={busy} run={run} actions={actions} onLeave={onLeave} />}
    </div>
  );
}

const CONFETTI_COLORS = ['#f2b84b', '#e5484d', '#3fb950', '#58a6ff', '#d2a8ff', '#ffffff'];

/** Full-screen "húszat hívott!" burst. It ignores clicks, so the game underneath stays usable. */
function MeldCelebration({ points, suit, text, who }: { points: number; suit: Suit; text: string; who: string | null }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: points === 40 ? 150 : 80 }, (_, i) => ({
        id: i,
        style: {
          '--x': `${Math.random() * 100}vw`,
          '--dx': `${(Math.random() - 0.5) * 30}vw`,
          '--r': `${360 + Math.random() * 720}deg`,
          '--d': `${2.2 + Math.random() * 1.6}s`,
          '--delay': `${Math.random() * 0.7}s`,
          '--c': CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          width: `${7 + Math.random() * 8}px`,
          height: `${10 + Math.random() * 10}px`,
        } as React.CSSProperties,
      })),
    [points],
  );

  return (
    <div className={`meld-fx ${points === 40 ? 'forty' : ''}`} role="status" aria-live="assertive">
      <div className="confetti" aria-hidden>
        {pieces.map((p) => (
          <i key={p.id} style={p.style} />
        ))}
      </div>
      <div className="meld-card">
        <span className="meld-num">{points}</span>
        <SuitIcon suit={suit} size={46} />
        {who && <b className="meld-who">{who}</b>}
        <p>{text}</p>
      </div>
    </div>
  );
}

function CardPicker({ moves, busy, onPick }: { moves: Move[]; busy: boolean; onPick: (m: Move) => void }) {
  const suits: Suit[] = ['tok', 'zold', 'piros', 'makk'];
  const calls = moves
    .filter((m): m is Extract<Move, { type: 'callCard' }> => m.type === 'callCard')
    .sort((x, y) => suits.indexOf(x.card.suit) - suits.indexOf(y.card.suit) || rankIndex(y.card) - rankIndex(x.card));
  return (
    <div className="picker">
      {calls.map((m) => (
        <CardFace key={cardId(m.card)} card={m.card} size="tiny" onClick={busy ? undefined : () => onPick(m)} />
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
          <b>Játék:</b> a lapot húzd az asztalra, úgy játszod ki. A kezedben húzással rendezheted a lapokat, a „Rendezés" gomb pedig sorba teszi őket.
        </li>
        <li>
          <b>Cél:</b> 66 pont összegyűjtése, majd <b>Elég!</b> mondása – vagy ha senki sem mondta, az utolsó ütés megnyerése.
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
          <b>Elég!</b> ütés megnyerése után mondható, vagy közvetlenül egy 20/40 bemondásakor (ha a bemondott pont is kell a 66-hoz). 2v2-ben csak azután, hogy a hívott lap kiment. Hibás Elég!-nél elveszted a leosztást.
        </li>
        <li>
          <b>Pontozás:</b> a nyertes oldal ennyivel megy lejjebb: 2 (az ellenfélnek legalább 33 pontja volt), 4 (kevesebb, de volt ütése), 6 (ütés nélkül maradt). Snapszer 12, minden ütés 22, Durch 32.
        </li>
        <li>
          <b>Kontra:</b> a hívó ellenfelei kontrázhatnak: a leosztás dupla pontot ér. A hívó társa nem kontrázhat.
        </li>
        <li>
          <b>Feladás:</b> a hívó játék előtt feladhatja: a többiek 6 ponttal mennek lejjebb.
        </li>
        <li>
          <b>Idő:</b> minden döntésre 1 perced van. Ha lejár, lép helyetted a gép.
        </li>
        <li>
          <b>Győzelem:</b> aki először ér nullára; a többiek 1v1-ben, 2v1-ben tovább játszanak. Ha ketten maradnak, és mindkettőnek 10 pontnál több van hátra, egy adutt nélküli kör dönt: aki az utolsó ütést viszi, az végez előrébb.
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
  const played = (seat: number) => hand.activeSeats.includes(seat);
  const isWinner = (seat: number) => played(seat) && revealed.sides[seat] === result.winnerSide;
  const winnerSeats = players.flatMap((_, seat) => (isWinner(seat) ? [seat] : []));
  const iPlayed = played(me);
  const iWon = isWinner(me);
  const list = (seats: number[]) => seats.map((s) => (s === me ? 'Te' : players[s]!.name)).join(' és ');
  const place = (seat: number) => (match.ranking ?? match.out).indexOf(seat) + 1;
  const matchOver = match.over;
  const champion = match.ranking?.[0];
  const matchWon = matchOver && champion === me;
  const remaining = hand.activeSeats.length - match.lastOut.length;
  const nextMode = remaining === 2 ? 'egy az egy ellen' : remaining === 3 ? '3 játékossal (2v1)' : '4 játékossal (2v2)';

  const title = matchOver
    ? matchWon
      ? 'Megnyerted a mérkőzést! 🎉'
      : `${list([champion!])} nyerte a mérkőzést`
    : !iPlayed
      ? 'A leosztás véget ért'
      : iWon
        ? 'Megnyerted a leosztást!'
        : 'Elvesztetted a leosztást';
  const tone = matchOver ? (matchWon ? 'win' : 'lose') : !iPlayed ? 'neutral' : iWon ? 'win' : 'lose';

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="A leosztás véget ért">
      <div className="dialog wide">
        <h2 className={`banner ${tone}`}>{title}</h2>
        <p>
          {result.reason === 'decider' ? (
            <>
              {REASON_TEXT.decider}. <strong>{list(winnerSeats)}</strong> {winnerSeats[0] === me ? 'vitted' : 'vitte'} az utolsó ütést, ezért {winnerSeats[0] === me ? 'te végeztél' : 'ő végzett'} előrébb.
            </>
          ) : (
            <>
              {REASON_TEXT[result.reason]}. <strong>{list(winnerSeats)}</strong> {winnerSeats.length > 1 ? 'mennek' : winnerSeats[0] === me ? 'mész' : 'megy'} lejjebb{' '}
              <strong>{result.amount} ponttal</strong>.
              {result.kontra && <span className="kontra-note"> Kontra volt, ezért dupla pont.</span>}
            </>
          )}
        </p>

        {match.lastOut.length > 0 && (
          <p className="exit-note">
            🏁 <strong>{list(match.lastOut)}</strong> {match.lastOut.length > 1 ? 'kimentek' : match.lastOut[0] === me ? 'kimentél' : 'kiment'} (
            {match.lastOut.map((s) => `${place(s)}.`).join(', ')} hely).
            {!matchOver && ` A többiek ${nextMode} játsszák le a maradék pontokat.`}
          </p>
        )}

        <table className="result-table">
          <thead>
            <tr>
              <th>Játékos</th>
              {hand.mode === '2v2' && <th>Oldal</th>}
              <th>Kártyapont</th>
              <th>Változás</th>
              <th>Hátra</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => {
              const left = match.out.includes(i);
              const cls = !played(i) ? 'idle' : isWinner(i) ? 'won' : 'lost';
              return (
                <tr key={p.id} className={cls}>
                  <td>
                    <span className="result-badge">{!played(i) ? 'KINT' : isWinner(i) ? 'NYERT' : 'VESZTETT'}</span> {i === me ? `${p.name} (te)` : p.name}
                  </td>
                  {hand.mode === '2v2' && <td>{!played(i) ? '–' : isWinner(i) ? 'nyertesek' : 'vesztesek'}</td>}
                  <td>{played(i) ? (hand.finalPoints?.[i] ?? '–') : '–'}</td>
                  <td className="delta">{!played(i) || result.reason === 'decider' ? '–' : isWinner(i) ? `−${result.amount}` : '0'}</td>
                  <td>{left ? <b>✓ {place(i)}. hely</b> : <b>{match.scores[i]}</b>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {matchOver && match.ranking && (
          <ol className="ranking" aria-label="Végeredmény">
            {match.ranking.map((seat, idx) => (
              <li key={seat} className={idx === 0 ? 'first' : idx === match.ranking!.length - 1 ? 'last' : ''}>
                {seat === me ? 'Te' : players[seat]!.name}
                {idx === match.ranking!.length - 1 && <em> – {seat === me ? 'te maradtál a végére' : 'ő maradt a végére'}</em>}
              </li>
            ))}
          </ol>
        )}

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
