# scriptc notes

Pinned version: **0.0.35** (exact; no caret, no tilde).

## Classify mismatches — do not paper over

Node vs binary mismatches must be classified (classify mismatches). Do not paper over.

When Node (Vitest) and the native binary disagree, classify the mismatch as one of:

- limitation
- misuse
- framework bug
- flag upstream

Do not paper over labs behavior. Do not silently add `--dynamic` to make a test green.

## Compiler-dynamic embedding

Note: compiler-dynamic embedding is not a core API. `--dynamic` is an app-edge hatch, not a framework contract. Core and examples must stay 100% static. If a call needs `--dynamic`, remove it or document it as an app-edge hatch.

## CI gate

`pnpm test:scriptc` is required on every inner PR:

1. `scriptc coverage e2e/fixtures/health.ts` must print `fully static` / `100%` and must not mention `--dynamic`.
2. `scriptc build --backend llvm` of that fixture must answer `GET /health` with `{"ok":true}`.

`scriptc run` does not forward extra argv. Tests build, then exec the binary (`port` from `process.argv[2]`, default `0`).

## SC* log

Record unexpected `SC*` codes here as they appear.

| Code   | Seen in                                     | Classification        | Notes                                                                                                                                                                                                                                                                         |
| ------ | ------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC0001 | scriptc's Node lib vs `@types/node`         | limitation            | `URL` two-arg ctor, `IncomingMessage.off`, `Server.closeAllConnections` — avoid those APIs in core                                                                                                                                                                            |
| SC1090 | middleware / `instanceof` / `Array.isArray` | framework bug (fixed) | Middleware must return `Promise<void>` (not `void \| Promise<void>`). Do not `instanceof AppError` on `unknown` and do not `as AppError` from `Error`. Encode `AppError/<status>/<code>` in `Error.name` so the catch path can classify without a process-wide instance list. |
| SC1100 | `===` on `unknown`                          | framework bug (fixed) | Narrow with `instanceof Error` before identity compare                                                                                                                                                                                                                        |
| SC2002 | `{} as App`                                 | framework bug (fixed) | Build object literals that match the public type                                                                                                                                                                                                                              |
| SC2003 | `Decode<never>` fail helper                 | framework bug (fixed) | Annotate `fail<T>` / `ok<T>` as the destination union                                                                                                                                                                                                                         |
| SC2020 | `WeakMap`, `Object.defineProperty`          | limitation            | WeakMap has no lowering; use an identity side table. `defineProperty` is unsupported                                                                                                                                                                                          |
