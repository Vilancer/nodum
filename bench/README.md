# Benches

Standing evidence for PERF-01–04. The **product artifact** is the scriptc native binary. The **required** comparison is the same TypeScript sources under **Node** (`node` / `tsx`). **Bun** and **Deno** are optional contrast rows when those CLIs are on PATH — they ship an embedded engine (not Nodum’s runtime).

Tooling for this directory is **devDependencies** only. Do not import Bun or Deno from `@nodum/core`.

## Run

From the inner repo root:

```bash
pnpm bench
```

That builds `e2e/fixtures/health.ts` with scriptc (`--optimization dev`), then measures scriptc native, Node via `tsx`, and Bun/Deno when present. It prints a markdown table and appends `results/<ISO>-health.json`.

Paste this run vs the previous file into the PR Performance section.

## Metrics

| Field     | Meaning                                                                 |
| --------- | ----------------------------------------------------------------------- |
| Startup   | Spawn until `NODUM_PORT=`                                               |
| First GET | First `GET /health` after listen                                        |
| p50 / p95 | Sequential GETs after 20 warmup, 200 samples (`performance.now()`)      |
| req/s     | Those 200 samples                                                       |
| RSS       | Linux `VmRSS` after samples                                             |
| Artifact  | scriptc binary size; Bun `--compile` / Deno `compile` are contrast only |

Do not fail CI only because Node JIT wins a hot numeric loop. FLAG native RSS/size approaching the Node/engine class, or a regression vs the previous saved row.

Latest row: `results/2026-08-30T100547-health.json` (hello `/health` on this kernel).
