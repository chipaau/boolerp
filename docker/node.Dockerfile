# Dev tooling image: Node 24 + pnpm 11 baked in, so containers don't re-download
# pnpm via corepack on every start. Used by the JS dev services (app, admin, website).
FROM node:24-alpine

# Activate the pinned pnpm at build time → `pnpm` is instantly available at runtime.
RUN corepack enable && corepack prepare pnpm@11.20.0 --activate

WORKDIR /w
