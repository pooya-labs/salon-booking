import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  // GitHub Pages hosts the site beneath /salon-booking/.
  // Google Apps Script provides the API through the hidden iframe bridge.
  base: mode === 'pages' ? '/salon-booking/' : '/',
  plugins: [react(), tailwindcss()],
  server: { host: '0.0.0.0' },
}))
