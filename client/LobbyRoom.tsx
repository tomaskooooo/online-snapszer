import { useState } from 'react';
import type { LobbyView, Mode, StartScore } from '../src';
import { MODE_INFO } from './labels';

interface Props {
  view: LobbyView;
  busy: boolean;
  run: (action: () => Promise<{ view: LobbyView }>) => void;
  actions: {
    settings: (s: { mode?: Mode; startScore?: StartScore; showPoints?: boolean }) => Promise<{ view: LobbyView }>;
    addBot: () => Promise<{ view: LobbyView }>;
    remove: (playerId: string) => Promise<{ view: LobbyView }>;
    start: () => Promise<{ view: LobbyView }>;
  };
  onLeave: () => void;
}

const SCORES: StartScore[] = [30, 40, 50, 60];

export function LobbyRoom({ view, busy, run, actions, onLeave }: Props) {
  const [copied, setCopied] = useState('');
  const isHost = view.me.isHost;
  const full = view.players.length === view.needed;
  const inviteUrl = `${location.origin}${location.pathname}#/${view.code}`;

  const copy = async (what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(what === 'code' ? view.code : inviteUrl);
      setCopied(what);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      setCopied('');
    }
  };

  return (
    <main className="page">
      <div className="panel">
        <p className="eyebrow">Meghívó kód</p>
        <div className="code-display" aria-label={`Szoba kódja: ${view.code.split('').join(' ')}`}>
          {view.code}
        </div>
        <div className="row">
          <button className="btn" onClick={() => copy('code')}>
            {copied === 'code' ? 'Másolva!' : 'Kód másolása'}
          </button>
          <button className="btn" onClick={() => copy('link')}>
            {copied === 'link' ? 'Másolva!' : 'Meghívó link másolása'}
          </button>
        </div>

        <h3>
          Játékosok <span className="muted">{view.players.length}/{view.needed}</span>
        </h3>
        <ul className="seats">
          {Array.from({ length: view.needed }, (_, i) => {
            const p = view.players[i];
            return p ? (
              <li key={p.id} className="seat filled">
                <span className="avatar">{p.bot ? '🤖' : p.name.slice(0, 1).toUpperCase()}</span>
                <span className="who">
                  {p.name}
                  {p.id === view.me.id && <em> (te)</em>}
                </span>
                {p.isHost && <span className="tag">gazda</span>}
                {p.bot && <span className="tag">bot</span>}
                {isHost && !p.isHost && (
                  <button className="icon-btn" disabled={busy} onClick={() => run(() => actions.remove(p.id))} aria-label={`${p.name} eltávolítása`}>
                    ✕
                  </button>
                )}
              </li>
            ) : (
              <li key={`empty-${i}`} className="seat empty">
                <span className="avatar">?</span>
                <span className="who">Várakozás játékosra…</span>
              </li>
            );
          })}
        </ul>

        <h3>Játék</h3>
        {isHost ? (
          <div className="stack tight">
            <div className="segmented" role="group" aria-label="Játékmód">
              {(Object.keys(MODE_INFO) as Mode[]).map((m) => (
                <button key={m} type="button" className={view.settings.mode === m ? 'on' : ''} disabled={busy || view.players.length > MODE_INFO[m].players} onClick={() => run(() => actions.settings({ mode: m }))}>
                  {MODE_INFO[m].title}
                </button>
              ))}
            </div>
            <div className="segmented" role="group" aria-label="Kezdőpontszám">
              {SCORES.map((s) => (
                <button key={s} type="button" className={view.settings.startScore === s ? 'on' : ''} disabled={busy} onClick={() => run(() => actions.settings({ startScore: s }))}>
                  {s}
                </button>
              ))}
            </div>
            <label className="switch">
              <input type="checkbox" checked={view.settings.showPoints} disabled={busy} onChange={(e) => run(() => actions.settings({ showPoints: e.target.checked }))} />
              <span>Kártyapontok mutatása</span>
            </label>
          </div>
        ) : (
          <ul className="facts">
            <li>Mód: <strong>{view.settings.mode}</strong> ({MODE_INFO[view.settings.mode].players} játékos)</li>
            <li>Visszaszámolás ennyiről: <strong>{view.settings.startScore}</strong></li>
            <li>Kártyapontok: <strong>{view.settings.showPoints ? 'láthatók' : 'rejtettek'}</strong></li>
          </ul>
        )}
        <p className="hint">{MODE_INFO[view.settings.mode].blurb}</p>

        <div className="row">
          <button className="btn" onClick={onLeave}>
            Kilépés
          </button>
          {isHost && (
            <>
              <button className="btn" disabled={busy || full} onClick={() => run(actions.addBot)}>
                Bot hozzáadása
              </button>
              <button className="btn primary" disabled={busy || !full} onClick={() => run(actions.start)}>
                Játék indítása
              </button>
            </>
          )}
        </div>
        {!isHost && <p className="hint">Várakozás, hogy a gazda elindítsa a játékot…</p>}
        {isHost && !full && <p className="hint">Küldd el a kódot a barátaidnak, vagy tölts fel üres helyeket botokkal.</p>}
      </div>
    </main>
  );
}
