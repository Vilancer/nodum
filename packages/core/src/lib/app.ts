import { createRouter, collectMiddleware } from './router.js';
import type { RouteMatch, Router } from './router.js';
import type { Handler, Middleware } from './types.js';

export type App = {
  readonly dev: boolean;
  get(path: string, handler: Handler): App;
  post(path: string, handler: Handler): App;
  put(path: string, handler: Handler): App;
  patch(path: string, handler: Handler): App;
  delete(path: string, handler: Handler): App;
  use(
    pathOrFn: string | Middleware | Router,
    fn: Middleware | Router | undefined,
  ): App;
};

type AppState = {
  readonly dev: boolean;
  listening: boolean;
  router: Router;
};

type AppRow = {
  app: App;
  state: AppState;
};

const apps: AppRow[] = [];

export function createApp(options: { dev?: boolean } = {}): App {
  const state: AppState = {
    dev: options.dev === true,
    listening: false,
    router: createRouter(),
  };
  const app: App = {
    dev: state.dev,
    get(path: string, handler: Handler): App {
      state.router.get(path, handler);
      return app;
    },
    post(path: string, handler: Handler): App {
      state.router.post(path, handler);
      return app;
    },
    put(path: string, handler: Handler): App {
      state.router.put(path, handler);
      return app;
    },
    patch(path: string, handler: Handler): App {
      state.router.patch(path, handler);
      return app;
    },
    delete(path: string, handler: Handler): App {
      state.router.delete(path, handler);
      return app;
    },
    use(
      pathOrFn: string | Middleware | Router,
      fn: Middleware | Router | undefined,
    ): App {
      state.router.use(pathOrFn, fn);
      return app;
    },
  };
  apps.push({ app, state });
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

export function clearListening(app: App): void {
  requireState(app).listening = false;
}

export function matchAppRoute(
  app: App,
  method: string,
  pathname: string,
): RouteMatch | undefined {
  return requireState(app).router.match(method, pathname);
}

export function collectAppMiddleware(app: App, pathname: string): Middleware[] {
  return collectMiddleware(requireState(app).router, pathname);
}

function requireState(app: App): AppState {
  for (let i = 0; i < apps.length; i += 1) {
    const row = apps[i];
    if (row !== undefined && row.app === app) {
      return row.state;
    }
  }
  throw new Error('createApp() instance required');
}
