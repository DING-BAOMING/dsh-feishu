import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/client/index.ts'],
  outDir: 'lib',
  splitting: false,
  clean: true,
  dts: false,
  format: ['esm'],
  external: [
    '@deepseek-ai/cordis',
    '@deepseek-ai/schemastery',
    '@deepseek-ai/dsh-settings',
  ],
})
