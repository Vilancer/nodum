# hello-http

The smallest Nodum app: one file, one route, a native binary at the end.

```ts
import { createApp, listen } from '@nodum/core';

const app = createApp();
app.get('/health', () => ({ ok: true }));
await listen(app, { port: 3000 });
```

That's all of [`main.ts`](main.ts). No `AppModule`, no config file. The `package.json` next to it only says
the app depends on `@nodum/core`, as any Node app would.

## Try it

From the repo root (after `pnpm install`):

```bash
pnpm exec scriptc run examples/hello-http/main.ts
curl -i http://127.0.0.1:3000/health        # 200 {"ok":true}
```

## Ship it

```bash
pnpm exec scriptc build examples/hello-http/main.ts -o hello
./hello
```

`hello` is a native executable, around 640 KB, using about 3 MB of memory. It doesn't need Node on the
machine that runs it.

Check that nothing needs a JavaScript engine at runtime:

```bash
pnpm exec scriptc coverage examples/hello-http/main.ts   # fully static
```

The port is fixed at `3000` because `scriptc run` doesn't pass extra arguments to the program yet. A built
binary gets `process.argv` as usual.
