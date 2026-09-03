import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    host: true,
    port: 3000,
    allowedHosts: ['.bool.test'], // served behind Traefik at <tenant>.bool.test
    // Docker Desktop bind mounts on Windows do not forward file events; poll so HMR works.
    watch: { usePolling: true, interval: 800 },
  },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
  ],
})

export default config
