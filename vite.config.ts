import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  // GitHub Pages hosts this project beneath /salon-booking/.
  // Cloudflare Workers serves it from the domain root.
  base: mode === 'pages' ? '/salon-booking/' : '/',
  plugins: [react(), tailwindcss()],
  server: { host: '0.0.0.0' },
}))
