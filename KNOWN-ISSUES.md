# Known Issues

What is still broken or weak, and what I would do about it with more time. Ordered
roughly by priority.

## Security / auth

- **No full credential flow.** Passwords are now bcrypt-hashed (seed and `/login`), but
  there is no signup, password reset, or change-password path, and no password-strength
  policy. Next: build those flows on top of the hashing that is already in place.
- **No authorization layer.** Any authenticated user can resolve, reassign, export, and
  read most data regardless of role. Authentication is now verified, but role-based
  access control is not implemented (except private-note visibility). Next: a small
  `requireRole` middleware and per-route policy.
- **JWTs cannot be revoked.** Tokens live 7 days with no logout-invalidation or refresh.
  Signing out clears the client but the token stays valid until expiry. Next: short-lived
  access tokens + refresh, or a server-side revocation list.

## Product / UX

- **The UI is genuinely poor and needs a full revamp.** Beyond the joke branding, the
  layout, hierarchy, and interaction design are not client-grade. I treated "shippable" as
  bug-free, secure, and deployable for a staging/beta cut; the visual and UX layer is the
  next major piece of work and should be redesigned top to bottom, not patched.
- **Accessibility and responsive layout** are untouched. The table is not mobile-friendly
  and there is no keyboard/screen-reader pass.

## Correctness / robustness

- **No real database migrations.** Schema lives in `seed.ts` and re-seeding drops every
  table. Fine for a demo, dangerous for anything with real data. Next: a migration tool
  (e.g. a `migrations/` folder run on boot) separate from seeding.
- **No foreign-key constraints.** SQLite FKs are off, so orphaned rows are possible. I
  added a defensive null-guard in serialization, but the data model should enforce this.
- **Error responses are coarse.** Most failures return a generic 500. Next: consistent
  error shapes and status codes, and a client that distinguishes auth failures (redirect
  to login) from transient ones (retry).

## Scaling & reliability

Pulse is built for a single support team and is reliable at that scale. The ceilings below
are deliberate boundaries, not bugs — here is where they are and the path past each.
(Indexing and rate limiting were the cheap wins worth doing now; both are described in
DECISIONS.)

- **Single-node SQLite (deliberate).** The database is an embedded file, so the API cannot
  be run as more than one process or node against it safely (a networked filesystem plus
  SQLite risks corruption). This is the right trade for one team and the wrong one for
  horizontal scale. Path past it: migrate to Postgres and make the API tier stateless
  (auth is already stateless JWT, so the app layer is mostly ready). This is a real
  migration — every query moves from the synchronous `better-sqlite3` to an async driver —
  so it is intentionally deferred until we outgrow single-team scale.
- **Synchronous DB driver blocks the event loop.** `better-sqlite3` is synchronous by
  design; each query halts all request handling for its duration. This is a non-issue
  *while queries stay fast* (which is why indexes were added), but a slow query would stall
  every concurrent user, not just the caller.
- **Rate limiting is per-process.** The limiter that was added is in-memory, so it resets
  on restart and is not shared across instances. Next: a shared store (e.g. Redis) once the
  API runs as more than one process.
- **Polling cost grows with users.** Each client refetches the whole inbox every 45s
  regardless of changes, so load scales linearly with connected agents on top of the query
  cost. A websocket or SSE channel would replace this for a live inbox.
- **`/summarize` ties up the process for up to 15s** waiting on the LLM. The timeout and
  rate limit bound the damage, but true isolation needs a job queue / worker, which is out
  of scope here.
- **No load shedding.** The single process has no backpressure; under overload it degrades
  rather than sheds. (Healthchecks and observability are tracked under Infrastructure.)

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

## Infrastructure

- **API container runs as root** writing to the data volume. Next: a dedicated user with
  correct volume ownership.
- **No healthchecks or observability.** Compose has no healthcheck and there is no
  structured logging, metrics, or request tracing.