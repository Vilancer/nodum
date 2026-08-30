import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Ctx } from './types.js';

const DUMMY_ORIGIN = 'http://127.0.0.1';

function requestUrl(req: IncomingMessage): URL {
  return new URL(`${DUMMY_ORIGIN}${req.url ?? '/'}`);
}

export function requestPathname(req: IncomingMessage): string {
  return requestUrl(req).pathname;
}

export function buildCtx(req: IncomingMessage, res: ServerResponse): Ctx {
  const url = requestUrl(req);
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
        const headerName = name.toLowerCase();
        const raw: unknown = req.headers[headerName];
        if (raw === undefined) {
          return undefined;
        }
        if (typeof raw === 'string') {
          return raw;
        }
        if (raw === null || typeof raw !== 'object') {
          return undefined;
        }
        const parts = raw as { length: number; [index: number]: unknown };
        let joined = '';
        for (let i = 0; i < parts.length; i += 1) {
          const part = parts[i];
          if (typeof part !== 'string') {
            continue;
          }
          if (joined.length > 0) {
            joined += ', ';
          }
          joined += part;
        }
        return joined;
      },
    },
    state: {},
    req,
    res,
  };
}
