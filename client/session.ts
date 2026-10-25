export interface Session {
  playerId: string;
  token: string;
  name: string;
}

/** `?profile=x` gives a tab its own identity, so one person can test with several tabs. */
const profile = (() => {
  try {
    return new URLSearchParams(location.search).get('profile') ?? '';
  } catch {
    return '';
  }
})();

const key = (code: string) => `snapszer:${profile}:${code}`;
const nameKey = `snapszer:${profile}:name`;

export function loadSession(code: string): Session | null {
  try {
    const raw = localStorage.getItem(key(code));
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(code: string, session: Session): void {
  try {
    localStorage.setItem(key(code), JSON.stringify(session));
    localStorage.setItem(nameKey, session.name);
  } catch {
    // Storage can be blocked; the game then only works until the tab is closed.
  }
}

export function clearSession(code: string): void {
  try {
    localStorage.removeItem(key(code));
  } catch {
    // ignore
  }
}

export function lastName(): string {
  try {
    return localStorage.getItem(nameKey) ?? '';
  } catch {
    return '';
  }
}

export const withProfile = (url: string): string => (profile ? `${url}${url.includes('?') ? '&' : '?'}profile=${profile}` : url);
