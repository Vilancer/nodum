export const PACKAGE = '@nodum/core' as const;
export { createApp } from './lib/app.js';
export { createRouter } from './lib/router.js';
export { listen } from './lib/listen.js';
export { json } from './lib/json.js';
export { AppError } from './lib/errors.js';
export type { Ctx, Handler, Middleware, ListenHandle } from './lib/types.js';
export type { Router } from './lib/router.js';
