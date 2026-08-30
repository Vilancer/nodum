import { AppError } from './errors.js';
import type { Infer, Schema } from './schema.js';
import type { Ctx, Handler } from './types.js';

type HandledCtx<
  P extends Schema<unknown>,
  Q extends Schema<unknown>,
  B extends Schema<unknown>,
> = Omit<Ctx, 'params' | 'query' | 'body'> & {
  params: Infer<P>;
  query: Infer<Q>;
  body: Infer<B>;
};

function decodeOrThrow(schema: Schema<unknown>, input: unknown): unknown {
  const decoded = schema.decode(input);
  if (!decoded.ok) {
    throw new AppError(400, 'BAD_REQUEST', decoded.message);
  }
  return decoded.value;
}

/** Registered handler: `app.get('/x', handle({ params, query, body, run }))`. */
export function handle<
  P extends Schema<unknown> = Schema<Record<string, string>>,
  Q extends Schema<unknown> = Schema<Record<string, string>>,
  B extends Schema<unknown> = Schema<unknown>,
>(opts: {
  params?: P;
  query?: Q;
  body?: B;
  run: (ctx: HandledCtx<P, Q, B>) => unknown | Promise<unknown>;
}): Handler {
  return (ctx) => {
    if (opts.params !== undefined) {
      ctx.params = decodeOrThrow(opts.params, ctx.params) as Record<
        string,
        string
      >;
    }
    if (opts.query !== undefined) {
      ctx.query = decodeOrThrow(opts.query, ctx.query) as Record<
        string,
        string
      >;
    }
    if (opts.body !== undefined) {
      ctx.body = decodeOrThrow(opts.body, ctx.body);
    }
    return opts.run(ctx as HandledCtx<P, Q, B>);
  };
}
