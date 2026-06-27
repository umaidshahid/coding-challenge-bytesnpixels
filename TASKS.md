# Pulse — Shippability Tasks

Working task list for turning Pulse into something we'd put in front of a paying client.
Driven against the 3-4h budget. Each task is tagged with a tier, an estimate, and a
ship/defer decision. This file is the plan we execute against; the rationale graduates
into DECISIONS.md and KNOWN-ISSUES.md at the end.

Legend: **[DO]** = doing now · **[DEFER]** = documented in KNOWN-ISSUES, not built ·
**[?]** = open question, decide before/while building.

---

## Tier 1 — Critical (security; would embarrass us in front of a paying client)

- [x] **C1 — Auth is theater.** `auth.ts` uses `jwt.decode()` not `jwt.verify()`; signature
  never checked → anyone can forge any `id`/`role`. Secret is hardcoded
  (`pulse-dev-secret-2024`) and ignores `JWT_SECRET` env. Same `jwt.decode` flaw in
  `getExportUser` in index.ts. **[DO]** ~20m
  - Fix: `jwt.verify` in a shared helper; secret from `process.env.JWT_SECRET`, fail fast if
    unset in prod. Apply to both `authenticate` and the export path.

- [x] **C2 — SQL injection across most endpoints.** Raw string interpolation in `/feedback`
  filters, `/metrics`, `/export.csv`, `POST /feedback/:id/assignment` (UPDATE), and the
  notes queries. Parameterized queries already exist elsewhere in the file, so the pattern
  is known. **[DO]** ~40m
  - Fix: convert every interpolated query to bound `?` params. Build WHERE clauses with a
    params array.

- [x] **C3 — Stored XSS.** `dangerouslySetInnerHTML` on message body, note body, and summary
  in ItemDetail.tsx. Seed data ships `<strong>` / `<em>` payloads (deliberate plant).
  Customer-controlled text rendered as raw HTML. **[DO]** ~15m
  - Fix: render as text. If any formatting is genuinely wanted, sanitize allowlist — but
    default to plain text.

- [x] **C4 — CSV injection.** `csvCell` quotes/escapes but does not neutralize leading
  `= + - @`. Seed ships a `=HYPERLINK(...)` row (deliberate plant). Opens in Excel → formula
  executes. **[DO]** ~10m
  - Fix: prefix risky leading chars with `'` (or space) before quoting.

- [x] **C5 — Private notes leak.** `GET /feedback/:id/notes` returns `is_private` notes to
  everyone; nothing filters on the flag. Field is currently meaningless. **[DO]** ~10m
  - **Rule (decided):** a private note is visible to its author and to any user with role
    `manager`; otherwise filtered out of the response. Requires the authenticated user's id +
    role (now trustworthy after C1).

---

## Tier 2 — Correctness (real users will hit these)

- [x] **K1 — Pagination broken two ways.** (a) `offset = page * PAGE_SIZE` with page starting
  at 1 → page 1 skips the first 10 rows. (b) `total` is always the *unfiltered* COUNT(*), so
  pager math is wrong under any filter/search. **[DO]** ~20m
  - Fix: `offset = (page - 1) * PAGE_SIZE`; compute total with the same WHERE as the query.

- [x] **K2 — Resolve toggle race / lost update.** Server toggles off its *own* current value
  rather than an explicit target; client optimistically sets the opposite; the 45s poller has
  a stale closure (empty dep array over `items`/`page`/`filter`) → state desync. **[DO]** ~30m
  - Fix: make resolve take an explicit target status (idempotent). Fix or remove the poller;
    if kept, use a ref or correct deps.

- [x] **K3 — `/summarize` + `llm.ts` unguarded.** No null check on `row` → 500 on bad id.
  `data.choices[0]` crashes on any non-200 from OpenAI. No length cap → prompt-injection +
  unbounded token cost. **[DO]** ~20m
  - Fix: 404 on missing row; check `response.ok` and shape; truncate message before prompting;
    return a friendly error.

- [x] **K4 — `serializeFeedback` assumes customer exists.** `customer.name` throws on a
  dangling FK. **[DO]** ~5m
  - Fix: null-guard; fall back to placeholder.

---

## Tier 3 — Hygiene (the "next engineer doesn't wince" axis)

- [x] **H1 — Token logging.** Errors logged with `req.headers.authorization` (index.ts,
  auth.ts) → tokens in logs. **[DO]** ~5m — drop the token from log lines.

