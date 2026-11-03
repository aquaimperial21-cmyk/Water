# SmartRO admin console (Next.js) for a self-hosted server.
# Used by deploy/hostinger/docker-compose.yml.

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .
# Next.js bakes NEXT_PUBLIC_* values into the browser bundle at build time,
# so the API address has to be known here, not when the container starts.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN test -n "$NEXT_PUBLIC_API_URL" || (echo "NEXT_PUBLIC_API_URL build arg is required" && exit 1)
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/.next ./.next
COPY --from=build /app/next.config.js ./next.config.js

USER node
CMD ["npx", "next", "start", "-p", "3000", "-H", "0.0.0.0"]
