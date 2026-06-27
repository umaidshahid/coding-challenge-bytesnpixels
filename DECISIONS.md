# Decisions

Pulse, taken from "runs on the happy path" toward something you could put in front
of a paying client. Roughly four hours, AI-assisted throughout (see CLAUDE.md / TASKS.md
for the agent trail).

## How I worked

I read the whole codebase first and built a tiered bug inventory (TASKS.md) before
touching code: **critical** (security), **correctness** (real users hit these),
**hygiene** (next-engineer quality), **infrastructure** (a base to extend). Then I
worked top-down, one task per commit, verifying each fix with a live request before
moving on. Conventional Commits, no squashing, so the history reads as a narrative.

## What I found and fixed

**Security (the headline).** The seed shipped planted `<strong>` and `=HYPERLINK(...)`
payloads, which confirmed these were the intended traps. All fixed, each with a
verification I can demo.

- **Auth bypass (the big one).** The app used `jwt.decode()`, which never checks the
  signature, so anyone could forge a token with `role: manager` and be trusted. Switched
  to `jwt.verify`, secret from env, fail fast if unset.
- **SQL injection** in nearly every endpoint via raw string interpolation — even though
  parameterized queries existed elsewhere in the same file. Now all parameterized.
- **Stored XSS** from `dangerouslySetInnerHTML` on customer-controlled text. Render as
  text instead.
- **CSV formula injection** in the export. Risky leading characters are now neutralized.
- **Private-note leak** — internal notes marked private were returned to every user. Now
  gated to author + managers.
- **Plaintext passwords** stored and compared directly. Now bcrypt-hashed (seed + `/login`).

**Correctness.**

- **Pagination off-by-one.** `offset = page * SIZE` with 1-based pages silently skipped the
  first ten rows, and the total count ignored the active filter so the pager was wrong
  under search. Fixed the offset and counted with the same filter.
- **Resolve lost-update race.** The server toggled off its own stored value while the
  client optimistically set the opposite, and a 45-second poller with an empty dependency
  array held a stale closure that overwrote the user's view. Made resolve take an explicit
  target status (idempotent) and fixed the poller's dependencies.
- **Summarize crashes.** The endpoint and LLM client threw on a bad id or any non-200 from
  the provider. Both are now guarded, length-capped, and timed out.

**Hygiene.**

- Stopped logging tokens and request bodies on error.
- Removed an LLM API key that was being plumbed through the browser bundle.
- Stopped returning password columns from the API.
- Added input validation and a request-size cap on writes.
- Added loading/error states so failed requests no longer fail silently.

**Scalability & reliability.** The cheap, high-value wins; the deeper single-node SQLite
ceiling I left as a deliberate boundary (documented in KNOWN-ISSUES with its migration
path).

- **Indexes.** The schema had none, so every status filter, customer lookup, and notes join
  was a full table scan — invisible at 80 rows, linear at 100k, and especially bad because
  `better-sqlite3` is synchronous and a slow scan blocks the whole process. Added composite
  and foreign-key indexes on the hot paths; confirmed with `EXPLAIN QUERY PLAN` that the
  inbox query searches an index instead of scanning.
- **Rate limiting.** A loose global cap plus tighter limits on `/login` (brute-force) and
  `/summarize` (LLM cost), verified by watching `/login` return 429 past its threshold.

**Infrastructure.** The project had no deploy sequence, which fails the "shippable" bar. 
So, for production: both images build, the API container seeds its volume on first
boot and skips on restart, and the full stack serves the SPA and proxies the API.

- **Dockerized API** with a multi-stage build.
- **Caddy image** that serves the built SPA and reverse-proxies `/api/*` to the API
  (same-origin, so CORS is no longer wide open).
- **docker-compose** running the whole stack with a persistent SQLite volume.
- **GitHub Actions** that typechecks, builds, runs the smoke tests, and publishes both
  images to GHCR on `master`.

## What I chose not to touch, and why

- **Full credential flow.** Passwords are hashed and password columns are no longer
  exposed, but I deliberately stopped short of building signup, password reset, and
  change-password flows or a strength policy. The hashing is the part that mattered for
  a breach; the flows are feature work that can sit on top of it.
- **Role-based authorization.** Authentication is now sound; authorization beyond it
  (who may resolve, export, reassign) is deferred. The one place it mattered for a data
  leak, private notes, I did gate (author + managers).
- **The web interface** The UI in my opinion is pretty obscene and just pure bad. But 'shippable' 
  can be argued as bug-free and infrastructural if it is time sensitive and for staging/beta version. 
  The very next thing would be revamping UI top to bottom.
- **A broad test suite.** I wrote three high-value smoke tests (forged-token rejection,
  pagination, SQLi) so CI runs something meaningful and the regressions I care most about
  are pinned. A full unit/integration/e2e suite is an extended task.

## Where the time went

The biggest single cost was testing what I had fixed, and also testing
the insfrastructural changes I had made. The native `better-sqlite3` Docker
build is slow (node-gyp), which stretched infra verification. Everything else tracked the
estimates in TASKS.md.

## One thing the agent got wrong

The agent was designing deployment in a way where the JWT-Secret was supposed to be appended
into the compose command like this `JWT_SECRET=anything docker compose up --build`. This is
not something very prod-friendly, so I had it make a `/deploy` folder instead, to house a
`.env` which holds this variable along with the compose file.
