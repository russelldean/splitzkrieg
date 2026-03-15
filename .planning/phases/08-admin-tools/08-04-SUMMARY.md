---
phase: 08-admin-tools
plan: 04
subsystem: api, ui, database
tags: [blog, markdown-editor, mdx, crud, azure-sql, react-md-editor]

requires:
  - phase: 08-01
    provides: "Admin auth (JWT), proxy, AdminShell layout, DB tables"
  - phase: 08-02
    provides: "Score pipeline for confirmed scores (auto-draft depends on scores data)"
provides:
  - "Blog CRUD against Azure SQL blogPosts table"
  - "Admin blog editor with side-by-side markdown preview"
  - "Auto-draft recap generation from confirmed scores"
  - "DB-backed public blog pages (replaced filesystem MDX)"
  - "Migration script for existing MDX posts"
affects: [blog, admin-tools]

tech-stack:
  added: ["@uiw/react-md-editor"]
  patterns: ["DB-backed blog with MDX rendering via MDXRemote", "Auto-draft from score data using WeekRecap component"]

key-files:
  created:
    - src/lib/admin/blog-db.ts
    - src/app/api/admin/blog/route.ts
    - src/app/api/admin/blog/[id]/route.ts
    - src/app/api/admin/blog/auto-draft/route.ts
    - src/app/admin/(dashboard)/blog/page.tsx
    - src/app/admin/(dashboard)/blog/[id]/page.tsx
    - scripts/migrate-blog-to-db.mjs
  modified:
    - src/lib/blog.ts
    - src/app/blog/page.tsx
    - src/app/blog/[slug]/page.tsx
    - src/app/page.tsx
    - src/app/week/[seasonSlug]/[weekNum]/page.tsx

key-decisions:
  - "blogPosts table schema extended with excerpt, type, seasonRomanNumeral, seasonSlug, heroImage, heroFocalY columns"
  - "DB column mapping layer in blog-db.ts translates postID/publishedDate/isPublished to BlogPost interface"
  - "Auto-draft embeds <WeekRecap> MDX component matching existing blog post pattern"
  - "All blog functions made async since they now hit DB; all callers updated"

patterns-established:
  - "Blog DB CRUD: blog-db.ts with rowToPost mapper handles DB-to-interface translation"
  - "Auto-draft pattern: generate markdown with embedded server components for live stat rendering"

requirements-completed: [ADMN-01]

duration: 8min
completed: 2026-03-15
---

# Phase 8 Plan 4: Blog Editor Summary

**DB-backed blog with admin markdown editor, auto-draft from scores, and migration of existing MDX posts**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-15T02:03:01Z
- **Completed:** 2026-03-15T02:10:36Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Blog posts stored in Azure SQL with full CRUD API (GET/POST/PUT/DELETE)
- Admin markdown editor with @uiw/react-md-editor, live preview, auto-save, Ctrl+S
- Auto-draft generates recap posts with embedded WeekRecap component from confirmed scores
- Existing MDX blog post ("we-have-a-website") migrated to DB successfully
- Public blog pages (/blog, /blog/[slug]) now read from DB instead of filesystem
- Draft/publish/unpublish workflow with visual status indicators

## Task Commits

Each task was committed atomically:

1. **Task 1: Blog DB layer, API routes, migration script, update public blog pages** - `0f5df86` (feat)
2. **Task 2: Admin blog editor with markdown preview and auto-draft** - `d6127a5` (included in docs commit)

## Files Created/Modified
- `src/lib/admin/blog-db.ts` - Blog CRUD operations with DB column mapping
- `src/app/api/admin/blog/route.ts` - GET (list all) / POST (create) API
- `src/app/api/admin/blog/[id]/route.ts` - GET / PUT / DELETE by ID
- `src/app/api/admin/blog/auto-draft/route.ts` - Generate recap draft from scores
- `src/app/admin/(dashboard)/blog/page.tsx` - Blog post list with auto-draft modal
- `src/app/admin/(dashboard)/blog/[id]/page.tsx` - Markdown editor with metadata fields
- `scripts/migrate-blog-to-db.mjs` - MDX to DB migration (ran successfully, 1 post migrated)
- `src/lib/blog.ts` - Converted from filesystem to DB-backed async functions
- `src/app/blog/page.tsx` - Updated for async getAllPosts
- `src/app/blog/[slug]/page.tsx` - Updated for async blog functions
- `src/app/page.tsx` - Updated getAllPosts call to await
- `src/app/week/[seasonSlug]/[weekNum]/page.tsx` - Updated getPostForWeek to await

## Decisions Made
- Extended blogPosts table with 6 missing columns (excerpt, type, seasonRomanNumeral, seasonSlug, heroImage, heroFocalY) to match the BlogPost interface from Plan 01
- Created a rowToPost mapping layer in blog-db.ts to translate between DB column names (postID, publishedDate, isPublished, createdDate, modifiedDate) and the BlogPost interface (id, publishedAt, createdAt, updatedAt)
- Auto-draft uses embedded `<WeekRecap>` MDX component (same pattern as existing blog post) rather than generating static markdown tables
- All blog.ts functions became async since they now query DB; updated all 5 callers across the codebase

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added missing columns to blogPosts table**
- **Found during:** Task 1 (Blog DB layer)
- **Issue:** blogPosts table created in Plan 01 had only 10 columns; the BlogPost interface requires 6 additional columns
- **Fix:** Added excerpt, type, seasonRomanNumeral, seasonSlug, heroImage, heroFocalY via ALTER TABLE
- **Files modified:** Database schema (runtime ALTER TABLE)
- **Verification:** Column check confirmed all 16 columns present
- **Committed in:** 0f5df86 (Task 1 commit)

**2. [Rule 3 - Blocking] Updated all blog function callers for async signatures**
- **Found during:** Task 1 (Update public blog pages)
- **Issue:** Converting blog.ts functions to async required updating callers in homepage, week page, and blog pages
- **Fix:** Added await to getAllPosts, getPostBySlug, getPostContent, getAdjacentPosts, getPostForWeek calls
- **Files modified:** src/app/page.tsx, src/app/week/[seasonSlug]/[weekNum]/page.tsx
- **Verification:** TypeScript compilation passes with no errors
- **Committed in:** 0f5df86 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Blog editor ready for use at /admin/blog
- Plan 05 (scoresheets, publish, email, dashboard) can proceed independently
- Commissioner can create/edit/publish blog posts without code deployments

---
*Phase: 08-admin-tools*
*Completed: 2026-03-15*
