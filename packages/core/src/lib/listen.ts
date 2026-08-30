import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  collectAppMiddleware,
  getAppDev,
  markListening,
  matchAppRoute,
  type App,
} from './app.js';
import { compose } from './compose.js';
import { buildCtx, requestPathname } from './ctx.js';
import { finalize, writeCaughtError, writeJsonError } from './errors.js';
import type { Ctx, ListenHandle } from './types.js';

export async function listen(
  app: App,
  options: { port: number; host?: string },
): Promise<ListenHandle> {
  if (typeof options.port !== 'number' || Number.isNaN(options.port)) {
    throw new Error('listen() requires a port');
  }
  markListening(app);
  const host = options.host ?? '127.0.0.1';
  const server = createServer((req, res) => {
    void handleRequest(app, req, res);
  });
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => {
      reject(error);
    };
    server.once('error', onError);
    server.listen(options.port, host, () => {
      resolve();
    });
  });
  const addr = server.address();
  if (addr === null || typeof addr === 'string') {
    throw new Error('listen() failed to determine bound port');
  }
  const { port } = addr;
  let closed = false;
  const onSignal = (): void => {
    void close();
  };
  async function close(): Promise<void> {
    if (closed) {
      return;
    }
    closed = true;
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
    await new Promise<void>((resolve, reject) => {
      const onCloseError = (error: Error): void => {
        reject(error);
      };
      server.once('error', onCloseError);
      server.close(() => {
        resolve();
      });
    });
  }
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  return { port, close, server };
}

async function handleRequest(
  app: App,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const ctx = buildCtx(req, res);
  const dev = getAppDev(app);
  try {
    const method = req.method ?? 'GET';
    const pathname = requestPathname(req);
    let routeValue: unknown;
    let routed = false;
    const stack = collectAppMiddleware(app, pathname);
    stack.push((innerCtx: Ctx, next: () => Promise<void>): Promise<void> => {
      void next;
      return runRoute(innerCtx);
    });
    async function runRoute(innerCtx: Ctx): Promise<void> {
      const match = matchAppRoute(app, method, pathname);
      if (match === undefined) {
        writeJsonError(innerCtx.res, 404, 'NOT_FOUND', 'Not Found');
        return;
      }
      innerCtx.params = match.params;
      routeValue = await match.handler(innerCtx);
      routed = true;
    }
    await compose(stack)(ctx);
    if (routed && !ctx.res.headersSent) {
      finalize(ctx, routeValue, dev);
    }
  } catch (error) {
    writeCaughtError(ctx, error, dev);
  }
}
