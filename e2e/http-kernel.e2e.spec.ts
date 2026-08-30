import { afterEach, describe, expect, it } from 'vitest';
import { createApp, json, listen } from '@nodum/core';
import type { ListenHandle } from '@nodum/core';

describe('[e2e] HTTP kernel', () => {
  let handle: ListenHandle | undefined;

  afterEach(async () => {
    if (handle !== undefined) {
      await handle.close();
      handle = undefined;
    }
  });

  it('answers GET /health with compact JSON {ok:true}', async () => {
    const app = createApp();
    app.get('/health', (ctx) => {
      void ctx;
      return { ok: true };
    });
    handle = await listen(app, { port: 0 });
    const res = await fetch(`http://127.0.0.1:${handle.port}/health`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"ok":true}');
  });

  it('serves parallel fetches without swapping bodies, then idle close unbinds the port', async () => {
    const app = createApp();
    app.get('/left', (ctx) => {
      void ctx;
      return { side: 'left' };
    });
    app.get('/right', (ctx) => {
      void ctx;
      return { side: 'right' };
    });
    handle = await listen(app, { port: 0 });
    const base = `http://127.0.0.1:${handle.port}`;
    const [left, right] = await Promise.all([
      fetch(`${base}/left`),
      fetch(`${base}/right`),
    ]);
    expect(await left.text()).toBe('{"side":"left"}');
    expect(await right.text()).toBe('{"side":"right"}');
    const port = handle.port;
    await handle.close();
    handle = undefined;
    await expect(fetch(`http://127.0.0.1:${port}/left`)).rejects.toThrow();
  });

  it('keeps overlapping json() POSTs isolated (413 vs valid body)', async () => {
    const app = createApp();
    app.use(json({ limit: 8 }), undefined);
    app.post('/echo', (ctx) => ({ body: ctx.body ?? null }));
    handle = await listen(app, { port: 0 });
    const url = `http://127.0.0.1:${handle.port}/echo`;
    const [over, ok] = await Promise.all([
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '123456789',
      }),
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"n":1}',
      }),
    ]);
    expect(over.status).toBe(413);
    const overBody = (await over.json()) as { code: string };
    expect(overBody.code).toBe('PAYLOAD_TOO_LARGE');
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe('{"body":{"n":1}}');
  });
});
