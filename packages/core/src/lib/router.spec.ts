import { describe, expect, it } from 'vitest';
import { matchPath } from './router';

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
});
