# Benches

Standing evidence for PERF-01–04. The **product artifact** is the scriptc native binary. The **required** comparison is the same TypeScript sources under **Node** (`node` / `tsx`). **Bun** and **Deno** are optional contrast rows when those CLIs are on PATH — they ship an embedded engine (not Nodum’s runtime).

Tooling for this directory is **devDependencies** only. Do not import Bun or Deno from `@nodum/core`.

`pnpm bench` is not landed yet (Phase 3 hello + Phase 4 CRUD). Until it exists, user-facing PRs still keep a Performance section and say so.

When the script exists:

1. Run it from the repo root.
2. Append a dated JSON row under `results/`.
3. Paste this run vs the previous row into the PR body.

Metrics: startup, request latency/throughput, RSS, artifact size. Do not fail CI only because Node JIT wins a hot numeric loop. FLAG native RSS/size approaching the Node/engine class.
