import { AppError } from './errors.js';
import type { Handler } from './types.js';

export type RouteMatch = {
  params: Record<string, string>;
  handler: Handler;
};

export type Router = {
  get(path: string, handler: Handler): Router;
  match(method: string, pathname: string): RouteMatch | undefined;
};

type RouteEntry = {
  method: string;
  pattern: string;
  handler: Handler;
};

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
        if (error instanceof URIError) {
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

export function createRouter(): Router {
  const routes: RouteEntry[] = [];
  const router: Router = {
    get(path: string, handler: Handler): Router {
      addRoute(routes, 'GET', path, handler);
      return router;
    },
    match(method: string, pathname: string): RouteMatch | undefined {
      for (let i = 0; i < routes.length; i += 1) {
        const route = routes[i];
        if (route === undefined) {
          continue;
        }
        if (route.method !== method) {
          continue;
        }
        const params = matchPath(route.pattern, pathname);
        if (params !== undefined) {
          return { params, handler: route.handler };
        }
      }
      return undefined;
    },
  };
  return router;
}

function addRoute(
  routes: RouteEntry[],
  method: string,
  pattern: string,
  handler: Handler,
): void {
  for (let i = 0; i < routes.length; i += 1) {
    const existing = routes[i];
    if (
      existing !== undefined &&
      existing.method === method &&
      existing.pattern === pattern
    ) {
      routes[i] = { method, pattern, handler };
      return;
    }
  }
  routes.push({ method, pattern, handler });
}
