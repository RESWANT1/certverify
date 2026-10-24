import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api/certs': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/certs/, ''),
      },
      '/api/verify': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
    },
  },
})
