import { AppError } from './errors.js';
import type { Handler, Middleware } from './types.js';

export type RouteMatch = {
  params: Record<string, string>;
  handler: Handler;
};

export type Router = {
  get(path: string, handler: Handler): Router;
  post(path: string, handler: Handler): Router;
  put(path: string, handler: Handler): Router;
  patch(path: string, handler: Handler): Router;
  delete(path: string, handler: Handler): Router;
  use(
    pathOrFn: string | Middleware | Router,
    fn: Middleware | Router | undefined,
  ): Router;
  match(method: string, pathname: string): RouteMatch | undefined;
};

type RouteLayer = {
  kind: 'route';
  method: string;
  pattern: string;
  handler: Handler;
};

type MwLayer = {
  kind: 'mw';
  mount: string | undefined;
  fn: Middleware;
};

type MountLayer = {
  kind: 'mount';
  mount: string;
  router: Router;
};

type Layer = RouteLayer | MwLayer | MountLayer;

type RouterState = {
  prefix: string;
  layers: Layer[];
};

type RouterRow = {
  router: Router;
  state: RouterState;
};

const routers: RouterRow[] = [];

export function joinPrefix(left: string, right: string): string {
  let l = left;
  if (l.length > 0 && l.charAt(l.length - 1) === '/') {
    l = l.slice(0, -1);
  }
  let r = right;
  while (r.length > 0 && r.charAt(0) === '/') {
    r = r.slice(1);
  }
  r = `/${r}`;
  if (l.length === 0) {
    return r;
  }
  return l + r;
}

export function stripMount(
  mount: string,
  pathname: string,
): string | undefined {
  const prefix = joinPrefix('', mount);
  if (prefix === '/') {
    return pathname.length === 0 ? '/' : pathname;
  }
  if (pathname === prefix) {
    return '/';
  }
  if (pathname.length > prefix.length && pathname.startsWith(prefix)) {
    const next = pathname.charAt(prefix.length);
    if (next === '/') {
      const rest = pathname.slice(prefix.length);
      return rest.length === 0 ? '/' : rest;
    }
  }
  return undefined;
}

export function matchPath(
  pattern: string,
  pathname: string,
): Record<string, string> | undefined {
  const pSeg = pattern.split('/');
  const uSeg = pathname.split('/');
  if (pSeg.length !== uSeg.length) {
    return undefined;
  }
  const params: Record<string, string> = {};
  for (let i = 0; i < pSeg.length; i += 1) {
    const p = pSeg[i];
    const u = uSeg[i];
    if (p === undefined || u === undefined) {
      return undefined;
    }
    if (p.startsWith(':') && p.length > 1) {
      try {
        params[p.slice(1)] = decodeURIComponent(u);
      } catch (error) {
        if (error instanceof Error && error.name === 'URIError') {
          throw new AppError(400, 'BAD_REQUEST', error.message);
        }
        throw error;
      }
    } else if (p !== u) {
      return undefined;
    }
  }
  return params;
}

export function createRouter(options: { prefix?: string } = {}): Router {
  const state: RouterState = {
    prefix: options.prefix ?? '',
    layers: [],
  };
  const router: Router = {
    get(path: string, handler: Handler): Router {
      addRoute(state, 'GET', path, handler);
      return router;
    },
    post(path: string, handler: Handler): Router {
      addRoute(state, 'POST', path, handler);
      return router;
    },
    put(path: string, handler: Handler): Router {
      addRoute(state, 'PUT', path, handler);
      return router;
    },
    patch(path: string, handler: Handler): Router {
      addRoute(state, 'PATCH', path, handler);
      return router;
    },
    delete(path: string, handler: Handler): Router {
      addRoute(state, 'DELETE', path, handler);
      return router;
    },
    use(
      pathOrFn: string | Middleware | Router,
      fn: Middleware | Router | undefined,
    ): Router {
      addUse(state, pathOrFn, fn);
      return router;
    },
    match(method: string, pathname: string): RouteMatch | undefined {
      return matchLayers(state.layers, method, pathname);
    },
  };
  routers.push({ router, state });
  return router;
}

function isRouter(value: Middleware | Router): value is Router {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  for (let i = 0; i < routers.length; i += 1) {
    const row = routers[i];
    if (row !== undefined && row.router === value) {
      return true;
    }
  }
  return false;
}

function addRoute(
  state: RouterState,
  method: string,
  path: string,
  handler: Handler,
): void {
  const pattern = joinPrefix(state.prefix, path);
  for (let i = 0; i < state.layers.length; i += 1) {
    const existing = state.layers[i];
    if (
      existing !== undefined &&
      existing.kind === 'route' &&
      existing.method === method &&
      existing.pattern === pattern
    ) {
      state.layers[i] = { kind: 'route', method, pattern, handler };
      return;
    }
  }
  state.layers.push({ kind: 'route', method, pattern, handler });
}

function addUse(
  state: RouterState,
  pathOrFn: string | Middleware | Router,
  fn: Middleware | Router | undefined,
): void {
  if (typeof pathOrFn === 'string') {
    if (fn === undefined) {
      throw new Error('use(path, fn) requires a middleware or router');
    }
    if (isRouter(fn)) {
      state.layers.push({ kind: 'mount', mount: pathOrFn, router: fn });
      return;
    }
    state.layers.push({ kind: 'mw', mount: pathOrFn, fn });
    return;
  }
  if (isRouter(pathOrFn)) {
    state.layers.push({ kind: 'mount', mount: '/', router: pathOrFn });
    return;
  }
  state.layers.push({ kind: 'mw', mount: undefined, fn: pathOrFn });
}

function matchLayers(
  layers: Layer[],
  method: string,
  pathname: string,
): RouteMatch | undefined {
  for (let i = 0; i < layers.length; i += 1) {
    const layer = layers[i];
    if (layer === undefined) {
      continue;
    }
    if (layer.kind === 'route') {
      if (layer.method !== method) {
        continue;
      }
      const params = matchPath(layer.pattern, pathname);
      if (params !== undefined) {
        return { params, handler: layer.handler };
      }
    } else if (layer.kind === 'mount') {
      const rest = stripMount(layer.mount, pathname);
      if (rest === undefined) {
        continue;
      }
      const child = layer.router.match(method, rest);
      if (child !== undefined) {
        return child;
      }
    }
  }
  return undefined;
}

function requireRouterState(router: Router): RouterState {
  for (let i = 0; i < routers.length; i += 1) {
    const row = routers[i];
    if (row !== undefined && row.router === router) {
      return row.state;
    }
  }
  throw new Error('createRouter() instance required');
}

export function collectMiddleware(
  router: Router,
  pathname: string,
): Middleware[] {
  const state = requireRouterState(router);
  const out: Middleware[] = [];
  for (let i = 0; i < state.layers.length; i += 1) {
    const layer = state.layers[i];
    if (layer === undefined) {
      continue;
    }
    if (layer.kind === 'mw') {
      if (layer.mount === undefined) {
        out.push(layer.fn);
      } else if (stripMount(layer.mount, pathname) !== undefined) {
        out.push(layer.fn);
      }
    } else if (layer.kind === 'mount') {
      const rest = stripMount(layer.mount, pathname);
      if (rest !== undefined) {
        const nested = collectMiddleware(layer.router, rest);
        for (let j = 0; j < nested.length; j += 1) {
          const mw = nested[j];
          if (mw !== undefined) {
            out.push(mw);
          }
        }
      }
    }
  }
  return out;
}
