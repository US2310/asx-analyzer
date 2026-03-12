import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy /stock/* calls to Python backend during local development
    proxy: {
      '/stock': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/search': 'http://localhost:8000',
    }
  }
})
