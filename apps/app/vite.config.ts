import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { layout, physical, rootRoute, route } from '@tanstack/virtual-file-routes'
import { appPackages } from './edition.ts'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The route tree (C102): the shell's own routes, with each app package's file routes mounted at
// /<slug> inside the signed-in layout. Paths of physical() are relative to src/routes.
const routes = rootRoute('__root.tsx', [
  route('/login', 'login.tsx'),
  layout('_app', '_app.tsx', [
    ...appPackages.map((slug) => physical(`/${slug}`, `../../../../packages/app-${slug}/src/routes`)),
    physical('', '_app'),
  ]),
])

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
    tanstackRouter({ target: 'react', autoCodeSplitting: true, virtualRouteConfig: routes }),
    viteReact(),
  ],
})

export default config
