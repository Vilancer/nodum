# Nodum

Nest capabilities without Nest configuration. You write TypeScript; you deploy a [scriptc](https://scriptc.dev) native binary. There is no Node on the server box.

**Make it simple. Make it Node.**

```ts
import { createApp, listen } from '@nodum/core';

const app = createApp();
app.get('/health', (ctx) => {
  void ctx;
  return { ok: true };
});
const handle = await listen(app, { port: 3000 });
```

That shape is the same file `e2e/fixtures/health.ts` compiles with scriptc (port comes from argv there).

Packages: `@nodum/core` (kernel) · `@nodum/cli` (commands land later).

Pinned compiler: **scriptc 0.0.35** (exact).
