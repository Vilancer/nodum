export type Decode<T> = { ok: true; value: T } | { ok: false; message: string };

export type Schema<T> = {
  readonly decode: (input: unknown) => Decode<T>;
};

export type Infer<Sch> = Sch extends Schema<infer T> ? T : never;

function fail<T>(message: string): Decode<T> {
  const result: Decode<T> = { ok: false, message };
  return result;
}

function ok<T>(value: T): Decode<T> {
  const result: Decode<T> = { ok: true, value };
  return result;
}

function stringSchema(): Schema<string> {
  return {
    decode(input: unknown): Decode<string> {
      if (typeof input !== 'string') {
        return fail<string>('Expected string');
      }
      return ok<string>(input);
    },
  };
}

function numberSchema(): Schema<number> {
  return {
    decode(input: unknown): Decode<number> {
      if (typeof input === 'number') {
        if (!Number.isFinite(input)) {
          return fail<number>('Expected finite number');
        }
        return ok<number>(input);
      }
      if (typeof input === 'string') {
        const trimmed = input.trim();
        if (trimmed === '') {
          return fail<number>('Expected finite number');
        }
        const n = Number(trimmed);
        if (!Number.isFinite(n)) {
          return fail<number>('Expected finite number');
        }
        return ok<number>(n);
      }
      return fail<number>('Expected finite number');
    },
  };
}

function booleanSchema(): Schema<boolean> {
  return {
    decode(input: unknown): Decode<boolean> {
      if (typeof input === 'boolean') {
        return ok<boolean>(input);
      }
      if (input === 'true') {
        return ok<boolean>(true);
      }
      if (input === 'false') {
        return ok<boolean>(false);
      }
      return fail<boolean>('Expected boolean');
    },
  };
}

function objectSchema<T extends Record<string, Schema<unknown>>>(
  shape: T,
): Schema<{ [K in keyof T]: Infer<T[K]> }> {
  type Value = { [K in keyof T]: Infer<T[K]> };
  return {
    decode(input: unknown): Decode<Value> {
      if (input === null || typeof input !== 'object' || Array.isArray(input)) {
        return fail<Value>('Expected object');
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
          return fail<Value>(`Invalid ${key}: ${decoded.message}`);
        }
        out[key] = decoded.value;
      }
      return ok<Value>(out as Value);
    },
  };
}

function optionalSchema<T>(inner: Schema<T>): Schema<T | undefined> {
  return {
    decode(input: unknown): Decode<T | undefined> {
      if (input === undefined) {
        return ok<T | undefined>(undefined);
      }
      return inner.decode(input);
    },
  };
}

function arraySchema<T>(inner: Schema<T>): Schema<T[]> {
  return {
    decode(input: unknown): Decode<T[]> {
      if (!Array.isArray(input)) {
        return fail<T[]>('Expected array');
      }
      const out: T[] = [];
      for (let i = 0; i < input.length; i += 1) {
        const item = input[i];
        const decoded = inner.decode(item);
        if (!decoded.ok) {
          return fail<T[]>(`Invalid index ${String(i)}: ${decoded.message}`);
        }
        out.push(decoded.value);
      }
      return ok<T[]>(out);
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
