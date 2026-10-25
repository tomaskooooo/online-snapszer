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
        <p className="eyebrow">Invite code</p>
        <div className="code-display" aria-label={`Lobby code ${view.code.split('').join(' ')}`}>
          {view.code}
        </div>
        <div className="row">
          <button className="btn" onClick={() => copy('code')}>
            {copied === 'code' ? 'Copied!' : 'Copy code'}
          </button>
          <button className="btn" onClick={() => copy('link')}>
            {copied === 'link' ? 'Copied!' : 'Copy invite link'}
          </button>
        </div>

        <h3>
          Players <span className="muted">{view.players.length}/{view.needed}</span>
        </h3>
        <ul className="seats">
          {Array.from({ length: view.needed }, (_, i) => {
            const p = view.players[i];
            return p ? (
              <li key={p.id} className="seat filled">
                <span className="avatar">{p.bot ? '🤖' : p.name.slice(0, 1).toUpperCase()}</span>
                <span className="who">
                  {p.name}
                  {p.id === view.me.id && <em> (you)</em>}
                </span>
                {p.isHost && <span className="tag">host</span>}
                {p.bot && <span className="tag">bot</span>}
                {isHost && !p.isHost && (
                  <button className="icon-btn" disabled={busy} onClick={() => run(() => actions.remove(p.id))} aria-label={`Remove ${p.name}`}>
                    ✕
                  </button>
                )}
              </li>
            ) : (
              <li key={`empty-${i}`} className="seat empty">
                <span className="avatar">?</span>
                <span className="who">Waiting for a player…</span>
              </li>
            );
          })}
        </ul>

        <h3>Game</h3>
        {isHost ? (
          <div className="stack tight">
            <div className="segmented" role="group" aria-label="Game mode">
              {(Object.keys(MODE_INFO) as Mode[]).map((m) => (
                <button key={m} type="button" className={view.settings.mode === m ? 'on' : ''} disabled={busy || view.players.length > MODE_INFO[m].players} onClick={() => run(() => actions.settings({ mode: m }))}>
                  {MODE_INFO[m].title}
                </button>
              ))}
            </div>
            <div className="segmented" role="group" aria-label="Starting score">
              {SCORES.map((s) => (
                <button key={s} type="button" className={view.settings.startScore === s ? 'on' : ''} disabled={busy} onClick={() => run(() => actions.settings({ startScore: s }))}>
                  {s}
                </button>
              ))}
            </div>
            <label className="switch">
              <input type="checkbox" checked={view.settings.showPoints} disabled={busy} onChange={(e) => run(() => actions.settings({ showPoints: e.target.checked }))} />
              <span>Show card point counts</span>
            </label>
          </div>
        ) : (
          <ul className="facts">
            <li>Mode: <strong>{view.settings.mode}</strong> ({MODE_INFO[view.settings.mode].players} players)</li>
            <li>Counting down from <strong>{view.settings.startScore}</strong></li>
            <li>Point counts: <strong>{view.settings.showPoints ? 'shown' : 'hidden'}</strong></li>
          </ul>
        )}
        <p className="hint">{MODE_INFO[view.settings.mode].blurb}</p>

        <div className="row">
          <button className="btn" onClick={onLeave}>
            Leave
          </button>
          {isHost && (
            <>
              <button className="btn" disabled={busy || full} onClick={() => run(actions.addBot)}>
                Add bot
              </button>
              <button className="btn primary" disabled={busy || !full} onClick={() => run(actions.start)}>
                Start game
              </button>
            </>
          )}
        </div>
        {!isHost && <p className="hint">Waiting for the host to start the game…</p>}
        {isHost && !full && <p className="hint">Send the code to your friends, or add bots to fill empty seats.</p>}
      </div>
    </main>
  );
}
