import { describe, expect, it } from 'vitest';
import { PACKAGE } from './index';

describe('@nodum/core', () => {
  it('exports the package name', () => {
    expect(PACKAGE).toBe('@nodum/core');
  });
});
