import { existsSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { layout, physical, rootRoute, route } from '@tanstack/virtual-file-routes'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The edition to build (C107): EDITION=<name> picks editions/<name>.ts, the full edition by default.
const edition = process.env.EDITION || 'full'
const editionFile = new URL(`./editions/${edition}.ts`, import.meta.url)
if (!/^[a-z][a-z0-9-]*$/.test(edition) || !existsSync(editionFile)) {
  throw new Error(`Unknown edition "${edition}": add apps/app/editions/${edition}.ts`)
}
const appPackages: readonly string[] = (await import(editionFile.href)).default

// The edition's app manifests, as the module `virtual:edition` (Vite's virtual modules): the shell
// imports only these, so apps outside the edition are not in its bundle.
function editionModule(): Plugin {
  const id = 'virtual:edition'
  return {
    name: 'bool-edition',
    resolveId: (source) => (source === id ? `\0${id}` : undefined),
    load: (resolved) => {
      if (resolved !== `\0${id}`) return undefined
      const imports = appPackages.map((slug, i) => `import { app as app${i} } from '@workspace/app-${slug}'`)
      return `${imports.join('\n')}\nexport const edition = ${JSON.stringify(edition)}\nexport const apps = [${appPackages.map((_, i) => `app${i}`).join(', ')}]\n`
    },
  }
}

// The route tree (C102): the shell's own routes, with each of the edition's app packages' file
// routes mounted at /<slug> inside the signed-in layout. Paths of physical() are relative to src/routes.
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
    editionModule(),
    devtools(),
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true, virtualRouteConfig: routes }),
    viteReact(),
  ],
})

export default config
