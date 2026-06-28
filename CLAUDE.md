# Pulse - Customer Feedback Inbox

Small internal tool: users log in, view incoming feedback items, mark them
resolved, and trigger LLM summarization of a feedback thread.

Stack: React + TypeScript (frontend), Node + Express + TypeScript (backend),
SQLite (better-sqlite3), OpenAI-compatible LLM endpoint.

This was agent-generated and handed to me to make shippable. Treat every
assumption the original agent made as suspect until verified.

## Commands

```bash
# Backend
cd server && npm install && npm run dev   # ts-node / nodemon
npm run build                             # tsc
npm test                                  # jest (if tests exist)

# Frontend
cd client && npm install && npm run dev   # vite
npm run build
npm run lint                              # eslint

# Seed DB
cd server && npm run seed
```

## Project structure (verify on first read)

```
/web             React app
/server          Express
```

## Environment variables required

```
JWT_SECRET=
OPENAI_API_KEY=      # or equivalent
DATABASE_PATH=./db/pulse.sqlite
PORT=3001
```

Startup must fail loudly if JWT_SECRET or the LLM key is missing.
Do not silently fall back to a default secret.

## Things the original agent likely got wrong - check these first

- Auth: JWT secret probably hardcoded or in .env that is not validated on
  startup. Check for missing expiry, no refresh, tokens accepted after logout.
- Error handling: LLM call probably throws raw errors to the client, possibly
  leaking the API key or upstream error message. Wrap it.
- SQLite queries: likely raw string concatenation - check for injection.
  Also check for missing transactions on multi-step writes.
- No input validation on POST bodies - check every route.
- Resolve action probably has no ownership check - any user can resolve any item.
- LLM summarize endpoint: no rate limiting, no timeout, no fallback if the
  model is slow or down.
- Frontend: loading and error states likely missing or only on the happy path.

## Constraints I am working within

- Do not change the DB schema in a way that breaks the seed script.
- Do not add a new runtime dependency without a clear reason. Keep the footprint small.
- Prefer fixing over replacing. The goal is shippable, not a rewrite.
- Every route that writes data needs input validation (zod or manual, be consistent).
- The LLM call must have a timeout and a user-facing error message that does
  not leak internals.
- No commits that mix a bug fix with a refactor.

## Commit style

Small, focused commits. One logical change per commit.
Format: `fix: ...` / `feat: ...` / `refactor: ...` / `chore: ...`

## What I am not fixing in this session

(fill in as you go - things you found, assessed, and chose to leave out of scope.
This feeds directly into the DECISIONS file.)