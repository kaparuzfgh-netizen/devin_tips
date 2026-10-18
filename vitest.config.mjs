import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^sdk\/db$/, replacement: resolve(root, 'test/mocks/sdk-db.js') },
      { find: /^sdk$/, replacement: resolve(root, 'test/mocks/sdk.js') },
    ],
  },
  test: {
    include: ['test/**/*.test.js'],
    environment: 'node',
  },
});
