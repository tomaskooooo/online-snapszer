import { Redis } from '@upstash/redis';
import type { MatchState, Settings } from '../src/types';

export interface LobbyPlayer {
  id: string;
  /** Secret. Never sent to anyone but its owner, and not even then after the join response. */
  token: string;
  name: string;
  bot: boolean;
}

export interface Lobby {
  code: string;
  version: number;
  hostId: string;
  settings: Settings;
  phase: 'waiting' | 'playing';
  /** During a match the index in this list is the seat. */
  players: LobbyPlayer[];
  match: MatchState | null;
  /** When the player whose turn it is runs out of time (ms since epoch), or null. */
  deadline: number | null;
  /** Consecutive timeouts per seat, reset by a move the player makes themselves. */
  timeouts: number[];
}

export interface Store {
  get(code: string): Promise<Lobby | null>;
  /** Saves a new lobby. Returns false if the code is already taken. */
  create(code: string, lobby: Lobby): Promise<boolean>;
  set(code: string, lobby: Lobby): Promise<void>;
  del(code: string): Promise<void>;
  /** Runs fn with exclusive access to this lobby, so two moves can't overwrite each other. */
  withLock<T>(code: string, fn: () => Promise<T>): Promise<T>;
}

export const LOBBY_TTL_SECONDS = 6 * 60 * 60;

export class MemoryStore implements Store {
  private lobbies = new Map<string, string>();
  private locks = new Map<string, Promise<unknown>>();

  async get(code: string) {
    const raw = this.lobbies.get(code);
    return raw ? (JSON.parse(raw) as Lobby) : null;
  }

  async create(code: string, lobby: Lobby) {
    if (this.lobbies.has(code)) return false;
    this.lobbies.set(code, JSON.stringify(lobby));
    return true;
  }

  async set(code: string, lobby: Lobby) {
    this.lobbies.set(code, JSON.stringify(lobby));
  }

  async del(code: string) {
    this.lobbies.delete(code);
  }

  async withLock<T>(code: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(code) ?? Promise.resolve();
    const run = previous.then(fn, fn);
    const tail = run.catch(() => undefined);
    this.locks.set(code, tail);
    try {
      return await run;
    } finally {
      if (this.locks.get(code) === tail) this.locks.delete(code);
    }
  }
}

export class UpstashStore implements Store {
  constructor(private redis: Redis) {}

  private key = (code: string) => `snapszer:lobby:${code}`;

  async get(code: string) {
    const raw = await this.redis.get<string | Lobby>(this.key(code));
    if (raw == null) return null;
    return typeof raw === 'string' ? (JSON.parse(raw) as Lobby) : raw;
  }

  async create(code: string, lobby: Lobby) {
    const res = await this.redis.set(this.key(code), JSON.stringify(lobby), { nx: true, ex: LOBBY_TTL_SECONDS });
    return res === 'OK';
  }

  async set(code: string, lobby: Lobby) {
    await this.redis.set(this.key(code), JSON.stringify(lobby), { ex: LOBBY_TTL_SECONDS });
  }

  async del(code: string) {
    await this.redis.del(this.key(code));
  }

  async withLock<T>(code: string, fn: () => Promise<T>): Promise<T> {
    const lockKey = `${this.key(code)}:lock`;
    const owner = Math.random().toString(36).slice(2);
    const deadline = Date.now() + 4000;
    for (;;) {
      const got = await this.redis.set(lockKey, owner, { nx: true, px: 5000 });
      if (got === 'OK') break;
      if (Date.now() > deadline) throw new Error('A szoba foglalt, próbáld újra');
      await new Promise((r) => setTimeout(r, 40 + Math.random() * 60));
    }
    try {
      return await fn();
    } finally {
      if ((await this.redis.get<string>(lockKey)) === owner) await this.redis.del(lockKey);
    }
  }
}

let shared: Store | undefined;

/** Upstash Redis when its env vars exist (Vercel Marketplace sets them), else memory (local dev only). */
export function getStore(): Store {
  if (shared) return shared;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url && token) {
    shared = new UpstashStore(new Redis({ url, token }));
  } else {
    if (process.env.VERCEL) console.warn('No Redis env vars found: lobbies will not survive between requests.');
    shared = new MemoryStore();
  }
  return shared;
}
