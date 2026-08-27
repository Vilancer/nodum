import { afterEach, describe, expect, it } from 'vitest';
import { createApp, listen } from '../index';
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
});
