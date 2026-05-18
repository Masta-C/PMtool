# CLAUDE.md — PMtool

> This file is the single source of truth for any AI assistant working in this repo.
> Read it fully before touching any code. It replaces the need to re-explain the project each session.

---

## What is PMtool?

A **shop floor execution system** for manufacturing operations. Operators scan/receive work orders at their assigned workstations, process them through production stages, and hand off to QA. Supervisors and admins manage users, workstations, products, and view reports. The system runs as a **PWA** (Progressive Web App) so it works on tablets and wall-mounted screens on the factory floor with unreliable Wi-Fi.

- **Project ID**: `pmtool-3f8db`
- **Region**: `asia-south1` (all Firebase services)
- **Max Users**: 50 (single-factory deployment)
- **Root**: `/Users/chetanpatil/pmtool`

---

## Current Phase

**Phase 0 — Infrastructure complete. Phase 1 — Active development starting.**

Infrastructure that is live:
- Firebase project, emulators, GitHub Actions CI/CD, branch strategy, auth/session/RBAC, Cloud Functions scaffold, Firestore rules, seed scripts.

Core types and Firestore helpers are stubbed with `// TODO Phase 1` — do not treat these as done.

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14 App Router | Pages in `src/app/` |
| Language | TypeScript (strict) | `noEmit`, paths aliased via `@/*` |
| Database | Cloud Firestore | Offline persistence to be enabled (PWA) |
| Auth | Firebase Auth + HTTP-only cookie | ID token stored as `pmtool-session` cookie |
| Functions | Cloud Functions v2 (onCall) | `asia-south1`, compiled from `functions/src/` |
| State | Zustand | Auth store only (`src/store/authStore.ts`) |
| Styling | Tailwind CSS + CSS variables | Design tokens via `var(--color-*)` |
| Validation | Zod | Used in `src/config/env.ts` — extend for all inputs |
| Testing | Jest + Testing Library | `jsdom` environment, `@/*` paths mapped |
| PWA | **Not yet wired** | Decided — see PWA section below |

---

## Roles & Permissions

```
super_admin → full access, can assign any role, delete users/workstations
admin       → manage users/workstations/products, view all reports
supervisor  → manage users, view reports, cannot delete
operator    → own queue + assigned workstations only
qa          → queue + rework + assigned workstations
```

Role is stored as a **JWT custom claim** (`token.claims.role`) and enforced in three places:
1. **Firestore rules** — `firestore.rules` (server-enforced)
2. **Middleware** — `src/middleware.ts` (Edge Runtime, route-level)
3. **UI** — `canAccess()` in `src/lib/auth/roleGuard.ts` + Sidebar nav filter

Never rely on UI-only role checks. Any write that changes data must be validated by Firestore rules or a Cloud Function.

---

## Data Model (Phase 1 target)

| Collection | Key fields | Notes |
|---|---|---|
| `users/{uid}` | uid, email, displayName, role, workstationIds[], shiftId, isActive | uid = Firebase Auth uid |
| `workstations/{wsId}` | id, name, isActive, passRules[] | ws_01 … ws_13 |
| `workOrders/{orderId}` | currentWsId, status, stageHistory[] | See ORDER_STATUS constants |
| `products/{productId}` | name, stages[], passRules | Drives workstation routing |
| `auditLog/{logId}` | action, actorUid, targetId, timestamp | Append-only, never delete |

**Order statuses**: `pending → in_progress → submitted → qa_review → closed`
Deviation path: `submitted → rework → reassigned → in_progress`
Cancelled is terminal from any state (super_admin only).

**Firestore design rules:**
- Keep stage history as a **subcollection** (`workOrders/{id}/stageHistory/{stageId}`), not an array. Arrays grow unbounded and hit the 1 MB document limit.
- Compound queries (e.g. orders by workstation + status) will need composite indexes — add them to `firestore.indexes.json` as you build, not after.
- Firestore offline persistence (`enableIndexedDbPersistence`) must be enabled in `src/lib/firebase/client.ts` for PWA offline support.

---

## Auth & Session Architecture

**Settled — do not redesign without explicit instruction.**

```
Login page
  → signInWithEmailAndPassword (Firebase client SDK)
  → getIdTokenResult() — reads role custom claim from cached token
  → POST /api/auth/session { idToken }
      → Admin SDK verifyIdToken (emulator-aware)
      → Sets HTTP-only cookie: pmtool-session = idToken
  → router.replace(ROLE_REDIRECT[role])

Middleware (Edge Runtime)
  → Reads pmtool-session cookie
  → Decodes JWT payload with atob() — NOT Buffer.from(..., 'base64url')
  → Checks role via canAccess()
  → Redirects authenticated users away from /login

Sign out
  → DELETE /api/auth/session (clears cookie)
  → firebaseSignOut(auth)
  → window.location.href = '/login'
```

