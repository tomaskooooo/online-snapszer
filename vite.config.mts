import react from '@vitejs/plugin-react';
import type { IncomingMessage } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import { handleApi } from './server/http';
import { MemoryStore } from './server/store';

/** Serves /api/lobby/* from the dev server with an in-memory store, mirroring the Vercel function. */
function devApi(): Plugin {
  const store = new MemoryStore();
  const readBody = (req: IncomingMessage) =>
    new Promise<unknown>((resolve) => {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        try {
          resolve(raw ? JSON.parse(raw) : {});
        } catch {
          resolve({});
        }
      });
    });

  return {
    name: 'snapszer-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/lobby', async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const action = url.pathname.replace(/^\//, '');
        const query: Record<string, string> = Object.fromEntries(url.searchParams);
        const body = req.method === 'POST' ? await readBody(req) : {};
        const out = await handleApi(store, { method: req.method ?? 'GET', action, query, body });
        res.statusCode = out.status;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify(out.body));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
  server: { host: true },
});
