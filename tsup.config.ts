import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react.ts',
    rdr: 'src/rdr/index.ts',
    rt: 'src/rt/index.ts',
    extensions: 'src/extensions/index.ts',
  },
  format: ['esm'],
  target: 'es2020',
  dts: true,
  sourcemap: false,
  clean: true,
  outDir: 'dist',
  splitting: true,
  treeshake: true,
});
