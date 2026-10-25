import type { JoinResponse, Move, Settings, StateResponse, ViewResponse } from '../src';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: { body?: unknown; method?: string; headers?: Record<string, string> }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/lobby/${path}`, {
      method: init?.method ?? (init?.body ? 'POST' : 'GET'),
      headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'A szerver nem érhető el');
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // fall through with null
  }
  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error ?? `A kérés sikertelen (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

type Auth = { code: string; token: string };
const post = <T>(action: string, body: unknown) => call<T>(action, { body, method: 'POST' });

export const api = {
  create: (input: Settings & { name: string }) => post<JoinResponse>('create', input),
  join: (code: string, name: string, token?: string) => post<JoinResponse>('join', { code, name, token }),
  state: (code: string, token: string, v?: number) =>
    call<StateResponse>(`state?code=${encodeURIComponent(code)}${v ? `&v=${v}` : ''}`, { headers: { 'X-Player-Token': token } }),
  settings: (a: Auth, settings: Partial<Settings>) => post<ViewResponse>('settings', { ...a, settings }),
  addBot: (a: Auth) => post<ViewResponse>('addBot', a),
  remove: (a: Auth, playerId: string) => post<ViewResponse>('remove', { ...a, playerId }),
  start: (a: Auth) => post<ViewResponse>('start', a),
  move: (a: Auth, move: Move) => post<ViewResponse>('move', { ...a, move }),
  nextHand: (a: Auth, handNumber: number) => post<ViewResponse>('nextHand', { ...a, handNumber }),
  rematch: (a: Auth) => post<ViewResponse>('rematch', a),
  leave: (a: Auth) => post<{ ok: true }>('leave', a),
};
