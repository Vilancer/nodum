import type { IncomingMessage, Server, ServerResponse } from 'node:http';

export type Ctx = {
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  headers: { get(name: string): string | undefined };
  state: Record<string, never>;
  req: IncomingMessage;
  res: ServerResponse;
};

export type Handler = (ctx: Ctx) => unknown | Promise<unknown>;

export type Middleware = (ctx: Ctx, next: () => Promise<void>) => Promise<void>;

export type ListenHandle = {
  port: number;
  close(): Promise<void>;
  server: Server;
};
