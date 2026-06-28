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
- **SQL injection** in nearly every endpoint via raw string interpolation, even though
  parameterized queries existed elsewhere in the same file. Now all parameterized. Verified:
  `status=open' OR '1'='1` and `q=%'; DROP TABLE feedback;--` both return `items: 0,
  total: 80` (matched as literals, table intact), while a legitimate `q=refund` still
  returns its 5 matches.
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
- **Resolve lost-update race.** Concretely: an agent resolves an item, then the 45-second
  poller fires. Because its effect had an empty dependency array, it held a stale closure
  over the `items` from before the toggle and re-rendered the row as `open`, silently
  reverting what the user just did. The server made it worse by toggling off its own stored
  value rather than an explicit target, so a duplicate or retried click could flip the
  status back. Fixed both sides: resolve now takes an explicit target status (idempotent, so
  repeats and retries are safe), and the poller depends on the real inputs so it no longer
  reads stale state. After the fix, resolving and letting the poller fire leaves the row
  resolved.
- **Summarize crashes.** The endpoint and LLM client threw on a bad id or any non-200 from
  the provider. Both are now guarded, length-capped, and timed out.
- **Prompt injection (partial).** Since summarize runs an LLM over customer-controlled text,
  the message is framed as data in the prompt and length-capped, and the model's output is
  rendered as text, never executed or trusted for control flow. That bounds the blast
  radius; it is not full treatment (see "what I chose not to touch").

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
  was a full table scan, invisible at 80 rows, linear at 100k, and especially bad because
  `better-sqlite3` is synchronous and a slow scan blocks the whole process. Added composite
  and foreign-key indexes on the hot paths. Verified with `EXPLAIN QUERY PLAN`: the inbox
  query went from `SCAN feedback` to `SEARCH feedback USING INDEX
  idx_feedback_status_created (status=?)`, and the notes join and customer history similarly
  hit `idx_notes_feedback` and `idx_feedback_customer`.
- **Rate limiting.** A loose global cap (300/min) plus tighter limits on `/login`
  (10 per 15 min, brute-force) and `/summarize` (20/min, LLM cost). Verified: firing 12
  logins returned `401` ten times, then `429` on the 11th and 12th.

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
- **Full prompt-injection hardening.** The partial mitigation above bounds the risk because
  the summary is only ever displayed, never used to drive an action, so the realistic worst
  case is a misleading summary rather than a breach. I stopped short of stronger measures
  (delimiter/role separation of the customer text, an instruction-stripping pass, or an
  output check) because they matter far more once a summary feeds a decision or an
  automation, which this app does not yet do. Flagged in KNOWN-ISSUES.
- **A broad test suite.** I wrote three high-value smoke tests (forged-token rejection,
  pagination, SQLi) so CI runs something meaningful and the regressions I care most about
  are pinned. A full unit/integration/e2e suite is an extended task.

## Where the time went

About four hours, roughly:

- **Reading + planning (~25 min).** Read the whole codebase and built the tiered inventory
  in TASKS.md before touching code.
- **Security fixes (~45 min).** The five critical items. Mechanical once the pattern was
  clear; the parameterize-every-query sweep was the bulk of it.
- **Correctness fixes (~30 min).** Pagination, the resolve race plus stale-closure poller,
  and the summarize/LLM guards.
- **Hygiene (~30 min).** Token logging, the frontend LLM key, input validation, UI states.
- **Verification throughout (~30 min).** The biggest single cost. Proving each fix with a
  live request rather than just "the tests pass": forged tokens, injection payloads,
  `EXPLAIN QUERY PLAN`, 429s.
- **Infrastructure (~30 min).** Docker images, the Caddy proxy, compose, the GHCR pipeline,
  and reworking the deploy folder. The native `better-sqlite3` Docker build is slow
  (node-gyp), so every rebuild-verify cycle cost real time.
- **Writing Docs (~15 min).** DECISIONS, KNOWN-ISSUES, PRODUCT-NOTE
- **The honest time-loss (~25 min).** Two CI failures that passed locally (detailed in the
  next section), plus reworking the smoke tests to cover edge cases.

## What the agent got wrong, and how I caught it

Fixing the original agent's bugs was the job; the whole app is what that agent got wrong.
The more telling question is where my own agent went wrong this session and how I caught it.

**The CI glob.** The agent wrote the test script as `src/**/*.test.ts`. It passed on my
machine because zsh expands `**` recursively by default, but CI runs under `sh`, which does
not, so the literal string reached Node and it found no tests. Green locally, red in CI. I
caught it because I do not treat a passing local run as proof; I check against the exact
command CI runs. Fixed by pinning an explicit test path.

**The `.ts` import extension.** Earlier, the agent added an import with a `.ts` extension
that the tests happily accepted but `tsc` rejected. Same lesson, same catch: I ran the real
typecheck rather than trusting the test run, and overruled the output.

Both are small, but they are the point of the exercise.