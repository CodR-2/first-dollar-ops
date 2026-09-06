import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base: './' keeps every asset reference relative, so the same dist/ works
// when served from https://codr-2.github.io/first-dollar-ops/ and from /capp/ locally.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // @solana/web3.js@1.x expects a Node-style `global` in a few code paths.
  define: {
    global: 'globalThis',
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
})