**Known fixed bugs — do not re-introduce:**
1. `Buffer.from(str, 'base64url')` fails in Edge Runtime → always use `atob()` with base64url → base64 conversion
2. Auth layout must not auto-redirect — it fired before the session cookie was set, bouncing users back to login
3. `connectAuthEmulator` guard must use `window.__pmtoolEmulatorsConnected`, not a module-level variable (Fast Refresh resets module scope)
4. `getIdTokenResult()` in `useAuth` must NOT force-refresh (`true`) — call without arguments; login already refreshed the token

---

## Firebase Client Initialization Rules

- All emulator connections are in `src/lib/firebase/client.ts`
- Guard with `window.__pmtoolEmulatorsConnected` to survive Fast Refresh
- Admin SDK is initialized in `src/lib/firebase/admin.ts` — call `initAdminApp()` at the top of every API route before using Admin services
- Never import `src/lib/firebase/client.ts` from a server component or API route — use `admin.ts` there

---

## PWA — Decided, Not Yet Wired

PMtool will be deployed as a PWA. This is decided. Architecture implications:

- Install `@ducanh2912/next-pwa` — it has the best Next.js 14 App Router support
- `next.config.mjs` needs PWA wrapper config
- `public/manifest.json` with app name, icons (192px, 512px), `display: standalone`, `theme_color`
- Service worker caching strategy: **network-first** for Firestore API calls, **cache-first** for static assets
- Enable Firestore offline persistence in `client.ts` with `enableIndexedDbPersistence(db)` — critical for shop floor tablets on spotty Wi-Fi
- iOS Safari requires `<meta name="apple-mobile-web-app-capable">` in root layout
- PWA install prompt should appear for operators on first visit

**Do not add `next-pwa` (the old package) — it doesn't support Next.js 14 App Router well.**

---

## Infra Checklist

