# syntax=docker/dockerfile:1.7
# One image for the whole app: the Express API serving the built React frontend.

# ---- Build: install everything, compile the frontend and the backend --------------------------
FROM node:24-bookworm-slim AS build
WORKDIR /app
# Prisma's engines need OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Dependencies first, so they're cached until package files change.
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
# `prisma generate` runs on install and needs the schema and config.
COPY backend/prisma backend/prisma
COPY backend/prisma.config.ts backend/
COPY backend/src/db/migrationUrl.ts backend/src/db/
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ---- Runtime: only the backend's production dependencies and the built output ----------------
FROM node:24-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORT=3000 \
    STATIC_DIR=/app/frontend/dist \
    TRUST_PROXY=true
WORKDIR /app

# Amazon RDS certificate authorities, so the database connection is encrypted *and* verified.
# The folder is created first: ADD --chmod would otherwise give it 644 too, and without the
# execute bit the non-root user couldn't open the file inside.
RUN mkdir -p /app/certs && chmod 755 /app/certs
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/certs/rds-global-bundle.pem

COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY backend/prisma backend/prisma
COPY backend/prisma.config.ts backend/
COPY backend/src/db/migrationUrl.ts backend/src/db/
RUN npm ci --omit=dev --workspace backend --no-audit --no-fund && npm cache clean --force

COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/frontend/dist frontend/dist

USER node
WORKDIR /app/backend
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Apply any pending database migrations, then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/server.js"]
