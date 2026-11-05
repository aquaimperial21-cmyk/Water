import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The site calls our server at relative /api/v1/... URLs. On Vercel a rewrite in
// vercel.json forwards them; in `npm run dev` / `npm run preview` this proxy
// does the same.
const proxy = {
  '/api': { target: 'https://srv2122898.hstgr.cloud', changeOrigin: true, secure: true },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
})
