# Known Issues

What is still broken or weak, and what I would do about it with another day. Ordered
roughly by priority.

## Security / auth

- **Passwords are stored in plaintext.** The seed inserts raw passwords and `/login`
  compares them directly. Next: hash with bcrypt or argon2, add a real credential flow,
  and migrate the seed. This is the most important remaining gap.
- **No authorization layer.** Any authenticated user can resolve, reassign, export, and
  read most data regardless of role. Authentication is now verified, but role-based
  access control is not implemented (except private-note visibility). Next: a small
  `requireRole` middleware and per-route policy.
- **JWTs cannot be revoked.** Tokens live 7 days with no logout-invalidation or refresh.
  Signing out clears the client but the token stays valid until expiry. Next: short-lived
  access tokens + refresh, or a server-side revocation list.
- **No rate limiting.** Login and summarize are unthrottled, so brute-force and cost-abuse
  are open. Next: `express-rate-limit`, stricter on `/login` and `/summarize`.

## Correctness / robustness

- **No real database migrations.** Schema lives in `seed.ts` and re-seeding drops every
  table. Fine for a demo, dangerous for anything with real data. Next: a migration tool
  (e.g. a `migrations/` folder run on boot) separate from seeding.
- **No foreign-key constraints.** SQLite FKs are off, so orphaned rows are possible. I
  added a defensive null-guard in serialization, but the data model should enforce this.
- **Polling instead of real-time.** The inbox refreshes every 45 seconds. Acceptable, but
  a websocket or SSE channel would be the right call for a live support inbox.
- **Error responses are coarse.** Most failures return a generic 500. Next: consistent
  error shapes and status codes, and a client that distinguishes auth failures (redirect
  to login) from transient ones (retry).

## LLM

- **Single provider, no resilience.** `summarize` calls OpenAI directly with one attempt.
  I added a timeout, an `response.ok` check, and a length cap, but there is no retry,
  no streaming, and no per-user cost ceiling. Prompt-injection is mitigated (content is
  framed as data and truncated) but not eliminated.

## Testing / tooling

- **Only three smoke tests.** They cover auth, pagination, and SQLi. No frontend tests,
  no coverage of notes visibility, assignment validation, or the export. Next: broaden to
  the write paths and add a couple of component tests.
- **No linting / formatting in CI.** Typecheck and tests run; ESLint/Prettier do not.

## Product / UX

- **Accessibility and responsive layout** are untouched. The table is not mobile-friendly
  and there is no keyboard/screen-reader pass.
- **The retro joke branding** (marquee, emoji, blinking error style) is intentionally left
  in place but is not client-appropriate. A real engagement would replace it.

## Infrastructure

- **API container runs as root** writing to the data volume. Next: a dedicated user with
  correct volume ownership.
- **No healthchecks or observability.** Compose has no healthcheck and there is no
  structured logging, metrics, or request tracing.
- **GHCR push is untested end-to-end.** The workflow is written and the image builds
  locally, but the publish job only runs on a real push to `master` with packages
  permission. Worth confirming on first push.
