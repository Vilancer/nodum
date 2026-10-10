# Benches

Benches are how Nodum proves its promise: a native binary that starts in milliseconds, runs in a few MB and
ships in hundreds of KB, with no Node on the box. A change that keeps tests green but loses that is a
regression. Every user-facing PR runs `pnpm bench` and pastes the result.

The **product artifact** is the scriptc native binary. The **required** comparison is the same TypeScript
sources under **Node** (`tsx`). **Bun** and **Deno** are optional contrast rows when those CLIs are on PATH:
they embed an engine and are not Nodum's runtime.

Tooling here is **devDependencies** only. Never import Bun or Deno from `@nodum/core`.

## Run

From the inner repo root:

```bash
pnpm bench                     # 3 rounds, median per cell
env BENCH_ROUNDS=5 pnpm bench  # more rounds on a noisy machine
```

It builds `e2e/fixtures/health.ts` three times (`--optimization dev`, `release`, `speed`), then measures each
build, Node via `tsx`, and Bun/Deno when present. Rounds interleave targets so background load hits all of
them alike. It prints the table, a diff against the previous file in `results/`, the host load, and any
**FLAG** lines, then saves `results/<ISO>-health.json`. Commit that file with the PR.

## Metrics

| Field            | Meaning                                                                        |
| ---------------- | ------------------------------------------------------------------------------ |
| Startup          | Spawn until `NODUM_PORT=` is printed                                           |
| First GET        | First `GET /health` on a fresh connection                                      |
| p50 / p95, req/s | 500 sequential keep-alive GETs after 50 warmup                                 |
| Load req/s, p99  | 5,000 GETs at concurrency 32 over keep-alive; p99 is per-request latency       |
| RSS / Peak RSS   | Linux `VmRSS` after the sequential samples / `VmHWM` after load                |
| Artifact         | scriptc: the native app per mode; Node: the host `node`; Bun/Deno: `--compile` |

`release` is what ships (scriptc's default). `dev` stays for like-for-like with rows recorded before
2026-10-10, which had a single `scriptc` row built with `--optimization dev`. `speed` is scriptc's opt-in
mode (bigger binary, faster runtime), measured to see if it's worth it.

## Reading the numbers

- **Compare rows from the same run.** Absolute ms move with the machine's load (the run prints it). Ratios
  between rows, RSS and artifact size are what carry across runs.
- **First GET:** engines already paid boot (and `tsx` its transform) before printing the port. Compare
  startup + first GET together.
- **Hot p50 / req/s:** Node's JIT is allowed to win a tight loop. Never fail a PR for that.
- **FLAG** (printed automatically): native peak RSS above 16 MB, a native binary above 5 MB, or native RSS
  or size more than 15% worse than the previous saved row. Explain or fix it in the PR; don't ignore it.

Binaries (gitignored, rebuilt each run): `bench/.out/health-{dev,release,speed}`, `bench/.out/health-bun`,
`bench/.out/health-deno`.
