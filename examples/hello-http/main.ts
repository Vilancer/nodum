import { createApp, listen } from '@nodum/core';

const app = createApp();
app.get('/health', () => ({ ok: true }));
await listen(app, { port: 3000 });
