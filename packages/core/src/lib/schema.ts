export type Decode<T> = { ok: true; value: T } | { ok: false; message: string };

export type Schema<T> = {
  readonly decode: (input: unknown) => Decode<T>;
};

export type Infer<Sch> = Sch extends Schema<infer T> ? T : never;

function fail(message: string): Decode<never> {
  return { ok: false, message };
}

function stringSchema(): Schema<string> {
  return {
    decode(input: unknown): Decode<string> {
      if (typeof input !== 'string') {
        return fail('Expected string');
      }
      return { ok: true, value: input };
    },
  };
}

function numberSchema(): Schema<number> {
  return {
    decode(input: unknown): Decode<number> {
      if (typeof input === 'number') {
        if (!Number.isFinite(input)) {
          return fail('Expected finite number');
        }
        return { ok: true, value: input };
      }
      if (typeof input === 'string') {
        const trimmed = input.trim();
        if (trimmed === '') {
          return fail('Expected finite number');
        }
        const n = Number(trimmed);
        if (!Number.isFinite(n)) {
          return fail('Expected finite number');
        }
        return { ok: true, value: n };
      }
      return fail('Expected finite number');
    },
  };
}

function booleanSchema(): Schema<boolean> {
  return {
    decode(input: unknown): Decode<boolean> {
      if (typeof input === 'boolean') {
        return { ok: true, value: input };
      }
      if (input === 'true') {
        return { ok: true, value: true };
      }
      if (input === 'false') {
        return { ok: true, value: false };
      }
      return fail('Expected boolean');
    },
  };
}

function objectSchema<T extends Record<string, Schema<unknown>>>(
  shape: T,
): Schema<{ [K in keyof T]: Infer<T[K]> }> {
  return {
    decode(input: unknown): Decode<{ [K in keyof T]: Infer<T[K]> }> {
      if (input === null || typeof input !== 'object' || Array.isArray(input)) {
        return fail('Expected object');
      }
      const src = input as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      const keys = Object.keys(shape);
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        if (key === undefined) {
          continue;
        }
        const field = shape[key];
        if (field === undefined) {
          continue;
        }
        const present = Object.prototype.hasOwnProperty.call(src, key);
        const decoded = field.decode(present ? src[key] : undefined);
        if (!decoded.ok) {
          return fail(`Invalid ${key}: ${decoded.message}`);
        }
        out[key] = decoded.value;
      }
      return { ok: true, value: out as { [K in keyof T]: Infer<T[K]> } };
    },
  };
}

function optionalSchema<T>(inner: Schema<T>): Schema<T | undefined> {
  return {
    decode(input: unknown): Decode<T | undefined> {
      if (input === undefined) {
        return { ok: true, value: undefined };
      }
      return inner.decode(input);
    },
  };
}

function arraySchema<T>(inner: Schema<T>): Schema<T[]> {
  return {
    decode(input: unknown): Decode<T[]> {
      if (!Array.isArray(input)) {
        return fail('Expected array');
      }
      const out: T[] = [];
      for (let i = 0; i < input.length; i += 1) {
        const item = input[i];
        const decoded = inner.decode(item);
        if (!decoded.ok) {
          return fail(`Invalid index ${String(i)}: ${decoded.message}`);
        }
        out.push(decoded.value);
      }
      return { ok: true, value: out };
    },
  };
}

export const s = {
  string: stringSchema,
  number: numberSchema,
  boolean: booleanSchema,
  object: objectSchema,
  optional: optionalSchema,
  array: arraySchema,
} as const;
