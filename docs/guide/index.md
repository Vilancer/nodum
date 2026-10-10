# Nodum

Nest capabilities without Nest configuration. You write TypeScript; you deploy a [scriptc](https://scriptc.dev) native binary. There is no Node on the server box.

**Make it simple. Make it Node.**

```ts
import { createApp, listen } from '@nodum/core';

const app = createApp();
app.get('/health', () => ({ ok: true }));
await listen(app, { port: 3000 });
```

That's the whole of `examples/hello-http/main.ts`. Run it, then build it:

```bash
pnpm exec scriptc run examples/hello-http/main.ts
pnpm exec scriptc build examples/hello-http/main.ts -o hello
./hello
```

`hello` is a native executable of a few hundred KB that answers `GET /health` with `{"ok":true}`, in about 3 MB of memory, with no Node installed.

Packages: `@nodum/core` (kernel) · `@nodum/cli` (commands land later).

Pinned compiler: **scriptc 0.2.7** (exact).

Next: [HTTP kernel](http.md).
