import { useCallback, useEffect, useState } from 'react';
import type { LobbyView } from '../src';
import { api } from './api';
import { CreateForm, Home, JoinForm } from './Home';
import { LobbyRoom } from './LobbyRoom';
import { clearSession, loadSession, type Session } from './session';
import { Table } from './Table';
import { useLobby } from './useLobby';

type Screen = { kind: 'home' } | { kind: 'create' } | { kind: 'join'; code: string } | { kind: 'room'; code: string };

function screenFromHash(): Screen {
  const code = location.hash.replace(/^#\/?/, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  if (code.length < 4) return { kind: 'home' };
  return loadSession(code) ? { kind: 'room', code } : { kind: 'join', code };
}

export function App() {
  const [screen, setScreen] = useState<Screen>(screenFromHash);

  useEffect(() => {
    const onHash = () => setScreen(screenFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (hash: string) => {
    if (location.hash === hash) setScreen(screenFromHash());
    else location.hash = hash;
  };
  const home = () => {
    history.replaceState(null, '', location.pathname + location.search);
    setScreen({ kind: 'home' });
  };

  switch (screen.kind) {
    case 'home':
      return <Home onCreate={() => setScreen({ kind: 'create' })} onJoin={() => setScreen({ kind: 'join', code: '' })} />;
    case 'create':
      return <CreateForm onBack={home} onDone={(code) => go(`#/${code}`)} />;
    case 'join':
      return <JoinForm initialCode={screen.code} onBack={home} onDone={(code) => go(`#/${code}`)} />;
    case 'room': {
      const session = loadSession(screen.code);
      if (!session) return <JoinForm initialCode={screen.code} onBack={home} onDone={(code) => go(`#/${code}`)} />;
      return <Room key={screen.code} code={screen.code} session={session} onExit={home} onLost={() => setScreen({ kind: 'join', code: screen.code })} />;
    }
  }
}

function Room({ code, session, onExit, onLost }: { code: string; session: Session; onExit: () => void; onLost: () => void }) {
  const lost = useCallback(() => {
    clearSession(code);
    onLost();
  }, [code, onLost]);
  const { view, offline, apply } = useLobby(code, session, lost);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const auth = { code, token: session.token };

  const run = useCallback(
    async (action: () => Promise<{ view: LobbyView }>) => {
      setBusy(true);
      try {
        apply((await action()).view);
        setToast('');
      } catch (err) {
        setToast((err as Error).message);
        setTimeout(() => setToast(''), 3500);
      } finally {
        setBusy(false);
      }
    },
    [apply],
  );

  const leave = async () => {
    const playing = view?.phase === 'playing';
    if (playing && !window.confirm('Kilépsz a játékból? Ezen az eszközön ugyanazzal a linkkel visszatérhetsz.')) return;
    if (!playing) {
      try {
        await api.leave(auth);
      } catch {
        // already gone
      }
      clearSession(code);
    }
    onExit();
  };

  if (!view) {
    return (
      <main className="page center">
        <p className="muted">{offline ? 'A szerver nem érhető el…' : 'Szoba betöltése…'}</p>
      </main>
    );
  }

  return (
    <>
      {view.phase === 'waiting' ? (
        <LobbyRoom
          view={view}
          busy={busy}
          run={run}
          onLeave={leave}
          actions={{
            settings: (s) => api.settings(auth, s),
            addBot: () => api.addBot(auth),
            remove: (id) => api.remove(auth, id),
            start: () => api.start(auth),
          }}
        />
      ) : (
        <Table
          view={view}
          busy={busy}
          run={run}
          onLeave={leave}
          actions={{
            move: (m) => api.move(auth, m),
            nextHand: (n) => api.nextHand(auth, n),
            rematch: () => api.rematch(auth),
          }}
        />
      )}
      {(toast || offline) && (
        <div className="toast" role="status">
          {toast || 'Kapcsolati hiba, újrapróbálkozás…'}
        </div>
      )}
    </>
  );
}
