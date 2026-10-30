import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const root = import.meta.dirname;

/**
 * Two builds from one config:
 *
 * - `vite build`             the demo site, into dist/demo
 * - `vite build --mode lib`  the embeddable library, into dist/lib
 */
export default defineConfig(({ mode }) => {
  if (mode === 'lib') {
    return {
      publicDir: false,
      build: {
        outDir: 'dist/lib',
        sourcemap: true,
        lib: {
          entry: {
            'otape-player': resolve(root, 'src/index.ts'),
            register: resolve(root, 'src/register.ts'),
          },
          formats: ['es'],
        },
      },
    };
  }

  return {
    build: {
      outDir: 'dist/demo',
      sourcemap: true,
    },
    test: {
      environment: 'happy-dom',
      include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
      restoreMocks: true,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.test.ts', 'src/register.ts'],
      },
    },
  };
});
