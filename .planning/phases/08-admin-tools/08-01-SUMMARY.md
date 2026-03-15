---
phase: 08-admin-tools
plan: 01
subsystem: auth
tags: [jwt, jose, next-proxy, admin-ui, azure-sql]

requires:
  - phase: none
    provides: standalone foundation for admin features
provides:
  - JWT auth system (signToken, verifyToken, requireAdmin, requireCaptain)
  - Admin route protection via proxy.ts
  - DB tables for blog, lineups, captain sessions
  - Shared admin types (TokenPayload, StagedMatch, StagedBowler, BlogPost, etc.)
  - Admin login flow and sidebar layout
affects: [08-02, 08-03, 08-04, 08-05]

tech-stack:
  added: [jose]
  patterns: [proxy.ts route protection, JWT httpOnly cookie auth, route group for auth bypass]

key-files:
  created:
    - proxy.ts
    - src/lib/admin/auth.ts
    - src/lib/admin/types.ts
    - src/app/admin/AdminShell.tsx
    - src/app/admin/login/page.tsx
    - src/app/admin/(dashboard)/layout.tsx
    - src/app/admin/(dashboard)/page.tsx
    - src/app/api/admin/auth/login/route.ts
    - src/app/api/admin/auth/logout/route.ts
    - scripts/create-admin-tables.mjs
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Used route group (dashboard) to prevent auth redirect loop on login page"
  - "proxy.ts does cookie existence checks only; full JWT verification in layout/API routes"
  - "AdminShell uses fixed positioning to overlay public site layout (Header/Footer)"

patterns-established:
  - "Admin auth: JWT in httpOnly cookie, verified in server layout, cookie check in proxy.ts"
  - "Route group pattern: (dashboard) for auth-protected admin pages, login outside group"
  - "Admin API routes: POST endpoints returning JSON, cookie set/clear via NextResponse"

requirements-completed: [ADMN-01, ADMN-02]

duration: 4min
completed: 2026-03-14
---

# Phase 8 Plan 01: Admin Foundation Summary

**JWT admin auth with jose, proxy.ts route protection, 4 new DB tables, and sidebar admin layout**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-15T01:46:07Z
- **Completed:** 2026-03-15T01:50:31Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- JWT authentication system with signToken/verifyToken/requireAdmin/requireCaptain helpers using jose
- Four new DB tables created: blogPosts, lineupSubmissions, lineupEntries, captainSessions
- Admin login page with password auth, cookie-based session, and responsive sidebar layout
- proxy.ts protecting /admin/*, /lineup/*, and /api/admin/* routes
- Shared TypeScript types for the entire admin system (TokenPayload, StagedMatch, BlogPost, etc.)

## Task Commits

Each task was committed atomically:

1. **Task 1: DB schema, auth library, shared types, and proxy.ts** - `73b2e5c` (feat)
2. **Task 2: Admin login page, API routes, and admin layout with sidebar** - `acbe55a` (feat)

## Files Created/Modified
- `proxy.ts` - Next.js 16 route protection (cookie existence checks for admin/lineup/API routes)
- `src/lib/admin/auth.ts` - JWT helpers: signToken, verifyToken, requireAdmin, requireCaptain
- `src/lib/admin/types.ts` - Shared types: TokenPayload, StagedMatch, StagedBowler, BlogPost, etc.
- `scripts/create-admin-tables.mjs` - Idempotent migration for blogPosts, lineupSubmissions, lineupEntries, captainSessions
- `src/app/admin/AdminShell.tsx` - Client component: navy sidebar nav + hamburger mobile menu + logout
- `src/app/admin/login/page.tsx` - Client component: password form with error handling
- `src/app/admin/(dashboard)/layout.tsx` - Server component: JWT verification, redirect on invalid
- `src/app/admin/(dashboard)/page.tsx` - Placeholder dashboard page
- `src/app/api/admin/auth/login/route.ts` - POST: verify password, set JWT cookie
- `src/app/api/admin/auth/logout/route.ts` - POST: clear JWT cookie
- `package.json` - Added jose dependency

## Decisions Made
- Used Next.js route group `(dashboard)` to separate login page from auth-protected layout, preventing infinite redirect loop
- proxy.ts does lightweight cookie existence checks only (no JWT verification), keeping it fast; full verification in layout and API routes
- AdminShell uses fixed positioning (z-100) to overlay the public site's Header/Footer, avoiding the need to restructure to route groups at the root level
- Login API sets cookie path to `/` (not `/admin`) so the cookie is accessible to proxy.ts matcher on all protected paths

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Route group to prevent auth redirect loop**
- **Found during:** Task 2 (Admin layout)
- **Issue:** Admin layout at `admin/layout.tsx` wraps all admin pages including login. Unauthenticated users visiting `/admin/login` would trigger the layout's auth check, redirecting back to `/admin/login` in an infinite loop.
- **Fix:** Moved layout and dashboard page into `admin/(dashboard)/` route group. Login page stays at `admin/login/` outside the group, bypassing the auth layout.
- **Files modified:** `src/app/admin/(dashboard)/layout.tsx`, `src/app/admin/(dashboard)/page.tsx`
- **Verification:** Login page accessible without auth; dashboard pages protected by layout auth check
- **Committed in:** `acbe55a` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for correct auth flow. No scope creep.

## Issues Encountered
None

## User Setup Required
The admin system requires two environment variables to be set:
- `ADMIN_JWT_SECRET` - Secret key for JWT signing (any random string, e.g., `openssl rand -hex 32`)
- `ADMIN_PASSWORD` - The admin password for login

These should be added to `.env.local` and Vercel environment variables.

## Next Phase Readiness
- Auth foundation complete: all subsequent admin plans can use requireAdmin() for API protection
- DB tables ready: blogPosts, lineupSubmissions, lineupEntries, captainSessions
- Shared types exported from src/lib/admin/types.ts for use across plans
- Admin layout provides sidebar navigation to all admin subsections

---
*Phase: 08-admin-tools*
*Completed: 2026-03-14*
