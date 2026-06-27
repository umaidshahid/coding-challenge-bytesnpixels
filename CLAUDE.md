# CLAUDE.md — Agent Guide & Trail

This file is both the working agreement I gave my AI agent for this challenge and a record
of how I drove it. The brief weights "how you direct and review the agent" as much as the
code, so this is deliberately explicit.

## How this work was driven

1. **Read before writing.** The agent read every source file first and produced a tiered
   bug inventory (`TASKS.md`) — critical / correctness / hygiene / infrastructure — with a
   ship-vs-defer call on each item, before any code changed.
2. **Decisions up front.** Ambiguous calls (private-note visibility, container topology,
   commit granularity, whether to use Spec Kit) were settled explicitly and recorded in
   TASKS.md, not left for the agent to guess.
3. **One task, one commit, one verification.** Each task was implemented, typechecked, and
   proven with a live request or test before moving on. Commits are Conventional Commits
   with short subjects and no AI signature.
4. **Review the agent, don't trust it.** The agent's output was checked against the command
   CI actually runs, not just "did the test pass." This caught a `.ts`-extension import the
   agent wrote that passed under `tsx` but failed `tsc` (see DECISIONS.md).

## Conventions for any future agent working here

- **Verify, don't decode.** Auth uses `jwt.verify` with a secret from `JWT_SECRET`. Never
  reintroduce `jwt.decode` for auth.
- **Always parameterize SQL.** Use bound `?` parameters. Never interpolate user input into
  a query string, even for "internal" endpoints.
- **Never render untrusted text as HTML.** No `dangerouslySetInnerHTML` on customer or
  user-supplied content. Render as text.
- **No secrets in the client bundle.** API keys stay server-side. Nothing sensitive in
  `VITE_*` vars.
- **Don't log tokens or request bodies.** Keep error logs to a message + the error object.
- **One task per commit**, Conventional Commits, no signature trailer.
- **Run the CI commands locally** before claiming done: `npm run typecheck --workspace
  server`, `npm run build --workspace web`, `npm test --workspace server`.

## Project map

- `server/` — Express + TypeScript API, SQLite via better-sqlite3, run with `tsx`.
  - `src/auth.ts` — JWT sign/verify, the `authenticate` middleware.
  - `src/index.ts` — all routes; exports `app` for tests, listens only when run directly.
  - `src/db.ts` — opens the DB at `PULSE_DB_PATH` (defaults to a local file).
  - `src/llm.ts` — summary provider; `FAKE_LLM=true` returns a canned summary offline.
  - `src/index.test.ts` — smoke tests (node:test + supertest).
- `web/` — React + TypeScript SPA (Vite). `src/api.ts` is the single fetch layer.
- `server/Dockerfile`, `web/Dockerfile` (Caddy), `docker-compose.yml` — deploy stack.
- `.github/workflows/ci.yml` — typecheck, build, test, publish to GHCR.

## Deliverables for this challenge

- `DECISIONS.md` — what changed, what I found, what I deferred, where time went.
- `KNOWN-ISSUES.md` — what is still broken and the next-day plan.
- `PRODUCT-NOTE.md` — the two-week product call.
- `TASKS.md` — the working plan the agent executed against (the agent trail).
