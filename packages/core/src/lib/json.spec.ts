import { request as httpRequest } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, json, listen } from '../index';
import type { ListenHandle } from '../index';

function echoBody(ctx: { body: unknown }): { hasBody: boolean; body: unknown } {
  return { hasBody: ctx.body !== undefined, body: ctx.body ?? null };
}

describe('json()', () => {
  let handle: ListenHandle | undefined;

  afterEach(async () => {
    if (handle !== undefined) {
      await handle.close();
      handle = undefined;
    }
  });

  it('parses application/json into ctx.body as unknown', async () => {
    const app = createApp();
    app.use(json(), undefined);
    app.post('/echo', (ctx) => echoBody(ctx));
    handle = await listen(app, { port: 0 });
    const res = await fetch(`http://127.0.0.1:${handle.port}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"a":1}',
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"hasBody":true,"body":{"a":1}}');
  });

  it('parses application/json; charset=utf-8', async () => {
    const app = createApp();
    app.use(json(), undefined);
    app.post('/echo', (ctx) => echoBody(ctx));
    handle = await listen(app, { port: 0 });
    const res = await fetch(`http://127.0.0.1:${handle.port}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: '{"a":1}',
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"hasBody":true,"body":{"a":1}}');
  });

  it('leaves ctx.body undefined for an empty application/json body', async () => {
    const app = createApp();
    app.use(json(), undefined);
    app.post('/echo', (ctx) => echoBody(ctx));
    handle = await listen(app, { port: 0 });
    const res = await fetch(`http://127.0.0.1:${handle.port}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '',
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"hasBody":false,"body":null}');
  });

  it('parses {} as an empty object distinct from an empty body', async () => {
    const app = createApp();
    app.use(json(), undefined);
    app.post('/echo', (ctx) => echoBody(ctx));
    handle = await listen(app, { port: 0 });
    const res = await fetch(`http://127.0.0.1:${handle.port}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"hasBody":true,"body":{}}');
  });

  it('returns 413 PAYLOAD_TOO_LARGE when Content-Length exceeds 1048576', async () => {
    const app = createApp();
    app.use(json(), undefined);
    app.post('/echo', (ctx) => echoBody(ctx));
    handle = await listen(app, { port: 0 });
    const { status, body } = await new Promise<{
      status: number;
      body: { code: string; message: string; status?: unknown };
    }>((resolve, reject) => {
      const req = httpRequest(
        {
          host: '127.0.0.1',
          port: handle?.port,
          path: '/echo',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': 1048577,
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            resolve({
              status: res.statusCode ?? 0,
              body: JSON.parse(text) as {
                code: string;
                message: string;
                status?: unknown;
              },
            });
          });
        },
      );
      req.on('error', reject);
      req.end();
    });
    expect(status).toBe(413);
    expect(body.code).toBe('PAYLOAD_TOO_LARGE');
    expect(typeof body.message).toBe('string');
    expect(body).not.toHaveProperty('status');
  });

  it('rejects a 9-byte body when json({ limit: 8 })', async () => {
    const app = createApp();
    app.use(json({ limit: 8 }), undefined);
    app.post('/echo', (ctx) => echoBody(ctx));
    handle = await listen(app, { port: 0 });
    const res = await fetch(`http://127.0.0.1:${handle.port}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '123456789',
    });
    expect(res.status).toBe(413);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('leaves ctx.body undefined for text/plain', async () => {
    const app = createApp();
    app.use(json(), undefined);
    app.post('/echo', (ctx) => echoBody(ctx));
    handle = await listen(app, { port: 0 });
    const res = await fetch(`http://127.0.0.1:${handle.port}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: '{"a":1}',
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"hasBody":false,"body":null}');
  });

  it('does not parse application/ld+json', async () => {
    const app = createApp();
    app.use(json(), undefined);
    app.post('/echo', (ctx) => echoBody(ctx));
    handle = await listen(app, { port: 0 });
    const res = await fetch(`http://127.0.0.1:${handle.port}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/ld+json' },
      body: '{"a":1}',
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"hasBody":false,"body":null}');
  });
});
