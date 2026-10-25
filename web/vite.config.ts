import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In dev, /graphql is proxied to the API. Defaults to the local server
// (`pnpm dev` in ../server); set API_PROXY to point at a deployed stage.
const apiTarget = process.env.API_PROXY ?? 'http://localhost:4000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/graphql': {
        target: apiTarget,
        changeOrigin: true,
        rewrite: () => '/',
      },
    },
  },
})
