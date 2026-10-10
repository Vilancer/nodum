# HTTP kernel

All of this is `@nodum/core` on `node:http`. There is no Express, Fastify, Koa, or Hono.

## App and listen

`createApp({ dev?: boolean })` returns the app. `listen(app, { port, host? })` binds `127.0.0.1` by default. `port` is required; `0` lets the OS pick. The handle is `{ port, close, server }`. `close()` stops listening and closes every open connection right away, including requests still in flight (it does not wait for them to drain). It is idempotent and drops SIGINT/SIGTERM listeners.

A second successful `listen()` on the same app throws. If bind fails (`EADDRINUSE`, bad host), the app is not left latched — you can call `listen()` again.

## Routes

`app.get|post|put|patch|delete(path, handler)`. `/:id` fills `ctx.params` (percent-decoded). Trailing slashes are distinct paths. Registering the same method+path twice keeps the last handler.

`createRouter({ prefix? })` plus `app.use('/api', router)` mounts the child. `app.use(router, undefined)` or `app.use('/', router)` mounts at `/` and matches every descendant path (`/health` stays `/health` on the child). Middleware is `(ctx, next) => Promise<void>`. Global middleware is `app.use(fn, undefined)` until a one-argument overload exists.

## Body and JSON

`app.use(json(), undefined)` parses `application/json` into `ctx.body: unknown` (default limit 1 MiB). `json({ limit })` must be a finite number ≥ 0 or `json()` throws at construction (NaN / Infinity do not disable the cap). Over-limit is `413` `PAYLOAD_TOO_LARGE` (declared `Content-Length` or a streamed body). The request is resumed so the 413 can be written and the connection can finish. Invalid JSON is `400` `BAD_REQUEST`. Other content types leave `body` undefined.

Handler return values: object/array → `200` JSON; `undefined` → `204` empty.

## Validation

`handle({ params, query, body, run })` decodes only the keys you pass. On Node it works today; in a native build it doesn't compile statically yet (scriptc limitation, being worked on), so native apps validate by hand for now. Failure is `400` `BAD_REQUEST` with `{ code, message }` only (no `details` array). `s` is the in-tree schema: `string`, `number`, `boolean`, `object`, `optional`, `array`. No Zod in core.

## Errors

Every error body is top-level `{ code, message }`. HTTP status is on the response, not in the JSON.

| Situation         | Status         | `code`       |
| ----------------- | -------------- | ------------ |
| No route          | 404            | `NOT_FOUND`  |
| Thrown `AppError` | `error.status` | `error.code` |

`AppError` still exposes `status` and `code` on the instance. `error.name` is `AppError/<status>/<code>` so the native binary can classify a throw without `instanceof` or retaining every instance.
| Unknown throw | 500 | `INTERNAL_ERROR` |

In non-dev, 500 `message` is `Internal Server Error` (no stack). `createApp({ dev: true })` uses the original `Error.message` and logs the throw; still no stack in the body.
