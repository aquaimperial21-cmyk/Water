# SmartRO backend — single-stage image for Fly.io.
#
# We keep `prisma` CLI in the final image so the release_command in fly.toml
# (`npx prisma migrate deploy`) works without an extra builder stage.

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

# Persistent uploads volume is mounted at /uploads (see fly.toml [mounts]).
RUN mkdir -p /uploads

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "dist/server.js"]
