# SmartRO backend — single-stage image for the Hostinger VPS
# (deploy/hostinger/docker-compose.yml) and Fly.io.
#
# We keep `prisma` CLI in the final image so `npx prisma migrate deploy` can
# run before the server starts (the compose command, or fly.toml's
# release_command) without an extra builder stage.

FROM node:20-bookworm-slim

WORKDIR /app

# Install OS deps that pdfkit transitively needs (fontconfig for font lookup).
# Skip if pdfkit is removed in future.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates fontconfig \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies first so docker layer cache survives source edits.
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# Build TypeScript + generate Prisma client for the target Postgres provider.
COPY . .
RUN npx prisma generate \
  && npm run build

# Uploads live under the workdir so a mounted volume at /app/uploads is the
# same path the app writes to. UPLOAD_DIR can override it per platform.
RUN mkdir -p /app/uploads

ENV NODE_ENV=production
# No EXPOSE: the app binds PORT, which the host sets (4000 in
# deploy/hostinger/docker-compose.yml).

CMD ["node", "dist/server.js"]
