# --- dependencies stage: install with the native toolchain present ---
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# better-sqlite3 is a native module; it needs a toolchain to build.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY server/package.json ./
RUN npm install --omit=dev

# --- runtime stage ---
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY server/package.json ./
COPY server/tsconfig.json ./
COPY server/src ./src
COPY server/docker-entrypoint.sh ./

# SQLite database lives on a mounted volume (see docker-compose.yml).
ENV PULSE_DB_PATH=/data/pulse.db
EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
