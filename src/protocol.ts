import type { Settings } from './types';
import type { MatchView } from './view';

export interface LobbyPlayerView {
  id: string;
  name: string;
  bot: boolean;
  isHost: boolean;
  /** Index in the player list; during a match this is the seat. */
  seat: number;
}

/** Everything one player is allowed to see about a lobby. Never holds tokens or other hands. */
export interface LobbyView {
  code: string;
  version: number;
  phase: 'waiting' | 'playing';
  settings: Settings;
  players: LobbyPlayerView[];
  needed: number;
  me: { id: string; seat: number; isHost: boolean };
  match: MatchView | null;
}

export interface JoinResponse {
  code: string;
  playerId: string;
  token: string;
}

export type StateResponse = { unchanged: true } | { unchanged?: false; view: LobbyView };
export interface ViewResponse {
  view: LobbyView;
}
