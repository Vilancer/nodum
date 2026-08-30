# HTTP kernel

All of this is `@nodum/core` on `node:http`. There is no Express, Fastify, Koa, or Hono.

## App and listen

`createApp({ dev?: boolean })` returns the app. `listen(app, { port, host? })` binds `127.0.0.1` by default. `port` is required; `0` lets the OS pick. The handle is `{ port, close, server }`. `close()` is idempotent and drops SIGINT/SIGTERM listeners.

A second `listen()` on the same app throws.

## Routes

`app.get|post|put|patch|delete(path, handler)`. `/:id` fills `ctx.params` (percent-decoded). Trailing slashes are distinct paths. Registering the same method+path twice keeps the last handler.

`createRouter({ prefix? })` plus `app.use('/api', router)` mounts the child. Middleware is `(ctx, next) => Promise<void>`. Global middleware is `app.use(fn, undefined)` until a one-argument overload exists.

## Body and JSON

`app.use(json(), undefined)` parses `application/json` into `ctx.body: unknown` (default limit 1 MiB). Over-limit is `413` `PAYLOAD_TOO_LARGE`. Invalid JSON is `400` `BAD_REQUEST`. Other content types leave `body` undefined.

Handler return values: object/array → `200` JSON; `undefined` → `204` empty.

## Validation

`handle({ params, query, body, run })` decodes only the keys you pass. Failure is `400` `BAD_REQUEST` with `{ code, message }` only (no `details` array). `s` is the in-tree schema: `string`, `number`, `boolean`, `object`, `optional`, `array`. No Zod in core.

## Errors

Every error body is top-level `{ code, message }`. HTTP status is on the response, not in the JSON.

| Situation         | Status         | `code`           |
| ----------------- | -------------- | ---------------- |
| No route          | 404            | `NOT_FOUND`      |
| Thrown `AppError` | `error.status` | `error.code`     |
| Unknown throw     | 500            | `INTERNAL_ERROR` |

In non-dev, 500 `message` is `Internal Server Error` (no stack). `createApp({ dev: true })` uses the original `Error.message` and logs the throw; still no stack in the body.
