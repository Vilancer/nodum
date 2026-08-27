import { afterEach, describe, expect, it } from 'vitest';
import { AppError, createApp, listen } from '../index';
import type { ListenHandle } from '../index';

describe('listen GET /health', () => {
  let handle: ListenHandle | undefined;

  afterEach(async () => {
    if (handle !== undefined) {
      await handle.close();
      handle = undefined;
    }
  });

  it('returns 200 compact JSON {ok:true} for GET /health', async () => {
    const app = createApp();
    app.get('/health', () => ({ ok: true }));
    handle = await listen(app, { port: 0 });
    const res = await fetch(`http://127.0.0.1:${handle.port}/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.text()).toBe('{"ok":true}');
  });

  it('returns 404 JSON NOT_FOUND for unmatched path', async () => {
    const app = createApp();
    app.get('/health', () => ({ ok: true }));
    handle = await listen(app, { port: 0 });
    const res = await fetch(`http://127.0.0.1:${handle.port}/no-such-route`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as {
      code: string;
      message: string;
      status?: unknown;
    };
    expect(body.code).toBe('NOT_FOUND');
    expect(typeof body.message).toBe('string');
    expect(body).not.toHaveProperty('status');
    expect(Object.keys(body).sort()).toEqual(['code', 'message']);
  });

  it('returns 404 JSON NOT_FOUND for POST /health', async () => {
    const app = createApp();
    app.get('/health', () => ({ ok: true }));
    handle = await listen(app, { port: 0 });
    const res = await fetch(`http://127.0.0.1:${handle.port}/health`, {
      method: 'POST',
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('NOT_FOUND');
  });

  it('maps thrown AppError to HTTP status plus { code, message }', async () => {
    const app = createApp();
    app.get('/teapot', () => {
      throw new AppError(418, 'TEAPOT', 'nope');
    });
    handle = await listen(app, { port: 0 });
    const res = await fetch(`http://127.0.0.1:${handle.port}/teapot`);
    expect(res.status).toBe(418);
    const body = (await res.json()) as {
      code: string;
      message: string;
      status?: unknown;
      stack?: unknown;
    };
    expect(body.code).toBe('TEAPOT');
    expect(body.message).toBe('nope');
    expect(body).not.toHaveProperty('status');
    expect(Object.keys(body).sort()).toEqual(['code', 'message']);
  });

  it('maps unknown throws to INTERNAL_ERROR without stack in non-dev', async () => {
    const app = createApp();
    app.get('/boom', () => {
      throw new Error('secret');
    });
    handle = await listen(app, { port: 0 });
    const res = await fetch(`http://127.0.0.1:${handle.port}/boom`);
    expect(res.status).toBe(500);
    const body = (await res.json()) as {
      code: string;
      message: string;
      stack?: unknown;
    };
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('Internal Server Error');
    expect(body).not.toHaveProperty('stack');
    expect(Object.keys(body).sort()).toEqual(['code', 'message']);
  });

  it('uses the original Error message in createApp({ dev: true }) without stack', async () => {
    const app = createApp({ dev: true });
    app.get('/boom', () => {
      throw new Error('secret');
    });
    handle = await listen(app, { port: 0 });
    const res = await fetch(`http://127.0.0.1:${handle.port}/boom`);
    expect(res.status).toBe(500);
    const body = (await res.json()) as {
      code: string;
      message: string;
      stack?: unknown;
    };
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('secret');
    expect(body).not.toHaveProperty('stack');
    expect(Object.keys(body).sort()).toEqual(['code', 'message']);
  });

  it('returns HTTP 204 with empty body for undefined handler return', async () => {
    const app = createApp();
    app.get('/empty', () => undefined);
    handle = await listen(app, { port: 0 });
    const res = await fetch(`http://127.0.0.1:${handle.port}/empty`);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(res.headers.get('content-type')).toBeNull();
  });

  it('throws on a second listen() of the same app', async () => {
    const app = createApp();
    app.get('/health', () => ({ ok: true }));
    handle = await listen(app, { port: 0 });
    await expect(listen(app, { port: 0 })).rejects.toThrow();
  });

  it('removes SIGINT listeners on close and is idempotent', async () => {
    const app = createApp();
    app.get('/health', () => ({ ok: true }));
    const before = process.listenerCount('SIGINT');
    handle = await listen(app, { port: 0 });
    expect(process.listenerCount('SIGINT')).toBe(before + 1);
    await handle.close();
    expect(process.listenerCount('SIGINT')).toBe(before);
    await expect(handle.close()).resolves.toBeUndefined();
    const again = handle.close();
    expect(again).toBeInstanceOf(Promise);
    await again;
    handle = undefined;
  });
});
