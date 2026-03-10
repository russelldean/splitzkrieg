---
phase: 06-blog-and-weekly-automation
plan: 01
subsystem: ui
tags: [mdx, blog, next-mdx, gray-matter, remark-gfm, content-pipeline]

# Dependency graph
requires:
  - phase: 05-polish-and-team-h2h
    provides: "Established nav structure, homepage layout, component patterns"
provides:
  - "MDX rendering pipeline (content/blog/*.mdx -> rendered pages)"
  - "Blog utility layer (getAllPosts, getPostBySlug, getAdjacentPosts, getPostForWeek)"
  - "/blog list page and /blog/[slug] post pages"
  - "Blog nav integration (desktop + mobile)"
  - "BlogPostCard and BlogPostLayout components"
affects: [06-02-blog-stat-blocks, 06-03-first-blog-post, weekly-automation]

# Tech tracking
tech-stack:
  added: ["@next/mdx", "@mdx-js/loader", "@mdx-js/react", "gray-matter", "remark-gfm", "@tailwindcss/typography"]
  patterns: ["MDX content in content/blog/ directory", "YAML frontmatter parsed with gray-matter", "Dynamic MDX import via @content/* path alias"]

key-files:
  created:
    - "src/lib/blog.ts"
    - "src/components/blog/BlogPostCard.tsx"
    - "src/components/blog/BlogPostLayout.tsx"
    - "src/app/blog/[slug]/page.tsx"
    - "mdx-components.tsx"
    - "content/blog/test-post.mdx"
  modified:
    - "next.config.ts"
    - "tsconfig.json"
    - "src/app/blog/page.tsx"
    - "src/components/layout/Header.tsx"
    - "src/app/page.tsx"
    - "package.json"

key-decisions:
  - "Added @content/* tsconfig path alias for MDX dynamic imports from content/ directory"
  - "Blog uses Promise<params> pattern matching Next.js 16 conventions"
  - "Prev/next navigation labels: Newer/Older (not Previous/Next) to match reverse chronological ordering"

patterns-established:
  - "MDX blog posts live in content/blog/*.mdx with YAML frontmatter"
  - "Blog utility functions in src/lib/blog.ts for filesystem-based content"
  - "Dynamic MDX import pattern: import(`@content/blog/${slug}.mdx`)"

requirements-completed: [CONT-01]

# Metrics
duration: 3min
completed: 2026-03-10
---

# Phase 6 Plan 01: MDX Blog Infrastructure Summary

**MDX blog pipeline with gray-matter frontmatter parsing, /blog list page, /blog/[slug] post pages, and full nav integration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T22:07:57Z
- **Completed:** 2026-03-10T22:11:18Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- MDX rendering pipeline configured with @next/mdx, remark-gfm, and custom component overrides
- Blog utility layer with getAllPosts, getPostBySlug, getAdjacentPosts, getPostForWeek
- Blog list page at /blog showing post cards with type badges, dates, and excerpts
- Individual post pages at /blog/[slug] with prev/next navigation and recap cross-links
- Blog integrated into desktop nav (direct link) and mobile nav (Blog group)
- Homepage Resources card replaced with Blog card

## Task Commits

Each task was committed atomically:

1. **Task 1: Install MDX packages and configure Next.js** - `8165bbf` (feat)
2. **Task 2: Blog utility layer, pages, and nav integration** - `e2746af` (feat)

## Files Created/Modified
- `next.config.ts` - Wrapped with createMDX, added pageExtensions for MDX
- `mdx-components.tsx` - Root-level MDX component overrides with prose styling
- `content/blog/test-post.mdx` - Test MDX post for verification
- `src/lib/blog.ts` - Blog utility functions (getAllPosts, getPostBySlug, getAdjacentPosts, getPostForWeek)
- `src/components/blog/BlogPostCard.tsx` - Card component for blog list page
- `src/components/blog/BlogPostLayout.tsx` - Post layout with header, cross-links, prev/next nav
- `src/app/blog/page.tsx` - Blog list page replacing placeholder
- `src/app/blog/[slug]/page.tsx` - Dynamic blog post page with generateStaticParams
- `src/components/layout/Header.tsx` - Added Blog link to desktop nav, Blog group to mobile nav
- `src/app/page.tsx` - Replaced Resources card with Blog card
- `tsconfig.json` - Added @content/* path alias
- `package.json` - Added MDX dependencies

## Decisions Made
- Added `@content/*` tsconfig path alias so MDX dynamic imports resolve from content/ directory (outside src/)
- Used `Promise<params>` pattern for generateMetadata and page component to match Next.js 16 conventions
- Labeled prev/next navigation as "Newer" / "Older" to reinforce reverse chronological ordering
- Blog icon in nav uses a layout/dashboard-style SVG rather than a pencil icon

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed params type for Next.js 16 compatibility**
- **Found during:** Task 2
- **Issue:** Plan specified `{ params: { slug: string } }` but Next.js 16 requires `Promise<{ slug: string }>`
- **Fix:** Updated generateMetadata and page component to await params
- **Files modified:** src/app/blog/[slug]/page.tsx
- **Verification:** TypeScript compiled clean
- **Committed in:** e2746af (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for Next.js 16 compatibility. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- MDX pipeline ready for stat block components (Plan 02)
- content/blog/ directory ready for first real blog post (Plan 03)
- Blog pages will render any new .mdx files added to content/blog/
- Test with `next dev` to visually verify /blog and /blog/test-post render correctly

---
*Phase: 06-blog-and-weekly-automation*
*Completed: 2026-03-10*
