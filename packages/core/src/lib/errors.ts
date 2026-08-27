import type { ServerResponse } from 'node:http';
import type { Ctx } from './types.js';

export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

export function writeJsonError(
  res: ServerResponse,
  status: number,
  code: string,
  message: string,
): void {
  if (res.headersSent) {
    return;
  }
  let payload: string;
  try {
    payload = JSON.stringify({ code, message });
  } catch {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end('{"code":"INTERNAL_ERROR","message":"Internal Server Error"}');
    return;
  }
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(payload);
}

export function writeCaughtError(ctx: Ctx, error: unknown, dev: boolean): void {
  if (ctx.res.headersSent) {
    return;
  }
  if (error instanceof AppError) {
    writeJsonError(ctx.res, error.status, error.code, error.message);
    return;
  }
  if (dev) {
    console.error(error);
  }
  const message =
    dev && error instanceof Error ? error.message : 'Internal Server Error';
  writeJsonError(ctx.res, 500, 'INTERNAL_ERROR', message);
}

export function finalize(ctx: Ctx, value: unknown, dev: boolean): void {
  if (ctx.res.headersSent) {
    return;
  }
  if (value === undefined) {
    ctx.res.statusCode = 204;
    ctx.res.end();
    return;
  }
  if (value !== null && typeof value === 'object') {
    let payload: string;
    try {
      payload = JSON.stringify(value);
    } catch (error) {
      writeCaughtError(ctx, error, dev);
      return;
    }
    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(payload);
    return;
  }
  writeCaughtError(
    ctx,
    new Error('Handler must return an object, array, or undefined'),
    dev,
  );
}