### ✅ Done
- Firebase project + emulators (Auth, Firestore, Functions, Hosting, Storage, UI)
- Emulator import/export (`--import=./emulator-data --export-on-exit`)
- Next.js 14, TypeScript strict, Tailwind, Zustand, Zod
- Firebase Auth + HTTP-only session cookie
- Firestore security rules (RBAC enforced server-side)
- Cloud Functions: `setUserRole`, `createUser`, `deleteUser`, `deleteWorkstation`, `healthCheck`
- GitHub Actions: `ci.yml` (feature/develop), `staging-preview.yml` (release/*), `production-deploy.yml` (main)
- Branch strategy: main → prod, develop → CI, feature/* → local, release/* → staging, hotfix/* → prod
- Seed scripts: `scripts/seed-auth.ts`, `scripts/seed.ts`
- `pmtool-dev-ready` skill in `.claude/`

### ✅ Completed in Phase 0 (session 1)
- **CODEOWNERS**: `.github/CODEOWNERS` created — all PRs require `@chetan2321` approval
- **Branch protection**: `develop` and `main` rulesets configured in GitHub UI — PR + CI + CODEOWNERS required
- **PWA**: `@ducanh2912/next-pwa` installed, `next.config.mjs` wrapped, `public/manifest.json` created, placeholder icons added (192px, 512px), root layout updated with PWA metadata
- **`emulator-data/` snapshot**: Exported from live seeded emulator — emulators now boot pre-loaded
- **Functions admin SDK**: Aligned to `firebase-admin ^13` + `firebase-functions ^7` (matches root)
- **Production deploy test gate**: `production-deploy.yml` now runs typecheck → lint → tests before build
- **Environment approval gate**: GitHub environment `production` configured with required reviewer

### ❌ Missing / Not Yet Done
- **Firestore offline persistence**: `enableIndexedDbPersistence` not called yet in `client.ts` — needed for PWA offline support on shop floor tablets
- **Real PWA icons**: `public/icons/icon-192.png` and `icon-512.png` are placeholder solid-colour PNGs — replace with real branded icons before any user testing
- **PR template**: `.github/PULL_REQUEST_TEMPLATE.md` not created yet
- **`.env.example`**: No example env file for onboarding the second developer
- **Firestore indexes**: `firestore.indexes.json` is empty — add composite indexes as queries are built in Phase 1
- **Firestore rules tests**: `@firebase/rules-unit-testing` is installed but no test files exist yet
- **Storage rules**: Currently locked (`allow read, write: if false`) — needs RBAC for product images/attachments in Phase 1
- **Firebase emulator in CI**: Removed from `ci.yml` because `firebase-tools` isn't a project dependency. When integration tests are added, install `firebase-tools` as a devDependency and restore the emulator step using `emulators:exec`
- **`.firebaserc`**: Verify it exists in the root (`firebase use` will fail without it)
- **Dependabot/Renovate**: No automated dependency update config

---

## CI/CD Pipeline

```
feature/* or develop push → ci.yml
  Emulator start → typecheck → lint → jest (coverage)
  Runs on: PRs to develop

release/* push → staging-preview.yml
  Build → Firebase Hosting Preview Channel (7-day expiry)
  URL: staging-<branch-name>.pmtool-3f8db.web.app

main push → production-deploy.yml
  Build → Firebase Hosting (live) → Firestore rules → Cloud Functions → git tag v{version}
  Environment: production (requires manual approval in GitHub)
```

**CI does not seed the emulator before running tests** — tests currently only cover constants. When integration tests are added, the CI seed step will be needed.

---

## PR Review Gate

**Chetan must approve all PRs before merge.** To enforce this:

1. Add `.github/CODEOWNERS`:
   ```
   * @chetan2321
   ```
2. In GitHub repo settings → Branches → Add rule for `develop` and `main`:
   - ✅ Require pull request before merging
   - ✅ Require approvals: 1
   - ✅ Require review from Code Owners
   - ✅ Require status checks: `ci` (from ci.yml)
   - ✅ Require branches to be up to date
   - ✅ Do not allow bypassing the above settings

---

## Dev Environment

**Always use the `pmtool-dev-ready` skill to start the environment.** It handles emulator startup, seeding, and validation in the right order.

```bash
# Ports
Auth emulator:      localhost:9099
Firestore emulator: localhost:8080
Functions emulator: localhost:5001
Emulator UI:        localhost:4000
Next.js:            localhost:3000
```

**After a cold start, always open localhost:3000/login in an incognito window.**
A stale `pmtool-session` cookie in a regular window causes middleware to redirect to a blank `/dashboard`.

### Seed commands (when running manually)
```bash
# Auth users
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 FIRESTORE_EMULATOR_HOST=localhost:8080 npx ts-node --esm scripts/seed-auth.ts

# Firestore data
NEXT_PUBLIC_USE_EMULATOR=true FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 FIRESTORE_EMULATOR_HOST=localhost:8080 npx ts-node --esm scripts/seed.ts
```

### Test credentials
| Role | Email | Password |
|---|---|---|
| super_admin | superadmin@pmtool.dev | Test1234! |
| admin | admin@pmtool.dev | Test1234! |
| supervisor | supervisor@pmtool.dev | Test1234! |
| operator | operator@pmtool.dev | Test1234! |
| qa | qa@pmtool.dev | Test1234! |

---

## Claude's Rules — DO

- **Run the `pmtool-dev-ready` skill** before any work involving auth, Firestore, or Firebase-dependent features
- **Always pass emulator env vars explicitly** when running seed scripts or any Node script that uses Firebase Admin: `FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 FIRESTORE_EMULATOR_HOST=localhost:8080`
- **Use `atob()` for JWT decoding** in any middleware or Edge Runtime code — never `Buffer.from(str, 'base64url')`
- **Use `npx ts-node --esm`** to run TypeScript scripts — `node --loader ts-node/esm` causes cyclic module errors on Node 24
- **Check the `(auth)` layout** if login redirect bugs appear — it must stay as a pass-through (`return <>{children}</>`)
- **Add Firestore indexes** to `firestore.indexes.json` whenever a compound query is added
- **Call `initAdminApp()`** at the top of every new API route before using Admin SDK services
- **Use port checks individually** with separate `curl` calls — the zsh `status=$(...)` pattern fails (`status` is read-only)
- **Keep Cloud Functions in `functions/src/index.ts`**, compiled to `functions/lib/`, region `asia-south1`
- **Validate all user inputs with Zod** — extend the pattern from `src/config/env.ts`
- **Write audit log entries** for any action that creates, updates, or deletes a work order or user
- **Run `npm run typecheck` and `npm run lint`** before marking any task as done
- **Branch from `develop`** for feature work: `feature/short-description`

## Claude's Rules — DON'T

- **Never write to production Firestore** — always verify `NEXT_PUBLIC_USE_EMULATOR=true` is set before any Firestore write in scripts
- **Never `git push` to `main` or `develop` directly** — all changes go through PRs
- **Never call `connectAuthEmulator` more than once** — it will throw on an already-initialized instance; the `window.__pmtoolEmulatorsConnected` guard exists for this reason
- **Never call `getIdTokenResult(true)` in `useAuth`** — the login flow already refreshes the token; force-refresh on every auth state change hits the emulator on every navigation and causes sign-out on failure
- **Never store sensitive data in JWT claims** — only `role` goes in custom claims
- **Never add client-side-only role checks as the sole protection** — Firestore rules are the real gate
- **Never use `npm run seed` from `package.json`** directly — it's missing `FIREBASE_AUTH_EMULATOR_HOST`; use the full manual command above
- **Never import Firebase client SDK** (`src/lib/firebase/client.ts`) from API routes or server components
- **Never add `// @ts-ignore` or `// @ts-expect-error`** without a comment explaining why
- **Never bypass the PR gate** — even for small fixes; hotfix branches go through the `hotfix/*` flow
- **Never use `let emulatorsConnected = false`** at module level for emulator connection guard — Fast Refresh resets it
- **Never deploy Firestore rules separately** in development — they are deployed as part of `production-deploy.yml` only

---

## File Map (quick reference)

```
src/
  app/
    (auth)/login/page.tsx         Login form — handles session cookie + redirect
    (auth)/layout.tsx             Pass-through only — no redirect logic here
    (dashboard)/layout.tsx        Auth guard via useAuth + loading state
    (dashboard)/*/page.tsx        Feature pages (mostly Phase 1 stubs)
    api/auth/session/route.ts     POST: set cookie | DELETE: clear cookie
    api/health/route.ts           Health check
  middleware.ts                   Edge Runtime — cookie decode + RBAC routing
  lib/
    firebase/
      client.ts                   Client SDK init + emulator connection
      admin.ts                    Admin SDK init (API routes only)
    auth/
      roleGuard.ts                canAccess(role, pathname)
      signOut.ts                  Clears cookie + signs out + redirects
  hooks/
    useAuth.ts                    onAuthStateChanged → Zustand store
  store/authStore.ts              Zustand: user, role, loading
  config/
    env.ts                        Zod-validated env vars
    roles.ts                      TODO Phase 1 — role permission config
  types/
    user.ts                       Role type, AppUser interface
    workOrder.ts                  TODO Phase 1
    workstation.ts                TODO Phase 1
  lib/constants.ts                ROLES, ORDER_STATUS, WS_COUNT, MAX_USERS
functions/src/index.ts            Cloud Functions: setUserRole, createUser, deleteUser, deleteWorkstation, healthCheck
scripts/
  seed-auth.ts                    Creates 5 test users in Auth emulator
  seed.ts                         Seeds Firestore: workstations, users, workOrders
.github/
  workflows/
    ci.yml                        Lint + typecheck + tests (feature/develop)
    staging-preview.yml           Preview deploy (release/*)
    production-deploy.yml         Prod deploy + tag (main)
```

---

## Architecture Decisions — Locked

These are decided. Raise a question before changing, don't just refactor:

1. **HTTP-only cookie for session** (not Firebase session cookies or localStorage) — XSS-safe
2. **ID token as session value** (not a custom session token) — simpler, 1-hour expiry, re-login refreshes
3. **Role in JWT custom claim** (not a Firestore lookup per request) — fast, Edge Runtime compatible
4. **Zustand for auth state** (not React Context) — avoids re-render cascades
5. **Cloud Functions for all user/role mutations** (not client-side Admin SDK calls) — server-enforced RBAC
6. **asia-south1 region** — locked for all Firebase services
7. **PWA with Firestore offline persistence** — critical for factory floor tablets
8. **Next.js on Firebase Hosting** (not Vercel) — keeps everything in one Firebase project

---

## Open Architecture Questions (ask before building)

These are not yet decided — bring them up when Phase 1 starts:

1. **Stage history storage**: Subcollection (`workOrders/{id}/stageHistory/`) vs array field? Subcollection is recommended for unbounded history but changes query patterns.
2. **Real-time updates**: `onSnapshot` listeners for the queue (operators see new work orders instantly) vs polling? `onSnapshot` + offline persistence is the right call for PWA but needs careful listener cleanup.
3. **Work order routing logic**: Does the product define the workstation sequence, or is routing manual? This determines the data model for `products` and `workOrders`.
4. **Shift management**: Is `shiftId` on users used for access control (operators only see their shift's orders) or reporting only?
5. **Notifications**: Do supervisors get push notifications for rework/QA failures? Would need Firebase Cloud Messaging (FCM) — not in scope yet.
