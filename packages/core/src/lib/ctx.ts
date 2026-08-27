import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Ctx } from './types.js';

const DUMMY_ORIGIN = 'http://127.0.0.1';

export function requestPathname(req: IncomingMessage): string {
  const url = new URL(req.url ?? '/', DUMMY_ORIGIN);
  return url.pathname;
}

export function buildCtx(req: IncomingMessage, res: ServerResponse): Ctx {
  const url = new URL(req.url ?? '/', DUMMY_ORIGIN);
  const query: Record<string, string> = {};
  for (const [key, value] of url.searchParams) {
    query[key] = value;
  }
  return {
    params: {},
    query,
    body: undefined,
    headers: {
      get(name: string): string | undefined {
        const raw = req.headers[name.toLowerCase()];
        if (raw === undefined) {
          return undefined;
        }
        return Array.isArray(raw) ? raw.join(', ') : raw;
      },
    },
    state: {},
    req,
    res,
  };
}
