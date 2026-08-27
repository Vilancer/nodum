import type { Ctx, Middleware } from './types.js';

export function compose(stack: Middleware[]): (ctx: Ctx) => Promise<void> {
  return async function run(ctx: Ctx): Promise<void> {
    let index = -1;
    async function dispatch(i: number): Promise<void> {
      if (i <= index) {
        throw new Error('next() called multiple times');
      }
      index = i;
      const layer = stack[i];
      if (layer === undefined) {
        return;
      }
      await layer(ctx, async () => {
        await dispatch(i + 1);
      });
    }
    await dispatch(0);
  };
}
