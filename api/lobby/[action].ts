import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleApi } from '../../server/http';
import { getStore } from '../../server/store';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const query: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(req.query)) {
    query[key] = Array.isArray(value) ? value[0] : value;
  }
  const headers: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
  }
  const out = await handleApi(getStore(), {
    method: req.method ?? 'GET',
    action: query.action ?? '',
    query,
    headers,
    body: req.body,
  });
  res.setHeader('Cache-Control', 'no-store');
  res.status(out.status).json(out.body);
}
