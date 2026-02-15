import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@mui/x-data-grid')) {
              return 'grid-vendor'
            }
            if (id.includes('recharts') || id.includes('d3-scale')) {
              return 'charts-vendor'
            }
            if (id.includes('leaflet') || id.includes('react-leaflet')) {
              return 'map-vendor'
            }
          }
          return undefined
        },
      },
    },
  },
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
