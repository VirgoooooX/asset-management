import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('echarts') || id.includes('zrender')) return 'vendor-echarts'
          if (id.includes('@mui') || id.includes('@emotion')) return 'vendor-mui'
          if (id.includes('date-fns')) return 'vendor-date'
          if (
            id.includes('react-router') ||
            id.includes('@reduxjs/toolkit') ||
            id.includes('react-redux') ||
            id.includes('react-dom') ||
            /[\\/]react[\\/]/.test(id)
          ) {
            return 'vendor-react'
          }
        }
      }
    }
  }
})
