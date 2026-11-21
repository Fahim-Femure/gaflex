import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  // One self-contained file: the deploy image needs no node_modules.
  noExternal: [/.*/],
  // Optional native speedups of `ws`; it falls back to JS when they are absent.
  external: ['bufferutil', 'utf-8-validate'],
  // Bundled CommonJS deps (express) call require(); give ESM output a real one.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
