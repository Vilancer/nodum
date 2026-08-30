import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import { AppError } from './errors';
import { handle } from './handle';
import { s } from './schema';
import type { Ctx } from './types';

function fakeCtx(
  partial: {
    params?: Record<string, string>;
    query?: Record<string, string>;
    body?: unknown;
  } = {},
): Ctx {
  return {
    params: partial.params ?? {},
    query: partial.query ?? {},
    body: partial.body,
    headers: { get: () => undefined },
    state: {},
    req: {} as IncomingMessage,
    res: {} as ServerResponse,
  };
}

describe('handle()', () => {
  it('decodes params and returns run output', () => {
    const handler = handle({
      params: s.object({ id: s.string() }),
      run: (ctx) => ({ id: ctx.params.id }),
    });
    const result = handler(fakeCtx({ params: { id: 'x' } }));
    expect(result).toEqual({ id: 'x' });
  });

  it('does not decode an omitted query key; raw ctx.query stays Record string string', () => {
    const handler = handle({
      params: s.object({ id: s.string() }),
      run: (ctx) => ({ id: ctx.params.id, query: ctx.query }),
    });
    const result = handler(
      fakeCtx({ params: { id: 'x' }, query: { n: 'abc' } }),
    );
    expect(result).toEqual({ id: 'x', query: { n: 'abc' } });
  });

  it('throws AppError 400 BAD_REQUEST when body decode fails, with no details', () => {
    const handler = handle({
      body: s.object({ name: s.string() }),
      run: () => ({ ok: true }),
    });
    let thrown: unknown;
    try {
      handler(fakeCtx({ body: { name: 1 } }));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AppError);
    if (thrown instanceof AppError) {
      expect(thrown.status).toBe(400);
      expect(thrown.code).toBe('BAD_REQUEST');
      expect(typeof thrown.message).toBe('string');
      expect(thrown).not.toHaveProperty('details');
    }
  });

  it('supports an async run callback', async () => {
    const handler = handle({
      run: async () => ({ async: true }),
    });
    await expect(handler(fakeCtx())).resolves.toEqual({ async: true });
  });
});
