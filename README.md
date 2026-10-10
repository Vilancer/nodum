# Nodum

Nest capabilities without Nest configuration. The deploy artifact is a [scriptc](https://scriptc.dev) native binary — no Node on the box.

**Make it simple. Make it Node.**

**Packages:** [`@nodum/core`](packages/core) (framework) · [`@nodum/cli`](packages/cli) (CLI; commands come later)

Pinned compiler: **scriptc 0.2.7**.

## Try it

```bash
pnpm install
pnpm exec scriptc run examples/hello-http/main.ts
curl http://127.0.0.1:3000/health   # {"ok":true}
```

More in [`examples/hello-http`](examples/hello-http).

## Tests (required on every PR)

From the repo root:

```bash
pnpm test          # unit (Nx / Vitest beside sources)
pnpm test:e2e      # Node HTTP E2E (`e2e/*.e2e.spec.ts`)
pnpm test:scriptc  # fully static coverage + the same requests on Node and on the native binary
pnpm test:all      # all three
```

CI runs the same gates on `main` and on every pull request.

## Bench

`pnpm bench` measures the native binary against the same sources on Node (Bun and Deno when installed) and saves a row in `bench/results/`. See [`bench/README.md`](bench/README.md).

## Docs

Human docs: [`docs/guide/`](docs/guide/). The site in `website/` publishes that folder; it isn't a second story. Contributor scriptc log: [`docs/scriptc-notes.md`](docs/scriptc-notes.md) (not site nav).
