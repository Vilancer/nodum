# Nodum

**Nodum** is a TypeScript server framework for developers who want Nest capabilities (controllers, services, constructor DI, boundary validation, one error shape, middleware, tests) without Nest configuration (`AppModule`, `forRoot`, platform adapters, `reflect-metadata`). The mental model stays Node: files, HTTP, constructors, `listen`. The artifact you deploy is a scriptc native binary — no Node on the box.

Slogan: **Make it simple. Make it Node.**

## Packages

- **`@nodum/core`** — framework kernel. Lives in `packages/core`.
- **`@nodum/cli`** — CLI (`nodum`). Lives in `packages/cli`. Commands land in a later slice; this package is a stub until then.

Public API is exported from each package’s `src/index.ts` barrel. Specs live as `*.spec.ts` next to sources.

Pin **`scriptc` `0.0.35`** exact (no `^`, no `~`). The compiler is Vercel Labs. Classify Node vs binary mismatches, unexpected `SC` codes, coverage drops, and runtime traps. Do not paper over labs behavior.

## Commands (run from repo root)

- **Test:** `pnpm test`
- **Build:** `pnpm exec nx run-many -t build`
- **Lint:** `pnpm exec nx run-many -t lint`
- **Single project:** `pnpm exec nx run core:test`

## Architecture flags

**FLAG:** `@nodum/core` imported a runtime npm package. Core must stay static; classify the compile (`scriptc coverage`) before adding dependencies.

**FLAG:** A call used `--dynamic` (compiler-dynamic embedding). That is not a core API. Remove it or document it as an app-edge hatch — do not paper over labs behavior.

**FLAG:** Work landed on `main`. Move it to `feat/<slug>` or `fix/<slug>` and open a PR with `gh pr create`. Do not merge unless asked. Do not force-push `main`.

## Git

- Branch from `main`. Name branches `feat/<slug>` or `fix/<slug>`. Never implement a feature on `main`.
- One feature per branch. Do not mix unrelated work.
- When done: commit, `git push -u origin <branch>`, then `gh pr create` against `main` without waiting.
- Do not merge unless asked. Do not force-push `main`.
