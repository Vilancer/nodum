## Summary

-

## Test plan

- [ ] `pnpm test`
- [ ] `pnpm test:e2e`
- [ ] `pnpm test:scriptc`

## Performance

Required: **scriptc native** vs the **same TypeScript sources** on **Node** (`node` / `tsx`). Optional: Bun and Deno when on PATH (embedded-engine contrast — not product runtimes).

Run `pnpm bench` and paste this run vs the previous file in `bench/results/`.

| Target              | Startup | First GET | p50 | p95 | req/s | RSS | Artifact |
| ------------------- | ------- | --------- | --- | --- | ----- | --- | -------- |
| scriptc native      |         |           |     |     |       |     |          |
| Node (`node`/`tsx`) |         |           |     |     |       |     |          |
| Bun (optional)      |         |           |     |     |       |     |          |
| Deno (optional)     |         |           |     |     |       |     |          |

### How to read these numbers (always keep this)

scriptc can look **weaker** than Node/Bun/Deno on some cells. That is often the measurement, not a product fail:

- **First GET.** The native binary has no JIT. The first request pays a cold HTTP/allocator path. Engines already spent tens–hundreds of ms booting (and `tsx` transforming), so their first GET is often cheaper. Compare **startup + first GET** together, not first GET alone.
- **Hot p50 / req/s.** Node JIT is allowed to win a tight sequential loop. Do not fail the PR for that.
- **Startup.** scriptc should be a few ms. Node+`tsx` includes transform; Bun/Deno include engine boot. Do not compare a native spawn to an already-warm process.
- **Artifact / RSS.** The product artifact is the scriptc binary (hundreds of KB / low-MB RSS). Node’s number is the **host `node` binary**; Bun/Deno compile numbers embed an engine (tens–hundreds of MB). FLAG if **scriptc** RSS/size enters that class, or regresses vs the previous saved row.

Do not fail CI only because Node JIT is faster on a hot loop.
