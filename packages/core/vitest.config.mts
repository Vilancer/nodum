import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/core',
  plugins: [tsconfigPaths()],
  test: {
    name: 'core',
    watch: false,
    globals: false,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,mts,cts}'],
    reporters: ['default'],
  },
});
