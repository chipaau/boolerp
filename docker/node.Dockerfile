# Dev tooling image: Node 26 + pnpm 12 baked in, so containers don't re-download
# pnpm via corepack on every start. Used by the JS dev services (app, admin, website).
FROM node:26-alpine

# Node 26 no longer ships Corepack by default — install it explicitly, then activate the pinned
# pnpm at build time so `pnpm` is instantly available at runtime.
RUN npm install -g corepack@latest && corepack enable && corepack prepare pnpm@12.4.1 --activate

WORKDIR /w
