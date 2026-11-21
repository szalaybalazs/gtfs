import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In dev, /graphql is proxied to the API. Defaults to the live API; set
// API_PROXY=http://localhost:4000 to use a local server (`pnpm dev` in ../server).
const apiTarget = process.env.API_PROXY ?? 'https://gtfs.szalay.me/graphql'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: { output: { manualChunks: (id: string) => (id.includes('node_modules/maplibre-gl') ? 'maplibre' : undefined) } },
  },
  server: {
    // Reachable from other devices on the tailnet (`pnpm dev --host`)
    allowedHosts: ['.ts.net'],
    proxy: {
      '/graphql': {
        target: apiTarget,
        changeOrigin: true,
        rewrite: () => '/',
      },
    },
  },
})
