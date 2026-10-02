# Dev tooling image: Node 26 + pnpm 12 baked in, so containers don't re-download
# pnpm via corepack on every start. Used by the JS dev services (app, admin, website).
FROM node:26-alpine@sha256:0b36e8c136b94cd4fcf02188228e76c31ad5872eef3fec8cbd2eee500cfd9e80

# Node 26 no longer ships Corepack by default — install it explicitly, then activate the pinned
# pnpm at build time so `pnpm` is instantly available at runtime.
RUN npm install -g corepack@0.36.0 && corepack enable && corepack prepare pnpm@12.4.1 --activate

WORKDIR /w
