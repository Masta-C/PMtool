# Project Setup Guide
> A repeatable blueprint for bootstrapping a Next.js + Firebase project with Claude Code from zero to feature-ready.

---

## Overview

This guide captures everything we did to go from a blank repo to a fully validated, AI-assisted development environment. Follow it for any new project with a similar stack (Next.js 14 App Router, Firebase, TypeScript).

**Time to complete from scratch**: ~1 day of setup, then feature development starts.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 App Router |
| Language | TypeScript (strict mode) |
| Database | Cloud Firestore |
| Auth | Firebase Auth + HTTP-only session cookie |
| Functions | Cloud Functions v2 (onCall) |
| State | Zustand |
| Styling | Tailwind CSS + CSS variables |
| Validation | Zod |
| Testing | Jest + Testing Library |
| PWA | `@ducanh2912/next-pwa` |

---

## Phase 0 — Infrastructure Checklist

Work through these in order. Each section builds on the previous one.

### 1. Firebase Project

- [ ] Create project at [console.firebase.google.com](https://console.firebase.google.com)
- [ ] Enable **Firestore**, **Auth** (Email/Password), **Functions**, **Hosting**, **Storage**
- [ ] Set region consistently (pick one and lock it — e.g. `asia-south1`) for all services
- [ ] Install Firebase CLI: `npm install -g firebase-tools`
- [ ] `firebase login` and `firebase use <project-id>`
- [ ] `firebase init` — select Firestore, Functions, Hosting, Emulators, Storage
- [ ] Verify `.firebaserc` exists at project root

### 2. Next.js App

```bash
npx create-next-app@14 my-app --typescript --tailwind --app --src-dir
cd my-app
npm install firebase firebase-admin zod zustand
npm install -D @types/node
```

- [ ] Set `strict: true` in `tsconfig.json`
- [ ] Configure path alias `@/*` → `./src/*` in `tsconfig.json`
- [ ] Add `npm run typecheck` script: `"typecheck": "tsc --noEmit"`

### 3. Environment Variables

Create `.env.local` with Firebase client config (from Firebase console → Project settings → Your apps):

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_USE_EMULATOR=true          # always true in local dev
NEXT_PUBLIC_EMULATOR_HOST=localhost
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
FIRESTORE_EMULATOR_HOST=localhost:8080
```

Three env files, each with a distinct purpose:

| File | Committed? | Purpose |
|---|---|---|
| `.env.local` | No | Real local values, gitignored |
| `.env.example` | Yes | Dummy values + comments — onboarding reference |
| `.env.production.template` | Yes | Key names only — production deploy reference |

- [ ] Create all three files before the second developer joins
- [ ] Add `.env.local` to `.gitignore`
- [ ] Validate all env vars with Zod in `src/config/env.ts` — fail fast at startup if anything is missing

### 4. Firebase Client & Admin SDK Init

**Client** (`src/lib/firebase/client.ts`):
- Guard emulator connection with `window.__myAppEmulatorsConnected` — module-level booleans reset on Fast Refresh
- Enable Firestore offline persistence with `enableIndexedDbPersistence(db)` — required for PWA offline support. Guard with a second window flag (`window.__myAppPersistenceEnabled`) for the same Fast Refresh reason. Handle the two expected error codes: `failed-precondition` (multiple tabs) and `unimplemented` (unsupported browser)
- Call persistence **after** emulator connection — order matters
- Never import this file from API routes or server components

**Admin** (`src/lib/firebase/admin.ts`):
- Export `initAdminApp()` and call it at the top of every API route
- Read credentials from env vars (never hardcode)

### 5. Auth + Session Architecture

Recommended pattern (XSS-safe, Edge Runtime compatible):

```
Login page
  → signInWithEmailAndPassword
  → getIdTokenResult()              — reads role claim from token
  → POST /api/auth/session { idToken }
      → jose jwtVerify (JWKS)       — no Admin SDK / service account needed in Cloud Run
      → Set HTTP-only cookie: __session = role   ← MUST be __session, plain role string
  → window.location.replace(ROLE_REDIRECT[role]) ← NOT router.replace (RSC fires before cookie commits)

Middleware (Edge Runtime)
  → request.cookies.get('__session').value  — plain ASCII role string, never encoded
  → canAccess(role, pathname)
  → Wrap ALL responses with noCache() — prevents Firebase CDN caching auth redirects

Sign out
  → DELETE /api/auth/session    — clears cookie
  → firebaseSignOut(auth)
  → window.location.href = '/login'
```

**CRITICAL — Firebase Hosting CDN cookie rule:**
Firebase Hosting CDN strips **every cookie** from requests before forwarding to Cloud Run / Cloud Functions — **except `__session`**. This is documented Firebase behavior, not a bug. If you name your session cookie anything else (e.g. `app-session`, `pmtool-session`) it will be silently dropped at the CDN layer. Middleware will see no cookie and redirect to `/login` on every request, even after a successful login.

**CRITICAL — Next.js `cookies.set()` encoding:**
`NextResponse.cookies.set()` percent-encodes values that contain `{`, `"`, or `:`. Storing a JSON object like `{"uid":"...","role":"admin"}` results in `%7B%22uid%22...` in the cookie jar — which `JSON.parse()` cannot read. Store only the role string (`admin`, `supervisor`, etc.) — pure ASCII, never encoded.

```typescript
// session/route.ts — CORRECT
res.cookies.set('__session', role, {   // plain role string, not JSON
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 60,
  path: '/',
})

// middleware.ts — CORRECT
const session = request.cookies.get('__session')
const role = session?.value as Role | null   // read directly, no JSON.parse
```

**CRITICAL — Cache-Control on all middleware responses:**
Firebase Hosting CDN can cache middleware redirect responses (e.g. a 307 for `/dashboard` served to an unauthenticated user). Wrap every `NextResponse` in middleware with `Cache-Control: no-store, private`:

```typescript
function noCache(res: NextResponse): NextResponse {
  res.headers.set('Cache-Control', 'no-store, private')
  return res
}
// Wrap every return: return noCache(NextResponse.redirect(...))
```

**CRITICAL — `window.location.replace` not `router.replace` after login:**
Next.js `router.replace` triggers an RSC prefetch immediately. If that prefetch fires before the `Set-Cookie` header from the session API is committed by the browser, the middleware sees no cookie and redirects back to `/login`. Use `window.location.replace(url)` for a full browser navigation that waits for the response to fully commit.

- [ ] Cookie MUST be named `__session` — Firebase Hosting CDN only forwards this one
- [ ] Store only the role string in the cookie — not JSON, not a JWT
- [ ] Store role as a **Firebase custom claim** — fast, no Firestore lookup per request
- [ ] Auth layout must be a pass-through only — no redirect logic; the login page handles the redirect after the session API returns 200
- [ ] `getIdTokenResult()` in `useAuth` must NOT force-refresh — login already refreshes; force-refresh on every auth state change causes sign-out on emulator failure
- [ ] Use `jose` + `createRemoteJWKSet` with `timeoutDuration: 10_000` — prevents JWKS fetch hanging on Cloud Run cold start
- [ ] Add `noCache()` wrapper to ALL middleware responses

### 6. RBAC

- [ ] Define roles as a TypeScript union type in `src/types/user.ts`
- [ ] Implement `canAccess(role, pathname)` in `src/lib/auth/roleGuard.ts`
- [ ] Enforce in three places: Firestore rules (server), middleware (Edge), UI (`canAccess()`)
- [ ] Never rely on UI-only checks as the sole protection

### 7. Cloud Functions

- [ ] Keep all functions in `functions/src/index.ts`, compiled to `functions/lib/`
- [ ] Use `onCall` for user-facing operations (automatic auth context)
- [ ] All user/role mutations go through Cloud Functions — no client-side Admin SDK calls
- [ ] Set region consistently (same as Firestore)

### 8. Firestore Security Rules

- [ ] Write rules in `firestore.rules` — enforce RBAC server-side
- [ ] Install `@firebase/rules-unit-testing` as devDependency
- [ ] Write at least one test per role per collection before Phase 1

### 8a. Storage Security Rules

Do not leave Storage rules as `allow read, write: if false` — this will silently block all file operations in Phase 1. Write RBAC rules before feature development starts.

Typical pattern:
```
/products/{productId}/{fileName}      → read: authenticated, write: admin+
/workOrders/{orderId}/{fileName}      → read: authenticated, write: all roles, delete: supervisor+
/users/{uid}/{fileName}               → read: authenticated, write/delete: own uid or admin+
/{allPaths=**}                        → deny all (catch-all at the bottom)
```

- [ ] Define helper functions (`role()`, `isAuthenticated()`, `isAdminOrAbove()`) at the top of `storage.rules`
- [ ] Catch-all deny rule must be last

### 9. Firebase Emulators

Configure in `firebase.json`:

```json
{
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "functions": { "port": 5001 },
    "hosting": { "port": 5002 },
    "ui": { "enabled": true, "port": 4000 }
  }
}
```

Add to `package.json`:
```json
"emulators": "firebase emulators:start --import=./emulator-data --export-on-exit",
"dev:full": "concurrently \"npm run emulators\" \"npm run dev\""
```

- [ ] Export a seeded snapshot (`--export-on-exit`) — emulators boot pre-loaded every time

### 10. Seed Scripts

Create `scripts/seed-auth.ts` and `scripts/seed.ts`:

- Auth seed: creates test users with role custom claims via Admin SDK
- Firestore seed: seeds all collections needed for development
- Both scripts must check for `NEXT_PUBLIC_USE_EMULATOR=true` before writing — safety guard against hitting production
- Run with: `FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 FIRESTORE_EMULATOR_HOST=localhost:8080 npx ts-node --esm scripts/seed-auth.ts`
- Use `npx ts-node --esm` — `node --loader ts-node/esm` causes cyclic module errors on Node 22+

### 11. Testing

```bash
npm install -D jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom ts-jest
```

- [ ] Configure `jest.config.ts` with `jsdom` environment and `@/*` path mapping
- [ ] Write tests for: constants, role guard, Zod schemas, utility functions
- [ ] Add `npm run test` to CI

### 12. PWA

```bash
npm install @ducanh2912/next-pwa
```

- [ ] Wrap `next.config.mjs` with `withPWA`
- [ ] Create `public/manifest.json` with name, icons, `display: standalone`, `theme_color`
- [ ] Add 192px and 512px icons to `public/icons/` (real branded icons — not placeholder PNGs)
- [ ] Add PWA meta tags to root layout (`apple-mobile-web-app-capable` for iOS Safari)
- [ ] Enable Firestore offline persistence in `client.ts` — see Section 4 for the exact pattern
- [ ] Use `network-first` caching strategy for API/Firestore calls, `cache-first` for static assets
- [ ] **Use `@ducanh2912/next-pwa`** — the older `next-pwa` package does not support Next.js 14 App Router

### 13. CI/CD

Three GitHub Actions workflows:

| File | Trigger | What it does |
|---|---|---|
| `ci.yml` | Push to `feature/*`, `develop` | typecheck → lint → tests |
| `staging-preview.yml` | Push to `release/*` | Build → Firebase Hosting preview channel |
| `production-deploy.yml` | Push to `main` | typecheck → lint → tests → build → deploy → git tag |

- [ ] Add GitHub environment `production` with required reviewer approval gate
- [ ] Production workflow deploys: Hosting, Firestore rules, Cloud Functions

### 14. Branch Strategy & PR Gate

```
main         → production
develop      → integration / CI
feature/*    → local feature work (branch from develop)
release/*    → staging preview
hotfix/*     → emergency prod fix (branch from main, merge to both main + develop)
```

- [ ] Create `.github/CODEOWNERS`: `* @<your-github-username>`
- [ ] Add branch protection rules for `main` and `develop`:
  - Require PR before merging
  - Require 1 approval + CODEOWNERS review
  - Require status checks to pass (`ci` job)
  - Require branches to be up to date
- [ ] Create `.github/PULL_REQUEST_TEMPLATE.md` with: description, type of change, how-to-test steps, and a checklist (typecheck, lint, test, Firestore rules updated, indexes added, tested with affected roles)

### 15. CLAUDE.md

The most important file in the repo for AI-assisted development. Write it before Phase 1 starts.

**Must cover:**
- What the project is (1-2 paragraphs)
- Current phase and what's done vs. TODO
- Tech stack table
- Roles & permissions
- Data model (even if stubbed)
- Auth & session architecture (settled decisions, do not redesign)
- Firebase init rules (client vs admin, emulator guards)
- CI/CD pipeline summary
- Dev environment setup (ports, seed commands, test credentials)
- DO / DON'T rules for Claude
- File map (quick reference for key files)
- Locked architecture decisions with rationale
- Open questions (unresolved — bring up before building)

Keep it updated. It replaces the need to re-explain the project each session.

---

## Claude Code Setup

### Skills

**Step 1 — Install the mattpocock skill pack (global, one-time):**
```bash
npx skills add mattpocock/skills -y -g
```

This installs 14 skills to `~/.agents/skills/` and symlinks them into `~/.claude/skills/`. Key skills: `to-prd`, `grill-me`, `tdd`, `diagnose`, `to-issues`, `triage`, `zoom-out`, `prototype`, `handoff`.

**Step 2 — Create project-specific skills:**
- Store them in: `.claude/plugins/<project-name>/skills/<project-name>-<skill-name>/SKILL.md`
- Name them with the project prefix: `<project-name>-<skill-name>` (e.g. `pmtool-dev-ready`)
- Set the `name` field in SKILL.md frontmatter to match
- Symlink into `~/.claude/skills/`:
  ```bash
  ln -s "/path/to/.claude/plugins/<project>/skills/<skill-name>" ~/.claude/skills/<skill-name>
  ```
- When a mattpocock skill covers the need, copy its content verbatim — don't rewrite from scratch

**Step 3 — Wire skills into CLAUDE.md:**

Add an `## Agent skills` block near the top of `CLAUDE.md`:

```markdown
## Agent skills

### Issue tracker
Issues are tracked in GitHub Issues on `<org>/<repo>`. See `docs/agents/issue-tracker.md`.

### Triage labels
Five labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs
Single-context layout — `CONTEXT.md` at root, `docs/adr/` for decisions. See `docs/agents/domain.md`.

### Available skills
| Skill | When to use |
|---|---|
| `grill-me` | Stress-test a plan — relentless one-at-a-time interview |
| `to-prd` | Turn requirements into a PRD saved to the repo |
| `to-issues` | Break a PRD into GitHub issues |
| `triage` | Triage issues through the label state machine |
| `tdd` | Red-green-refactor loop |
| `diagnose` | Structured debugging for hard bugs |
| `<project>-dev-ready` | Start and validate the local dev environment |
```

**Step 4 — Create supporting docs:**

```
CONTEXT.md                       ← domain language, key concepts, business rules
docs/agents/issue-tracker.md    ← issue tracker details and gh CLI commands
docs/agents/triage-labels.md    ← triage label strings
docs/agents/domain.md           ← context layout rules (single vs multi)
docs/adr/                       ← architecture decision records (start empty)
```

Skills are invoked via **natural language** — Claude reads the `## Agent skills` block and applies the right skill. No slash command needed.

### Memory

Save project conventions to `~/.claude/projects/<project-path>/memory/` so future sessions inherit them without re-explanation.

Key memories to save:
- Skill naming and storage conventions
- Any non-obvious technical decisions made during setup
- Team preferences (PR style, commit format, etc.)
- A rule to keep `docs/project-setup-guide.md` updated whenever a transferable pattern is discovered

### Dev-Ready Skill

Create a `<project>-dev-ready` skill that starts, seeds, and validates the full local environment. Trigger it at the start of every session involving Firebase or auth. See `pmtool-dev-ready` as a reference.

---

## Validation Checklist (before Phase 1)

Run these before declaring infra done:

```bash
npm run typecheck     # must pass with 0 errors
npm run lint          # must pass with 0 warnings
npm test              # all tests green
```

| Check | Command / How |
|---|---|
| Emulators start | `npm run emulators` — UI at localhost:4000 |
| Seed works | Run seed-auth.ts + seed.ts, verify 5 users in Auth emulator |
| Login flow | Open localhost:3000/login in incognito, log in with each role |
| Middleware redirects | Each role lands on the correct page |
| CI passes | Push a branch, check GitHub Actions |
| Production gate | Confirm `production` environment has a reviewer set in GitHub |

---

## Common Pitfalls

| Problem | Root cause | Fix |
|---|---|---|
| **Login always redirects back to /login on Firebase Hosting** | **Firebase CDN strips all cookies except `__session`** — any other cookie name is silently dropped before Cloud Run receives the request | **Name the session cookie `__session` exactly** — this is the only cookie Firebase Hosting forwards to Cloud Run/Cloud Functions |
| Cookie value is `%7B%22uid%22...` instead of `admin` | `NextResponse.cookies.set()` URL-encodes values containing `{`, `"`, `:` — JSON objects get mangled | Store only the role string (`admin`, `supervisor`) — pure ASCII, never encoded |
| Logged-in user bounced back to /login after `router.replace` | `router.replace` triggers RSC prefetch before `Set-Cookie` is committed by the browser | Use `window.location.replace(url)` for a full page navigation that waits for cookie to commit |
| Firebase CDN cached a 307 for /dashboard | Unauthenticated request to /dashboard was cached by Firebase CDN and served to all subsequent visitors | Add `Cache-Control: no-store, private` to every middleware response via a `noCache()` wrapper |
| Session API hangs on first request after idle | `jose createRemoteJWKSet` has no timeout — hangs indefinitely on JWKS fetch during Cloud Run cold start | Pass `timeoutDuration: 10_000` to `createRemoteJWKSet` |
| JWT decode fails in middleware | `Buffer.from(str, 'base64url')` not available in Edge Runtime | Don't store the JWT in the cookie at all — store the role string and read it directly |
| Emulator connects twice on Fast Refresh | Module-level boolean resets on HMR | Guard with `window.__appEmulatorsConnected` |
| Firestore persistence enables twice on Fast Refresh | Same as above — module scope resets | Guard with a second `window.__appPersistenceEnabled` flag |
| Login redirects to blank dashboard | Auth layout fired redirect before session cookie was set | Auth layout must be a pass-through; login page redirects after session API returns 200 |
| Sign-out on every page navigation | `getIdTokenResult(true)` force-refreshes on every auth state change | Remove the `true` argument — login already refreshes |
| File uploads silently fail in Phase 1 | Storage rules still set to `allow read, write: if false` | Write RBAC storage rules before feature development starts — see Section 8a |
| Seed script hits production | Missing `NEXT_PUBLIC_USE_EMULATOR=true` check | Add guard at top of seed script: abort if env var is not set |
| `ts-node` cyclic module errors | Using `node --loader ts-node/esm` on Node 22+ | Use `npx ts-node --esm` instead |
| Stale session cookie in browser | Cold emulator restart invalidates old tokens | Always use incognito after a cold start |
| Second developer can't run the project | No `.env.example` committed | Create `.env.example` with dummy values before anyone else joins |

### Debugging auth failures on Firebase Hosting — correct methodology

When login works locally (emulator) but fails on Firebase Hosting, run this sequence:

```bash
# 1. Confirm what cookie the server actually receives
curl -H "Cookie: __session=admin" https://<project>.web.app/dashboard -v 2>&1 | grep -E "< HTTP|Location"

# 2. Test the Cloud Run URL directly (bypass Firebase CDN)
#    Get the Cloud Run URL from: Firebase Console → Hosting → Advanced → Backend
curl -H "Cookie: __session=admin" https://<cloud-run-url>/dashboard -v 2>&1 | grep -E "< HTTP|Location"

# If (1) gives 307 but (2) gives 200: CDN is stripping the cookie → rename to __session
# If both give 307: middleware logic is wrong — check cookie value format
# If both give 200: client-side navigation issue — check router.replace vs window.location

# 3. Check what the server actually reads
curl https://<project>.web.app/api/debug/cookie  # add a temporary debug endpoint
```

Add a temporary `/api/debug/cookie` endpoint during diagnosis:
```typescript
// src/app/api/debug/cookie/route.ts — DELETE AFTER DIAGNOSIS
import { NextRequest, NextResponse } from 'next/server'
export async function GET(req: NextRequest) {
  const session = req.cookies.get('__session')
  return NextResponse.json({
    present: !!session,
    value: session?.value ?? null,
    allCookieNames: req.cookies.getAll().map(c => c.name),
  })
}
```
- `present: false` → cookie not reaching Cloud Run (CDN stripping it — wrong cookie name)
- `value: '%7B...'` → JSON was stored, Next.js encoded it — switch to plain role string
- `value: 'admin'` → cookie is correct, issue is in middleware logic or client navigation
