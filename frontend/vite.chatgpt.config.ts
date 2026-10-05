import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  base: './',
  build: {
    outDir: 'dist-chatgpt',
    assetsInlineLimit: 10000000,
    cssCodeSplit: false,
    rollupOptions: {
      input: 'chatgpt.html',
      output: { inlineDynamicImports: true },
    },
  },
})
