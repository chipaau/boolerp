import { defineConfig } from 'vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    host: true,
    port: 3000,
    // A portal is always on the tenant's own domain (C191), so in development it is served behind
    // Traefik at the sample tenant's hosts. Development only: a release serves the built files from
    // the BFF (C90, C99), which has no dev server and no allowed-host list.
    allowedHosts: ['.cyryx.test'],
    // Poll Windows Docker bind mounts so edits trigger live reload.
    watch: { usePolling: true, interval: 800 },
  },
  plugins: [tailwindcss(), tanstackRouter({ target: 'react', autoCodeSplitting: true }), viteReact()],
})

export default config
