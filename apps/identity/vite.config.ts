import { defineConfig } from 'vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The login UI (7a-2, C84), served only at identity.bool.test behind Traefik, on the
// same host as Kratos's public API (/kratos), so Kratos's cookies are first-party.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    host: true,
    port: 3000,
    allowedHosts: ['identity.bool.test'],
    watch: { usePolling: true, interval: 800 },
  },
  plugins: [tailwindcss(), tanstackRouter({ target: 'react', autoCodeSplitting: true }), viteReact()],
})
