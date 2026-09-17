import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  resolve: {
    // the package imports itself as @workspace/ui/*; map that to src
    alias: [{ find: /^@workspace\/ui\/(components|lib|hooks)\/(.*)$/, replacement: fileURLToPath(new URL("./src/$1/$2", import.meta.url)) }],
  },
  test: {
    environment: "jsdom",
    // jsdom + user-event is slow on the Docker Desktop bind mount
    testTimeout: 20_000,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/components/date-picker.tsx", "src/components/stepper.tsx", "src/components/tabs.tsx", "src/components/table.tsx", "src/components/workspace-sidebar.tsx", "src/components/file-dropzone.tsx", "src/components/workspace-header.tsx", "src/hooks/use-theme.ts"],
    },
  },
})
