# Deployment Plan

> Status: **Deployed** (2026-11-17). Web: https://study-flow-psi-two.vercel.app · API: https://studyflow-api-yaq3.onrender.com
> (free tier). D1–D2 done; D3 partly verified (see below). Hosting limits below were checked
> against public sources in November 2026; confirm current terms when creating accounts.

## Why this phase, and why now

**User problem.** A portfolio project you can't open is only a claim. Recruiters and test students
need a link that works, on their phone, without cloning a repo.

**Why now.** Phases A–C made the core loop real and persistent: import → review → plan → replan.
Deployment is the step that turns the resume bullets into something a reader can verify, and it
forces the production concerns a real product has (secrets, HTTPS, a managed database, monitoring).

## Recommended architecture

```text
Browser ──HTTPS──▶ Vercel (Next.js)
                     │  rewrites /api/*  (same-origin: session cookie stays HttpOnly + SameSite=Lax)
                     ▼
                  Render (FastAPI, Python 3.12) ──TLS──▶ Neon (Postgres)
                     │
                     └──HTTPS──▶ school Canvas instances (SSRF-guarded)
Browser ──HTTPS──▶ Google Identity / Calendar API (read-only, token never leaves the browser)
```

| Layer | Choice | Why | Cost to start |
| --- | --- | --- | --- |
| Web | **Vercel Hobby** | Native Next.js hosting, preview deploy per PR, HTTPS by default. Hobby is non-commercial, which fits a portfolio project | $0 |
| API | **Render** web service | Deploys straight from GitHub, simple env/secrets, health checks | $0 to start, **$7/mo** to stay always-on |
| Database | **Neon Postgres** (Free) | Managed Postgres, no card required, 1 GB/project is far more than StudyFlow needs | $0 |
| Domain | Optional at first; **required** for public Google Calendar (see below) | Google's consent-screen verification needs a domain you can prove you own | ~$10–15/yr |

### The two constraints that shape this plan

1. **Render's free tier sleeps.** Free services spin down after 15 idle minutes and take about a
   minute to wake; they also lose local files, so **SQLite can't be used in production**. That's
   fine while building, but a recruiter's first click would hit a minute-long cold start (and may
   exceed the proxy's timeout). **Recommendation:** build on Free, switch the API to the $7 instance
   before sharing the link.
