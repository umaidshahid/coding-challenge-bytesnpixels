# Pulse

This repository is a coding challenge for engineering candidates. It is not intended
for production use.

Pulse is a small internal customer-feedback inbox for support teams. Sign in, browse
incoming feedback across email, chat, and app-store channels, open an item to read the
full message and customer details, resolve or reopen it, and generate a quick AI summary
of any message. The app also includes assignment routing, priority and due-date fields,
customer profile history, internal notes, a small metrics panel, search, and CSV export.

## Requirements

- Node 20+
- npm

## Setup

1. Install dependencies (installs both the server and web packages):

   ```bash
   npm install
   ```

2. Create the environment files from the examples:

   ```bash
   cp server/.env.example server/.env
   cp web/.env.example web/.env
   ```

   The defaults run the app fully offline — the Summarize feature uses a built-in canned
   summarizer (`FAKE_LLM=true`), so no API key is required.

   The server requires `JWT_SECRET` to be set and will refuse to start without it. The
   example file ships a development value; replace it with a real secret in any shared or
   production environment.

3. Seed the database with sample users, customers, and feedback:

   ```bash
   npm run seed
   ```

4. Start the API and the web app together:

   ```bash
   npm run dev
   ```

   - API: http://localhost:4000
   - Web: http://localhost:5173

Open the web app in your browser and sign in.

## Test login

- **Email:** `alice@pulse.test`
- **Password:** `password123`

## Run with Docker

A production-style stack runs the API behind a Caddy reverse proxy that also serves the
built web app. Caddy proxies `/api/*` to the API, so the app is same-origin. Both compose
files and the environment live in `deploy/`.

First create the env file (compose reads it automatically, so no secrets on the command
line):

```bash
cp deploy/.env.example deploy/.env   # then edit JWT_SECRET
```

**Local build** — from root, build the images:

```bash
cd deploy
docker compose -f deploy/docker-compose.dev.yml up --build
```

**Deploy** — pull the images CI published to GHCR (`docker-compose.yml`). Pin a tag with
`IMAGE_TAG`, or use the default `latest`:

```bash
docker compose -f deploy/docker-compose.yml up
```

Then open http://localhost:8080. The API database is seeded automatically on first boot
and persisted in the `pulse-data` volume. Variables (see `deploy/.env.example`):

- `JWT_SECRET` (required) — signing secret for auth tokens.
- `PROXY_PORT` (default `8080`) — host port for the proxy.
- `SITE_ADDRESS` — set to a domain (e.g. `pulse.example.com`) for automatic HTTPS.
- `FAKE_LLM` (default `true`) / `OPENAI_API_KEY` — live summaries.
- `IMAGE_TAG` (default `latest`) — which published image tag to deploy (GHCR stack only).

## Project layout

- `server/` — Node + Express + TypeScript API backed by SQLite (`better-sqlite3`).
- `web/` — React + TypeScript single-page app built with Vite.
- `deploy/`, `server/Dockerfile`, `web/Dockerfile` — containerized stack and compose config.
- `.github/workflows/ci.yml` — CI: typecheck, build, test, and publish images to GHCR.

## Optional: live summaries

To use a real model for the Summarize feature, set the following in `server/.env`:

```bash
FAKE_LLM=false
OPENAI_API_KEY=sk-...
```
