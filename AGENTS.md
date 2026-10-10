# Nodum

**Nodum** is a TypeScript server framework for developers who want Nest capabilities (controllers, services, constructor DI, boundary validation, one error shape, middleware, tests) without Nest configuration (`AppModule`, `forRoot`, platform adapters, `reflect-metadata`). The mental model stays Node: files, HTTP, constructors, `listen`. The artifact you deploy is a scriptc native binary — no Node on the box.

Slogan: **Make it simple. Make it Node.**

## Packages

- **`@nodum/core`** — framework kernel. Lives in `packages/core`.
- **`@nodum/cli`** — CLI (`nodum`). Lives in `packages/cli`. Commands land in a later slice; this package is a stub until then.

Public API is exported from each package’s `src/index.ts` barrel. Specs live as `*.spec.ts` next to sources.

Pin **`scriptc` `0.0.35`** exact (no `^`, no `~`). The compiler is Vercel Labs. Classify Node vs binary mismatches, unexpected `SC` codes, coverage drops, and runtime traps. Do not paper over labs behavior.

## Commands (run from repo root)

- **Unit:** `pnpm test` (Nx Vitest beside sources)
- **Node E2E:** `pnpm test:e2e` (`[e2e]` specs in `e2e/`)
- **scriptc:** `pnpm test:scriptc` (coverage must be fully static; native `/health` binary)
- **All gates:** `pnpm test:all`
- **Bench:** `pnpm bench` (hello `/health`; writes `bench/results/`)
- **Build:** `pnpm exec nx run-many -t build`
- **Lint:** `pnpm exec nx run-many -t lint`
- **Single project:** `pnpm exec nx run core:test`

Every PR must run **unit + Node E2E + scriptc**. CI (`.github/workflows/ci.yml`) is the hard gate. Do not land kernel or compiler work on green unit tests alone.

User-facing API changes update `docs/guide/` in the same PR. The published site will be that guide, not a rewrite. Docusaurus is an approved site generator (versioned docs). `docs/scriptc-notes.md` is a contributor log, not site nav. Samples must match a runnable file (`e2e/fixtures/`, later `examples/`).

## PR description

Every user-facing PR body must include a **Performance** section (see `.github/pull_request_template.md`).

- **Required:** scriptc native binary vs the **same sources** on **Node** (`node` / `tsx`): startup, request latency/throughput, RSS, artifact size.
- **Optional:** Bun and Deno rows when those tools are on PATH (contrast only — they embed an engine).
- Run `pnpm bench` and append the JSON under `bench/results/` so later / bigger benches have a baseline. Paste this run vs the previous file into the PR body.
- Bench tooling is **devDependencies** only. Do not add Bun or Deno to `@nodum/core`.
- Always explain in the Performance section why scriptc can look weaker on some cells (first GET is a cold native path; engines already paid boot/`tsx` transform; Node JIT may win hot p50). Compare startup+first GET together. FLAG only if native RSS/size looks like the Node/engine class, or drops vs the last saved row.

## Architecture flags

**FLAG:** `@nodum/core` imported a runtime npm package. Core must stay static; classify the compile (`scriptc coverage`) before adding dependencies.

**FLAG:** A call used `--dynamic` (compiler-dynamic embedding). That is not a core API. Remove it or document it as an app-edge hatch — do not paper over labs behavior.

**FLAG:** Work landed on `main`. Move it to `feat/<slug>` or `fix/<slug>` and open a PR with `gh pr create`. Do not merge unless asked. Do not force-push `main`.

## Git

- Branch from `main`. Name branches `feat/<slug>` or `fix/<slug>`. Never implement a feature on `main`.
- One feature per branch. Do not mix unrelated work.
- When done: commit, `git push -u origin <branch>`, then `gh pr create` against `main` without waiting.
- Do not merge unless asked. Do not force-push `main`.
