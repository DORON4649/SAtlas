import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:8081',
      '/oauth2': 'http://localhost:8081',
      '/login': 'http://localhost:8081',
      '/ws': {
        target: 'ws://localhost:8081',
        ws: true,
      },
    },
  },
})