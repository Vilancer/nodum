import { createRouter } from './router.js';
import type { RouteMatch, Router } from './router.js';
import type { Handler, Middleware } from './types.js';

export type App = {
  readonly dev: boolean;
  get(path: string, handler: Handler): App;
  post(path: string, handler: Handler): App;
  put(path: string, handler: Handler): App;
  patch(path: string, handler: Handler): App;
  delete(path: string, handler: Handler): App;
  use(pathOrFn: string | Middleware | Router, fn?: Middleware | Router): App;
};

type AppState = {
  readonly dev: boolean;
  listening: boolean;
  router: Router;
};

const internals = new WeakMap<App, AppState>();

export function createApp(options: { dev?: boolean } = {}): App {
  const state: AppState = {
    dev: options.dev === true,
    listening: false,
    router: createRouter(),
  };
  const app = {} as App;
  Object.defineProperty(app, 'dev', {
    value: state.dev,
    writable: false,
    enumerable: true,
    configurable: false,
  });
  app.get = (path, handler) => {
    state.router.get(path, handler);
    return app;
  };
  app.post = (path, handler) => {
    state.router.post(path, handler);
    return app;
  };
  app.put = (path, handler) => {
    state.router.put(path, handler);
    return app;
  };
  app.patch = (path, handler) => {
    state.router.patch(path, handler);
    return app;
  };
  app.delete = (path, handler) => {
    state.router.delete(path, handler);
    return app;
  };
  app.use = (pathOrFn, fn) => {
    state.router.use(pathOrFn, fn);
    return app;
  };
  internals.set(app, state);
  return app;
}

export function getAppDev(app: App): boolean {
  return requireState(app).dev;
}

export function markListening(app: App): void {
  const state = requireState(app);
  if (state.listening) {
    throw new Error('listen() already called on this app');
  }
  state.listening = true;
}

export function matchAppRoute(
  app: App,
  method: string,
  pathname: string,
): RouteMatch | undefined {
  return requireState(app).router.match(method, pathname);
}

function requireState(app: App): AppState {
  const state = internals.get(app);
  if (state === undefined) {
    throw new Error('createApp() instance required');
  }
  return state;
}
