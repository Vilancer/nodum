# Nodum

**Nodum** is a TypeScript server framework for developers who want Nest capabilities (controllers, services, constructor DI, boundary validation, one error shape, middleware, tests) without Nest configuration (`AppModule`, `forRoot`, platform adapters, `reflect-metadata`). The mental model stays Node: files, HTTP, constructors, `listen`. The artifact you deploy is a scriptc native binary — no Node on the box.

Slogan: **Make it simple. Make it Node.**

## Packages

- **`@nodum/core`** — framework kernel. Lives in `packages/core`.
- **`@nodum/cli`** — CLI (`nodum`). Lives in `packages/cli`. Commands land in a later slice; this package is a stub until then.

Public API is exported from each package’s `src/index.ts` barrel. Specs live as `*.spec.ts` next to sources.

Pin **`scriptc` `0.2.7`** exact (no `^`, no `~`). An upgrade is a release event: read the changelog, rerun the gates and the bench, re-probe the open rows in `docs/scriptc-notes.md`, and log it there. The compiler is Vercel Labs. Classify Node vs binary mismatches, unexpected `SC` codes, coverage drops, and runtime traps. Do not paper over labs behavior.

## Commands (run from repo root)

- **Unit:** `pnpm test` (Nx Vitest beside sources)
- **Node E2E:** `pnpm test:e2e` (`[e2e]` specs in `e2e/`)
- **scriptc:** `pnpm test:scriptc` (fully static coverage; the same requests on Node and on the native binary, which runs with no Node on PATH)
- **All gates:** `pnpm test:all`
- **Bench:** `pnpm bench` (native dev/release/speed vs Node on `/health`; writes `bench/results/`, see `bench/README.md`)
- **Build:** `pnpm exec nx run-many -t build`
- **Lint:** `pnpm exec nx run-many -t lint`
- **Single project:** `pnpm exec nx run core:test`

Every inner PR and every GSD execute/verify step must run **unit + Node E2E + scriptc**. CI (`.github/workflows/ci.yml`) is the hard gate. Do not land kernel or compiler work on green unit tests alone.

## Benches matter

Nodum's promise is measurable: a native binary that starts in milliseconds, runs in a few MB and ships in hundreds of KB, with no Node on the box. Tests prove it works; the bench proves it's still Nodum. Treat a bench regression like a failing test.

- Run `pnpm bench` on every user-facing PR, on every scriptc upgrade, and on any change to the kernel's request path. Commit the new `bench/results/` file with the change.
- Paste the table and the diff against the previous file into the PR. Read the host load line: compare rows from the same run, not absolute ms across machines.
- The bench prints **FLAG** lines (native peak RSS above 16 MB, binary above 5 MB, or more than 15% worse than the last saved row). Every FLAG gets a cause and a fix or an explicit decision in the PR.
- When you find something faster or smaller (a scriptc mode, a kernel change), prove it with a bench run before claiming it.
- New features that add a request path (validation, CRUD) get a bench case of their own when they land.

User-facing API changes update `docs/guide/` in the same PR. The published site will be that guide, not a rewrite. Docusaurus is an approved site generator (versioned docs). `docs/scriptc-notes.md` is a contributor log, not site nav. Samples must match a runnable file (`examples/`). The site in `website/` publishes `docs/guide/`.

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
