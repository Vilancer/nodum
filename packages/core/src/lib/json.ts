import type { IncomingMessage } from 'node:http';
import { AppError } from './errors.js';
import type { Middleware } from './types.js';

const DEFAULT_LIMIT = 1048576;

export function json(options: { limit?: number } = {}): Middleware {
  const limit = options.limit ?? DEFAULT_LIMIT;
  return async (ctx, next) => {
    if (!isApplicationJson(ctx.headers.get('content-type'))) {
      await next();
      return;
    }
    const contentLength = ctx.headers.get('content-length');
    if (contentLength !== undefined) {
      const n = Number(contentLength);
      if (Number.isFinite(n) && n > limit) {
        throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Payload too large');
      }
    }
    const buf = await readLimited(ctx.req, limit);
    if (buf.byteLength === 0) {
      ctx.body = undefined;
      await next();
      return;
    }
    try {
      ctx.body = JSON.parse(buf.toString('utf8')) as unknown;
    } catch {
      throw new AppError(400, 'BAD_REQUEST', 'Invalid JSON');
    }
    await next();
  };
}

function isApplicationJson(header: string | undefined): boolean {
  if (header === undefined) {
    return false;
  }
  const semi = header.indexOf(';');
  const media = (semi === -1 ? header : header.slice(0, semi))
    .trim()
    .toLowerCase();
  return media === 'application/json';
}

function readLimited(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;
    const fail = (error: unknown): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };
    const onData = (chunk: Buffer | string): void => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      if (total + buf.byteLength > limit) {
        req.destroy();
        fail(new AppError(413, 'PAYLOAD_TOO_LARGE', 'Payload too large'));
        return;
      }
      total += buf.byteLength;
      chunks.push(buf);
    };
    const onEnd = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(Buffer.concat(chunks));
    };
    const onError = (error: Error): void => {
      fail(error);
    };
    const cleanup = (): void => {
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
    };
    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });
}
