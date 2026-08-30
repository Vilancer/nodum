import { createApp, listen } from '../../packages/core/src/index.ts';

const parsed = Number(process.argv[2] ?? '0');
const port = Number.isFinite(parsed) ? parsed : 0;
const app = createApp();
app.get('/health', (ctx) => {
  void ctx;
  return { ok: true };
});
const handle = await listen(app, { port });
process.stdout.write(`NODUM_PORT=${String(handle.port)}\n`);
