# scriptc notes

Pinned version: **0.2.7** (exact; no caret, no tilde). Read upstream source at the matching tag (`v0.2.7`).

## Upgrades

A scriptc upgrade is a release event: read the changelog from the old pin to the new one, rerun `pnpm test:all` and `pnpm bench`, re-probe every open row below, and record what changed here.

| Date       | From → to      | What changed for Nodum                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-10 | 0.0.35 → 0.2.7 | Source-only workspace packages compile statically (0.1.3), so `examples/` import `@nodum/core` by name. `URL` two-arg ctor and `Server.closeAllConnections` now compile; `close()` uses the latter. `WeakMap` lowers, but only for class-instance or function keys. LLVM is the only backend (0.2.0); `--backend llvm` is now a no-op and was dropped from tests. The frontend is TypeScript 7 (tsgo); our own `tsc`/lint stay on 5.9.3. New `--optimization speed` is benched, not shipped. Bench (dev build, like-for-like): RSS 3404 → 3140 KB, binary 945 → 800 KB; release build 637 KB. |

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

1. `scriptc coverage` of `e2e/fixtures/health.ts`, `e2e/fixtures/kernel.ts` and `examples/hello-http/main.ts` must print `fully static` / `100%` and must not mention `--dynamic`.
2. The native `/health` binary answers `{"ok":true}` with no Node on its PATH.
3. Every request in the kernel case table (`e2e/scriptc.e2e.spec.ts`) gets the same status, content type and body from Node and from the native binary. A difference fails the gate and needs a row below before anything merges.

`scriptc run` does not forward extra argv (still true on 0.2.7, with or without `--`). Tests build, then exec the binary (`port` from `process.argv[2]`, default `0`); the public example hardcodes its port.

## SC* log

Record unexpected `SC*` codes here as they appear.

| Code                     | Seen in                                     | Classification            | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC0001                   | scriptc's Node lib vs `@types/node`         | limitation                | 0.2.7: `URL` two-arg ctor and `Server.closeAllConnections` compile now. `IncomingMessage.off` still doesn't: avoid it in core                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| SC1090                   | middleware / `instanceof` / `Array.isArray` | framework bug (fixed)     | Middleware must return `Promise<void>` (not `void \| Promise<void>`). Do not `instanceof AppError` on `unknown` and do not `as AppError` from `Error`. Encode `AppError/<status>/<code>` in `Error.name` so the catch path can classify without a process-wide instance list.                                                                                                                                                                                                                                                                                                                           |
| SC1100                   | `===` on `unknown`                          | framework bug (fixed)     | Narrow with `instanceof Error` before identity compare                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| SC2002                   | `{} as App`                                 | framework bug (fixed)     | Build object literals that match the public type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| SC2003                   | `Decode<never>` fail helper                 | framework bug (fixed)     | Annotate `fail<T>` / `ok<T>` as the destination union                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| SC2020                   | `Object.defineProperty`                     | limitation                | Still unsupported on 0.2.7                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| SC1101                   | `WeakMap<App, …>` / `WeakMap<Router, …>`    | limitation                | 0.2.7 lowers `WeakMap`, but a key must be a class instance or a function. `App`/`Router` are object literals with methods, so they stay on identity side tables (linear scan). Revisit if they become classes                                                                                                                                                                                                                                                                                                                                                                                           |
| SC2001 / SC2009 / SC2002 | `handle()` + `s.object()`                   | limitation (+ our design) | **Not static on 0.0.35 or 0.2.7; the old gate never compiled it.** scriptc resolves mapped/conditional types at the top level, but not inside a function-typed record member (`Schema<T>.decode` returning `Decode<{ [K in keyof T]: … }>`), and won't lower a mapped _parameter_ type (`{ [K in keyof V]: Schema<V[K]> }`). `s` as a table of function references also hit SC1090 (only methods with bodies monomorphize). `run(ctx as HandledCtx)` hits SC2002 (`unknown` body won't lift into a record). Needs a schema design that keeps value types concrete; tracked as the next task before CRUD |
