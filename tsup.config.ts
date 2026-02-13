import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/react.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: false,
  clean: true,
  outDir: 'dist',
  splitting: false,
  treeshake: true,
});
