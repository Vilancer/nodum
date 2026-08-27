import { describe, expect, it } from 'vitest';
import { s } from './schema';

describe('s.string', () => {
  it('decodes a string and rejects a number', () => {
    const ok = s.string().decode('hi');
    expect(ok).toEqual({ ok: true, value: 'hi' });
    const bad = s.string().decode(1);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(typeof bad.message).toBe('string');
      expect(bad).not.toHaveProperty('details');
    }
  });
});

describe('s.number', () => {
  it('accepts a finite number or a complete numeric string and rejects empty, non-numeric, and Infinity', () => {
    expect(s.number().decode(1)).toEqual({ ok: true, value: 1 });
    expect(s.number().decode('1')).toEqual({ ok: true, value: 1 });
    expect(s.number().decode(' 2 ')).toEqual({ ok: true, value: 2 });
    expect(s.number().decode('').ok).toBe(false);
    expect(s.number().decode('1a').ok).toBe(false);
    expect(s.number().decode(Infinity).ok).toBe(false);
    expect(s.number().decode(Number.NaN).ok).toBe(false);
  });
});

describe('s.boolean', () => {
  it('accepts boolean or the strings true and false only', () => {
    expect(s.boolean().decode(true)).toEqual({ ok: true, value: true });
    expect(s.boolean().decode('false')).toEqual({ ok: true, value: false });
    expect(s.boolean().decode('true')).toEqual({ ok: true, value: true });
    expect(s.boolean().decode('yes').ok).toBe(false);
  });
});

describe('s.object', () => {
  it('copies declared keys only and strips extras including __proto__', () => {
    const result = s.object({ id: s.string() }).decode({ id: 'a', extra: 1 });
    expect(result).toEqual({ ok: true, value: { id: 'a' } });
    if (result.ok) {
      expect(Object.keys(result.value)).toEqual(['id']);
    }
    const polluted = JSON.parse(
      '{"id":"a","__proto__":{"polluted":true},"extra":1}',
    ) as unknown;
    const stripped = s.object({ id: s.string() }).decode(polluted);
    expect(stripped.ok).toBe(true);
    if (stripped.ok) {
      expect(stripped.value).toEqual({ id: 'a' });
      expect(Object.keys(stripped.value)).toEqual(['id']);
    }
  });

  it('emits keys in shape order', () => {
    const result = s
      .object({ b: s.string(), a: s.string() })
      .decode({ a: '1', b: '2' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.value)).toEqual(['b', 'a']);
    }
  });
});

describe('s.optional', () => {
  it('yields undefined for a missing value', () => {
    expect(s.optional(s.string()).decode(undefined)).toEqual({
      ok: true,
      value: undefined,
    });
  });
});

describe('s.array', () => {
  it('accepts an empty array and coerces numeric strings while preserving order', () => {
    expect(s.array(s.number()).decode([])).toEqual({ ok: true, value: [] });
    expect(s.array(s.number()).decode([1, '2'])).toEqual({
      ok: true,
      value: [1, 2],
    });
  });
});
