# --- build stage: produce the static SPA bundle ---
FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY web/package.json ./
RUN npm install

COPY web/ ./
# Behind the reverse proxy the API is same-origin under /api.
ENV VITE_API_URL=/api
RUN npm run build

# --- runtime stage: Caddy serves the bundle and proxies the API ---
FROM caddy:2-alpine AS runtime
COPY web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 80 443
