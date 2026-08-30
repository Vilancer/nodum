import { describe, expect, it } from 'vitest';
import { createRouter, joinPrefix, matchPath, stripMount } from './router';

describe('matchPath', () => {
  it('matches an exact /health path', () => {
    expect(matchPath('/health', '/health')).toEqual({});
  });

  it('treats a trailing slash as a different route', () => {
    expect(matchPath('/health', '/health/')).toBeUndefined();
  });

  it('binds :name tokens', () => {
    expect(matchPath('/users/:id', '/users/42')).toEqual({ id: '42' });
  });

  it('percent-decodes param segments', () => {
    expect(matchPath('/users/:id', '/users/hello%20world')).toEqual({
      id: 'hello world',
    });
  });
});

describe('joinPrefix', () => {
  it('joins /api and /users without a double slash', () => {
    expect(joinPrefix('/api', '/users')).toBe('/api/users');
  });

  it('strips a trailing slash on the left', () => {
    expect(joinPrefix('/api/', '/users')).toBe('/api/users');
  });

  it('ensures a leading slash on the right', () => {
    expect(joinPrefix('/api', 'users')).toBe('/api/users');
  });
});

describe('stripMount', () => {
  it('matches an exact mount and /api/... remainders', () => {
    expect(stripMount('/api', '/api')).toBe('/');
    expect(stripMount('/api', '/api/users')).toBe('/users');
  });

  it('does not match /apifoo for mount /api', () => {
    expect(stripMount('/api', '/apifoo')).toBeUndefined();
  });

  it('treats mount / as matching every pathname unchanged', () => {
    expect(stripMount('/', '/')).toBe('/');
    expect(stripMount('/', '/health')).toBe('/health');
    expect(stripMount('/', '/api/users')).toBe('/api/users');
  });
});

describe('createRouter', () => {
  it('replaces the last registration of the same method plus pattern in place', async () => {
    const router = createRouter();
    router.get('/x', () => ({ n: 1 }));
    router.get('/x', () => ({ n: 2 }));
    const match = router.match('GET', '/x');
    expect(match).toBeDefined();
    expect(await match?.handler({} as never)).toEqual({ n: 2 });
  });

  it('registers post put patch and delete', () => {
    const router = createRouter();
    router.post('/items', () => ({ m: 'POST' }));
    router.put('/items', () => ({ m: 'PUT' }));
    router.patch('/items', () => ({ m: 'PATCH' }));
    router.delete('/items', () => ({ m: 'DELETE' }));
    expect(router.match('POST', '/items')?.handler).toBeTypeOf('function');
    expect(router.match('PUT', '/items')?.handler).toBeTypeOf('function');
    expect(router.match('PATCH', '/items')?.handler).toBeTypeOf('function');
    expect(router.match('DELETE', '/items')?.handler).toBeTypeOf('function');
    expect(router.match('GET', '/items')).toBeUndefined();
  });

  it('applies createRouter prefix and nested use with slash-normalized join', () => {
    const child = createRouter({ prefix: '/v1' });
    child.get('/users', () => ({ ok: true }));
    const parent = createRouter();
    parent.use('/api', child);
    expect(parent.match('GET', '/api/v1/users')).toBeDefined();
    expect(parent.match('GET', '/apifoo')).toBeUndefined();
    expect(parent.match('GET', '/users')).toBeUndefined();
  });

  it('matches routes added to a child after mount', () => {
    const child = createRouter({ prefix: '/v1' });
    const parent = createRouter();
    parent.use('/api', child);
    child.get('/later', () => ({ late: true }));
    expect(parent.match('GET', '/api/v1/later')).toBeDefined();
  });
});
