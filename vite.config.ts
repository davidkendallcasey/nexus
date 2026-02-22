import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Tauri uses a fixed port so the Rust process knows where to connect
  server: {
    host: host || false,
    port: 5173,
    strictPort: true,
  },
  // Tauri expects a relative base path for the bundled assets
  base: './',
  build: {
    // Tauri supports ES2021+; no need to target older browsers
    target: 'es2021',
    // Keep sourcemaps in dev, skip in prod for smaller bundles
    sourcemap: !process.env.TAURI_DEBUG,
  },
})