import {
  AppError,
  createApp,
  json,
  listen,
} from '../../packages/core/src/index.ts';

const parsed = Number(process.argv[2] ?? '0');
const port = Number.isFinite(parsed) ? parsed : 0;
const app = createApp();
app.use(json({ limit: 64 }), undefined);
app.get('/health', () => ({ ok: true }));
app.get('/items/:id', (ctx) => ({ id: ctx.params['id'] ?? '' }));
app.get('/search', (ctx) => ({ q: ctx.query['q'] ?? '' }));
// handle() + s.* are not in this fixture yet: they don't compile statically on
// scriptc 0.2.7 (docs/scriptc-notes.md, SC2001/SC2009/SC2002).
app.post('/echo', (ctx) => ({ body: ctx.body ?? null }));
app.get('/teapot', () => {
  throw new AppError(418, 'TEAPOT', 'I am a teapot');
});
app.get('/crash', () => {
  throw new Error('secret detail');
});
app.delete('/items/:id', () => undefined);
const handleOut = await listen(app, { port });
process.stdout.write(`NODUM_PORT=${String(handleOut.port)}\n`);
