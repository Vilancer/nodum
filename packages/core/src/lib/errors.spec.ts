import { describe, expect, it } from 'vitest';
import { AppError } from './errors';

describe('AppError', () => {
  it('constructs with status, code, and required message', () => {
    const err = new AppError(400, 'BAD_REQUEST', 'x');
    expect(err.status).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.message).toBe('x');
    expect(err.name).toBe('AppError/400/BAD_REQUEST');
  });
});
