import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8000,
    proxy: {
      '/auth/': { target: 'http://localhost:3000', changeOrigin: true },
      '/files/': { target: 'http://localhost:3000', changeOrigin: true },
      '/folders/': { target: 'http://localhost:3000', changeOrigin: true },
      '/user/': { target: 'http://localhost:3000', changeOrigin: true },
      '/d/': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
