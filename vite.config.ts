import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ayna-api': {
        target: 'https://map-api.ayna.gov.az',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ayna-api/, ''),
      },
    },
  },
})
