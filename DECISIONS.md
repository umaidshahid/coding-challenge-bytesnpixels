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

**Security (the headline).** The app authenticated with `jwt.decode()`, which never
checks the signature, so anyone could forge a token with `role: manager` and be trusted.
That was the single most important fix (`jwt.verify`, secret from env, fail fast if
unset). Alongside it: SQL injection in nearly every endpoint (raw string interpolation,
even though parameterized queries existed elsewhere in the same file), stored XSS via
`dangerouslySetInnerHTML` on customer-controlled text, CSV formula injection in the
export, and private internal notes that leaked to every user. The seed data contained
planted `<strong>` and `=HYPERLINK(...)` payloads, which confirmed these were the
intended traps. All five are fixed and each has a verification I can demo.

**Correctness.** Pagination was off-by-one (`offset = page * SIZE` with 1-based pages, so
page 1 silently skipped the first ten rows) and the total count ignored the active
filter, so the pager was wrong under search. The resolve toggle was a lost-update race:
the server toggled off its own stored value while the client optimistically set the
opposite, and a 45-second poller with an empty dependency array held a stale closure that
overwrote the user's view. I made resolve take an explicit target status (idempotent) and
fixed the poller's dependencies. The summarize endpoint and LLM client crashed on a bad
id or any non-200 from the provider; both are now guarded, length-capped, and timed out.

**Hygiene.** Stopped logging tokens and request bodies on error, removed an LLM API key
that was being plumbed through the browser bundle, stopped returning password columns,
added input validation and a request-size cap, and added loading/error states so failed
requests no longer fail silently.

**Infrastructure.** The repo had no deploy story, which fails the "base the team can build
on" bar. I added a Dockerized API, a Caddy image that serves the built SPA and reverse-
proxies `/api/*` to the API (same-origin, so CORS is no longer wide open), a docker-compose
that runs the whole stack with a persistent SQLite volume, and a GitHub Actions pipeline
that typechecks, builds, runs the smoke tests, and publishes both images to GHCR on
`master`. I verified this for real: both images build, the API container seeds its volume
on first boot and skips on restart, and the full stack serves the SPA and proxies the API.

## What I chose not to touch, and why

- **Password hashing.** Passwords are still plaintext in the seed. Doing this properly
  (hashing, a signup/credential flow, migrating seed data) is a larger change than the
  budget allowed and is not what the demo turns on. I did the cheap half (stop exposing
  password columns) and flagged the rest loudly in KNOWN-ISSUES.
- **Role-based authorization.** Authentication is now sound; authorization beyond it
  (who may resolve, export, reassign) is deferred. The one place it mattered for a data
  leak, private notes, I did gate (author + managers).
- **A broad test suite.** I wrote three high-value smoke tests (forged-token rejection,
  pagination, SQLi) so CI runs something meaningful and the regressions I care most about
  are pinned. A full unit/integration/e2e suite is next-day work.
- **The retro joke branding** (marquee, emoji). Cosmetic; left as-is to stay in budget.

## Where the time went

The biggest single cost was not a bug but a git mistake of my own: I bundled two hygiene
fixes into one commit, and cleaning up the history surfaced pre-existing uncommitted
changes in the working tree (a dependency bump, deleted `.env.example` files). Untangling
that and restoring the env examples cost ~15 minutes. The native `better-sqlite3` Docker
build is slow (node-gyp), which stretched infra verification. Everything else tracked the
estimates in TASKS.md.

## One thing the agent got wrong

When I asked for the smoke tests, the agent wrote dynamic imports ending in `.ts`. They
ran fine under `tsx`, so the tests passed locally, but `tsc --noEmit` rejected them, which
the CI typecheck would have failed on. I caught it because I ran the exact command CI runs
rather than trusting the green test output. Good illustration of why "the tests pass" is
not the same as "this is correct."
