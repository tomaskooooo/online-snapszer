import { useState } from 'react';
import type { Mode, StartScore } from '../src';
import { api } from './api';
import { MODE_INFO } from './labels';
import { lastName, saveSession } from './session';

export function Home({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  return (
    <main className="page center">
      <h1 className="logo">
        Snapszer <span>online</span>
      </h1>
      <p className="lead">Játszd a magyar kártyajátékot a barátaiddal, regisztráció nélkül.</p>
      <div className="stack">
        <button className="btn primary big" onClick={onCreate}>
          Szoba létrehozása
        </button>
        <button className="btn big" onClick={onJoin}>
          Csatlakozás kóddal
        </button>
      </div>
    </main>
  );
}

const SCORES: StartScore[] = [30, 40, 50, 60];

export function CreateForm({ onBack, onDone }: { onBack: () => void; onDone: (code: string) => void }) {
  const [name, setName] = useState(lastName());
  const [mode, setMode] = useState<Mode>('1v1');
  const [startScore, setStartScore] = useState<StartScore>(40);
  const [showPoints, setShowPoints] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.create({ name, mode, startScore, showPoints });
      saveSession(res.code, { playerId: res.playerId, token: res.token, name: name.trim() });
      onDone(res.code);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <form className="panel" onSubmit={submit}>
        <h2>Szoba létrehozása</h2>
        <label className="field">
          <span>A neved</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoFocus autoComplete="nickname" required />
        </label>

        <fieldset className="field">
          <legend>Játékmód</legend>
          <div className="choices">
            {(Object.keys(MODE_INFO) as Mode[]).map((m) => (
              <label key={m} className={`choice ${mode === m ? 'on' : ''}`}>
                <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />
                <strong>{MODE_INFO[m].title}</strong>
                <small>{MODE_INFO[m].players} játékos</small>
                <em>{MODE_INFO[m].blurb}</em>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Ennyiről számolunk vissza nullára</legend>
          <div className="segmented">
            {SCORES.map((s) => (
              <label key={s} className={startScore === s ? 'on' : ''}>
                <input type="radio" name="score" checked={startScore === s} onChange={() => setStartScore(s)} />
                {s}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="switch">
          <input type="checkbox" checked={showPoints} onChange={(e) => setShowPoints(e.target.checked)} />
          <span>Kártyapontok mutatása játék közben</span>
        </label>

        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="button" className="btn" onClick={onBack}>
            Vissza
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? 'Létrehozás…' : 'Szoba létrehozása'}
          </button>
        </div>
      </form>
    </main>
  );
}

export function JoinForm({ initialCode, onBack, onDone }: { initialCode: string; onBack: () => void; onDone: (code: string) => void }) {
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState(lastName());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.join(code, name);
      saveSession(res.code, { playerId: res.playerId, token: res.token, name: name.trim() });
      onDone(res.code);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <form className="panel" onSubmit={submit}>
        <h2>Csatlakozás kóddal</h2>
        <label className="field">
          <span>A szoba kódja</span>
          <input
            className="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            maxLength={4}
            autoFocus={!initialCode}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="ABCD"
            required
          />
        </label>
        <label className="field">
          <span>A neved</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoFocus={!!initialCode} autoComplete="nickname" required />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="button" className="btn" onClick={onBack}>
            Vissza
          </button>
          <button className="btn primary" disabled={busy || code.length < 4}>
            {busy ? 'Csatlakozás…' : 'Csatlakozás'}
          </button>
        </div>
      </form>
    </main>
  );
}
