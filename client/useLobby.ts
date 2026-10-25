import { useCallback, useEffect, useRef, useState } from 'react';
import type { LobbyView } from '../src';
import { api, ApiError } from './api';
import type { Session } from './session';

/** Polls the lobby. The version number makes an unchanged poll nearly free. */
export function useLobby(code: string, session: Session, onLost: () => void) {
  const [view, setView] = useState<LobbyView | null>(null);
  const [offline, setOffline] = useState(false);
  const version = useRef(0);
  const lost = useRef(onLost);
  lost.current = onLost;

  const apply = useCallback((next: LobbyView) => {
    if (next.version < version.current) return;
    version.current = next.version;
    setView(next);
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const res = await api.state(code, session.token, version.current || undefined);
        if (stopped) return;
        if (!res.unchanged) apply(res.view);
        setOffline(false);
      } catch (err) {
        if (stopped) return;
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          lost.current();
          return;
        }
        setOffline(true);
      }
      timer = setTimeout(tick, document.hidden ? 4000 : 1200);
    };
    tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [code, session.token, apply]);

  return { view, offline, apply };
}
