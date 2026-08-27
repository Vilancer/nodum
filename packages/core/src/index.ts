export const PACKAGE = '@nodum/core' as const;
export { createApp } from './lib/app.js';
export { listen } from './lib/listen.js';
export { AppError } from './lib/errors.js';
export type { Ctx, Handler, Middleware, ListenHandle } from './lib/types.js';