2. **Google Calendar needs verification to go public.** `calendar.readonly` is a sensitive scope.
   In "Testing" mode, only Google accounts you add as test users (up to 100) can connect, and they
   see an "unverified app" warning. Public access requires consent-screen verification: a homepage,
   a privacy policy, and a verified domain (a `*.vercel.app` subdomain can't be verified). Review
   is reported at 3–10 business days. **Recommendation:** launch with Calendar in Testing mode, and
   pursue verification only after buying a domain. Canvas works for everyone from day one.

## Work plan

### D1 — Production readiness in code — ✅ done

- **Postgres storage.** Add a Postgres backend (`psycopg` 3) selected by `DATABASE_URL`; keep
  SQLite for local dev and tests. Same repository interface; `INSERT OR IGNORE` → `ON CONFLICT DO
  NOTHING`, placeholder style per driver. Run the API tests against both in CI (Postgres service
  container).
- **Fail-fast production config.** In `STUDYFLOW_ENV=production`, refuse to start without
  `STUDYFLOW_SECRET_KEY`, `DATABASE_URL`, and explicit allowed origins; force secure cookies.
- **Demo workspace.** A recruiter has no Canvas token, so the live link would open to an empty app.
  Add **"Explore with sample data"**: a clearly labelled, removable sample workspace (a realistic
  CS student week) so the whole flow (review, plan, health, replanning) is visible in 10 seconds.
  It's labelled as sample data everywhere, never mixed with real imports, and one click clears it.
  This respects the "no fake data" rule because it's explicit, opt-in, and labelled.
- **Privacy page** (`/privacy`): what's stored, what isn't, how to delete it. Needed for Google
  verification and good practice regardless.
- **Abuse limits.** Rate-limit `/canvas/connect` and `/canvas/sync` per session and IP; cap new
  sessions per IP; purge sessions idle for 180 days (startup task or scheduled job).
- **Security headers** in Next.js: CSP (allowing only Google Identity), `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'`.
- **Health check** that verifies DB connectivity (`/health/ready`) for Render's health checks.
- **Deploy config as code:** `render.yaml` (build, start, health check, env var names without
  values), Vercel project settings documented in this file.

**Shipped:** everything above. Verified: 56 API tests on SQLite and on a real Postgres server,
web typecheck/build, sample workspace load and clear, `/privacy`, headers, and no CSP violations in
the console. Rate limits are in-memory, which is correct for a single API instance.

**Acceptance:** CI green on SQLite *and* Postgres; production mode refuses a missing secret; demo
workspace loads, is labelled, and clears; `/privacy` renders; rate limit returns 429 with a clear
message; security headers present in `next build` output.

### D2 — Accounts and secrets (you do this) — ✅ done

Creating accounts and entering secrets is yours to do. About 20 minutes; all free tiers, no card
needed except to upgrade Render later.

**1. Generate the encryption key (locally, once).** Keep it only in Render; don't commit or
share it.

```bash
apps/api/.venv/bin/python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**2. Neon (database).**
1. Sign up at neon.com and create a project (region: *US West*, close to Render's Oregon region).
2. Copy the **pooled** connection string (`postgresql://…-pooler…/neondb?sslmode=require`).

**3. Render (API).**
1. Sign up with GitHub and choose **New → Blueprint**, then select this repository. Render reads
   `render.yaml`.
2. When prompted, fill in the three secret values:
   - `DATABASE_URL`: the Neon string from step 2.
   - `STUDYFLOW_SECRET_KEY`: the key from step 1.
   - `STUDYFLOW_ALLOWED_ORIGINS`: leave as `https://placeholder.invalid` for now; you'll update
     it after step 4.
3. Deploy, then open `https://<your-service>.onrender.com/health/ready`. You should see
   `{"status":"ready"}`.

**4. Vercel (web).**
1. Sign up with GitHub and choose **Add New → Project**, then import this repository.
2. Set **Root Directory** to `apps/web`; the framework is detected as Next.js.
3. Add environment variables:
   - `STUDYFLOW_API_ORIGIN`: `https://<your-service>.onrender.com`
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: your existing client ID.
4. Deploy and note the production URL (`https://<project>.vercel.app`).

**5. Close the loop.**
1. In Render, set `STUDYFLOW_ALLOWED_ORIGINS` to the Vercel URL. Render redeploys automatically.
2. In Google Cloud Console → *APIs & Services → Credentials → your OAuth client*, add the Vercel
   URL under **Authorized JavaScript origins**.
3. Under *OAuth consent screen → Audience*, add each tester's Google account as a **test user**.

### D3 — Deploy and verify (together)

- Auto-deploy: Render from `main`; Vercel production from `main`, previews for PRs.
- Smoke test against production: cookie flags over HTTPS, CSRF header enforced, workspace
  save/reload, sample workspace, plan generation, Canvas connect with a real token, Calendar
  connect as a test user, delete-my-data.
- **Acceptance:** every smoke-test item passes on a phone and a laptop; no secrets in logs.

**Verified on 2026-11-17 against production:** `/health/ready` reports ready (API ↔ Neon); the `/api`
proxy works same-origin; the session cookie is `HttpOnly; Secure; SameSite=Lax`; CORS allows only the
Vercel origin; writes without the CSRF header return 403; security headers (CSP, HSTS, DENY framing,
nosniff) are present; the sample workspace loads, survives a reload, and clears; delete-my-data wipes
the session; no console errors; no horizontal scroll at 375px. **Still to verify by hand:** Canvas
connect with a real token, Calendar connect as a test user, and a pass on a real phone.

### D4 — Make it portfolio-ready

- Free uptime monitor on `/health/ready`; Render log alerts on 5xx.
- README: live link, screenshots/GIF, architecture diagram, "try the sample data" note.
- Short demo video: connect Canvas → review → plan → replan after a change.
- Optional: custom domain → Google verification → public Calendar access.

## Risks

| Risk | Mitigation |
| --- | --- |
| Cold starts on a free API make the demo look broken | $7 always-on instance before sharing |
| Vercel ↔ Render latency on every API call | Same region for both (e.g. US West); responses are small |
| Losing the encryption key makes stored Canvas tokens unreadable | Key lives in Render's secret store; losing it only forces students to reconnect (handled) |
| Anonymous sessions are per-browser | Documented; accounts are the next product phase |
| Public abuse of Canvas proxying | SSRF guard (existing) + rate limits (D1) |

## Decisions needed

1. Approve the stack (Vercel + Render + Neon)?
2. API: $7/mo always-on before sharing, or stay free and accept cold starts?
3. Buy a domain now (enables public Google Calendar), or launch with Calendar in Testing mode?
4. Add the labelled sample-data workspace?
