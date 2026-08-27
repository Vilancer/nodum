import { createRouter } from './router.js';
import type { RouteMatch, Router } from './router.js';
import type { Handler } from './types.js';

export type App = {
  readonly dev: boolean;
  get(path: string, handler: Handler): App;
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
  app.get = (path: string, handler: Handler): App => {
    state.router.get(path, handler);
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
