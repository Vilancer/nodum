import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

const e2eDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(e2eDir);

export default defineConfig({
  root: repoRoot,
  cacheDir: 'node_modules/.vite/e2e',
  plugins: [
    tsconfigPaths({
      projects: [
        fileURLToPath(new URL('../tsconfig.base.json', import.meta.url)),
      ],
    }),
  ],
  test: {
    name: 'e2e',
    watch: false,
    globals: false,
    environment: 'node',
    include: ['e2e/**/*.e2e.spec.ts'],
    testTimeout: 120_000,
    hookTimeout: 30_000,
    reporters: ['default'],
  },
});