- [x] **H2 — Frontend LLM key.** `x-llm-key` header + `VITE_OPENAI_API_KEY` plumb a secret
  into the browser bundle; server ignores it anyway. **[DO]** ~10m — remove client-side key
  entirely; key stays server-only.

- [x] **H3 — Input validation on writes.** Assignment + notes accept arbitrary bodies. **[DO]**
  ~20m — thin validation (enum priority, numeric/nullable assignee, date shape, note length).

- [x] **H4 — CORS wide open.** `cors()` with no config. **[DO once proxy exists]** ~5m —
  restrict to known origin; behind Caddy same-origin it can be dropped.

- [x] **H5 — UI loading/error states.** No loading or error feedback on any fetch; failed
  requests fail silently (`catch {}` in summarize). **[DO light]** ~20m — minimal states on
  the core flows.

- [x] **H6 — Password handling.** Plaintext passwords in seed; `password?` leaks into `User`
  type; `/users` does `SELECT *`. **[DEFER hashing]** — too big for budget; **[DO]** stop
  selecting/returning password fields (~10m). Hashing → KNOWN-ISSUES.

---

## Tier 4 — Infrastructure (net-new; "solid base to extend")

- [x] **I1 — Dockerize.** Multi-stage build. Pin Node base (native `better-sqlite3` build
  deps). SQLite file on a named volume. **[DO]** ~30m
  - **Decided:** two services. Caddy serves the built static SPA and reverse-proxies `/api/*`
    to the Express container. Lets us drop wide-open CORS (same-origin).

- [x] **I2 — Caddy reverse proxy.** Automatic HTTPS; route `/api/*` → Express, else → SPA.
  Enables dropping wide-open CORS (same-origin). **[DO]** ~20m

- [x] **I3 — docker-compose.** Caddy + API + SQLite volume; one-command local prod-parity.
  **[DO]** ~15m

- [x] **I4 — CI/CD (GitHub Actions).** PR: typecheck + build + smoke tests. On `master`: build
  image, push to **GHCR**. **[DO]** ~30m

- [x] **I5 — Smoke tests.** ~2-3 real tests so CI runs something meaningful (e.g. auth rejects
  forged token, pagination returns correct page, SQLi attempt is neutralized). **[DO]** ~25m

---

## Tier 5 — Deferred (KNOWN-ISSUES, deliberately not built)

- Password hashing (bcrypt/argon2) + real credential flow.
- Role-based access control / authorization beyond authentication.
- Refresh tokens / token revocation; 7d JWT with no logout-invalidation.
- Rate limiting + request size limits.
- Structured logging + request IDs.
- Broad automated test suite (unit + integration + e2e) beyond smoke tests.
- Real LLM provider hardening (retries, timeouts, streaming, cost controls).
- Accessibility pass; responsive/mobile.

---

## Deliverables (required by the brief)

- [x] **DECISIONS.md** (~1 page) — what changed, what we found, what we left and why; honest
  note on where time went; why we declined Spec Kit.
- [x] **KNOWN-ISSUES.md** — what's still broken + what we'd do with another day (Tier 5).
- [x] **Product note** (~½ page) — if real client + two weeks: what to build, what to cut.
- [x] **Agent trail** — CLAUDE.md + this TASKS file + commit history as the record of how we
  drove the agent.

---

## Decisions locked

1. **C5 private-notes rule:** visible to author + role `manager`; filtered otherwise.
2. **Image topology:** two services (Caddy serves SPA, proxies `/api/*` to Express).
3. **Commits:** one per task ID. Conventional Commits (`feat:`, `fix:`, `chore:`, etc.),
   short subjects, **no signature/Co-Authored-By trailer**.
4. **Scope ceiling:** hold the Tier-5 line; infra + spine fills the budget.

## Commit type per task (planned)

- C1 `fix:` auth · C2 `fix:` SQLi · C3 `fix:` XSS · C4 `fix:` CSV injection ·
  C5 `feat:` private-note visibility
- K1 `fix:` pagination · K2 `fix:` resolve race · K3 `fix:` summarize guards · K4 `fix:` serialize guard
- H1 `fix:` token logging · H2 `chore:` drop frontend LLM key · H3 `feat:` input validation ·
  H4 `chore:` cors · H5 `chore:` strip marquee · H6 `feat:` ui states · H7 `fix:` password exposure
- I1 `chore:` dockerize · I2 `chore:` caddy · I3 `chore:` compose · I4 `ci:` actions+GHCR · I5 `test:` smoke tests
