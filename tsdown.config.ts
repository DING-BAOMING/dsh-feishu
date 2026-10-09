import { defineConfig } from 'tsdown'

export default defineConfig({
  entryPoints: ['src/index.ts', 'src/client/index.ts'],
  outDir: 'lib',
  dts: true,
  splitting: false,
  clean: true,
})
