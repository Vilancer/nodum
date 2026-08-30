## Summary

-

## Test plan

- [ ] `pnpm test`
- [ ] `pnpm test:e2e`
- [ ] `pnpm test:scriptc`

## Performance

Required: **scriptc native** vs the **same TypeScript sources** on **Node** (`node` / `tsx`). Optional: Bun and Deno when on PATH (embedded-engine contrast — not product runtimes).

| Target              | Startup | p50 latency | RSS | Artifact size |
| ------------------- | ------- | ----------- | --- | ------------- |
| scriptc native      |         |             |     |               |
| Node (`node`/`tsx`) |         |             |     |               |
| Bun (optional)      |         |             |     |               |
| Deno (optional)     |         |             |     |               |

Previous row: `bench/results/` (or _not yet — `pnpm bench` lands with hello / PERF-01_).

Do not fail the PR only because Node JIT is faster on a hot loop. FLAG native RSS/size in the Node/engine class, or a regression vs the previous saved row.

When `pnpm bench` exists, append this run under `bench/results/` (keep history for later / bigger benches).
