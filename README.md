# Nodum

Nest capabilities without Nest configuration. The deploy artifact is a [scriptc](https://scriptc.dev) native binary — no Node on the box.

**Make it simple. Make it Node.**

**Packages:** [`@nodum/core`](packages/core) (framework) · [`@nodum/cli`](packages/cli) (CLI; commands come later)

Pinned compiler: **scriptc 0.0.35**.

## Tests (required on every PR)

From the repo root:

```bash
pnpm test          # unit (Nx / Vitest beside sources)
pnpm test:e2e      # Node HTTP E2E (`e2e/*.e2e.spec.ts`)
pnpm test:scriptc  # scriptc coverage (fully static) + native /health binary
pnpm test:all      # all three
```

CI runs the same gates on `main` and on every pull request.

## Docs

Human docs: [`docs/guide/`](docs/guide/). That folder is what the website will publish — not a separate site-only story. Contributor scriptc log: [`docs/scriptc-notes.md`](docs/scriptc-notes.md) (not site nav).
