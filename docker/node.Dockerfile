# Dev tooling image: Node 26 + pnpm 12 baked in, so containers don't re-download
# pnpm via corepack on every start. Used by the JS dev services (app, admin, website).
FROM node:26-alpine@sha256:143494b1da2945f061539253adc65e4f1569ddf07da2d384c022c791a9d90a4a

# Node 26 no longer ships Corepack by default — install it explicitly, then activate the pinned
# pnpm at build time so `pnpm` is instantly available at runtime.
RUN npm install -g corepack@0.36.0 && corepack enable && corepack prepare pnpm@12.4.1 --activate
# pnpm's store is the shared pnpm-store volume (compose.yaml), so every dev service reuses what any
# of them downloaded and a recreated container fetches only new packages. Without it pnpm 12 puts
# the store inside each container's own node_modules volume, so each service downloads everything
# again. pnpm 12 reads pnpm_config_*; it ignores npm_config_store_dir.
ENV pnpm_config_store_dir=/w/.pnpm-store

WORKDIR /w
