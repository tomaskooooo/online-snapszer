import {
  addBot,
  createLobby,
  getState,
  HttpError,
  joinLobby,
  leaveLobby,
  playMove,
  rematch,
  removePlayer,
  startGame,
  startNextHand,
  updateSettings,
} from './lobby';
import type { Store } from './store';

export interface ApiRequest {
  method: string;
  action: string;
  query: Record<string, string | undefined>;
  body: unknown;
}
export interface ApiResponse {
  status: number;
  body: unknown;
}

/** Framework-free router shared by the Vercel function and the local dev server. */
export async function handleApi(store: Store, req: ApiRequest): Promise<ApiResponse> {
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  try {
    if (req.action === 'state') {
      if (req.method !== 'GET') throw new HttpError(405, 'Use GET');
      return { status: 200, body: await getState(store, req.query) };
    }
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST');

    switch (req.action) {
      case 'create':
        return { status: 200, body: await createLobby(store, body) };
      case 'join':
        return { status: 200, body: await joinLobby(store, body) };
      case 'settings':
        return { status: 200, body: await updateSettings(store, body) };
      case 'addBot':
        return { status: 200, body: await addBot(store, body) };
      case 'remove':
        return { status: 200, body: await removePlayer(store, body) };
      case 'start':
        return { status: 200, body: await startGame(store, body) };
      case 'move':
        return { status: 200, body: await playMove(store, body) };
      case 'nextHand':
        return { status: 200, body: await startNextHand(store, body) };
      case 'rematch':
        return { status: 200, body: await rematch(store, body) };
      case 'leave':
        return { status: 200, body: await leaveLobby(store, body) };
      default:
        throw new HttpError(404, 'Unknown action');
    }
  } catch (err) {
    if (err instanceof HttpError) return { status: err.status, body: { error: err.message } };
    console.error(err);
    return { status: 500, body: { error: 'Something went wrong on the server' } };
  }
}
