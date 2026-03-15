# Phase 8: Admin Tools - Research

**Researched:** 2026-03-14
**Domain:** Admin dashboard, authentication, score pipeline, lineup submission, PDF generation, blog editor
**Confidence:** MEDIUM-HIGH

## Summary

Phase 8 transforms the commissioner's weekly workflow from terminal scripts + spreadsheets + Google Forms into a web-based admin dashboard. The core pipeline is: LP pull -> review/adjust scores -> confirm -> auto-run match results + patches -> write blog post -> publish week -> send recap email. A secondary feature gives captains a lineup submission page with magic link auth.

The project already has most of the backend logic in Node.js scripts (`import-week-scores.mjs`, `populate-match-results.mjs`, `populate-patches.mjs`, `publish-week.mjs`, `send-recap-email.mjs`, `create-weekly-post.mjs`). The admin UI wraps these into API routes and adds a review/editing interface. The blog system needs migration from filesystem MDX to DB-backed markdown. PDF scoresheet generation is a new capability.

**Primary recommendation:** Use custom JWT auth with `jose` library (already used by Next.js internally), Next.js 16 `proxy.ts` for route protection, API routes that refactor existing script logic, `jspdf` + `jspdf-autotable` for scoresheets, `@uiw/react-md-editor` for the blog editor, and a new `blogPosts` table in Azure SQL.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Two features: score entry pipeline (admin) and lineup submission (captains)
- Full pipeline in admin UI: LP pull -> review/adjust scores -> confirm -> auto-run match results + patches -> write blog post -> publish week -> send recap email
- Publish step is deliberately separate from score confirmation (blog post happens in between)
- Manual score entry fallback for when LP is unavailable
- Can edit scores for any previous week, not just current
- LP pull returns all scores for the whole night at once
- Admin: password login at `/admin`
- Captains: magic links sent by commissioner, long-lived sessions (persist across weeks), at `/lineup`
- Captain sees lineup form only (no stats/dashboard)
- Admin sends magic links to captains (no self-service)
- Landing page shows overview: lineup submission status for current week, score pipeline status, recent activity
- Display pulled scores organized by match (Team A vs Team B cards)
- Four adjustment types: fix scores, add turkeys, resolve unmatched bowlers, handle penalties/absences
- Unmatched bowler resolution: fuzzy search against existing bowlers + one-click create new bowler
- Turkey count field appears during review (not a separate step)
- Soft validation warnings (unusual scores, duplicates) - displayed but non-blocking
- Post-confirm summary: personal bests hit, patches awarded, standings impact
- Captains pick bowlers from full bowler list, pre-sorted by their team's recent roster
- Set bowling order (position matters)
- Can free-enter a brand new bowler not yet in the system
- Auto-accepted on submit, commissioner can override/edit
- Default to last week's lineup if no submission received
- Generate printable PDF scoresheets from submitted lineups
- One page per match with pre-filled bowler names, averages, handicaps
- LP pull: admin UI button to pull scores
- LP push: auto-push finalized lineups to LP
- Move blog from MDX files to DB-backed storage
- Markdown editor with side-by-side preview
- Auto-draft with stat block tables pre-populated from confirmed scores
- Narrative text left blank for commissioner to write
- Migrate existing MDX blog posts to DB
- Publishing triggers auto-rebuild (Vercel deploy hook or ISR revalidation)
- Recap email sent from admin UI

### Claude's Discretion
- Auth library/approach (NextAuth, custom JWT, etc.)
- PDF generation library
- Markdown editor component
- Admin UI component library or custom build
- DB schema for blog posts and lineup submissions
- Exact Vercel rebuild trigger mechanism
- Mobile responsiveness of admin (commissioner may use on phone)

### Deferred Ideas (OUT OF SCOPE)
- Season management (create seasons, divisions, schedules, rosters) - future phase
- Captain self-service magic link request - keep commissioner-controlled for now
- Captain team stats/standing view alongside lineup form - public site covers this
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ADMN-01 | Score entry web interface (replaces spreadsheet workflow) | Full LP pull -> review -> confirm -> process pipeline via API routes wrapping existing script logic |
| ADMN-02 | Score validation (flags unusual scores, checks against known bowlers) | Soft validation warnings in review UI: score range checks, duplicate detection, bowler fuzzy matching from existing `matchBowlerToDB()` logic |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.1.6 | Framework | Already in project |
| mssql | 12.2.0 | Azure SQL access | Already in project, direct queries pattern established |
| jose | 6.x | JWT signing/verification | Built into Next.js deps, lightweight, edge-compatible |
| resend | 6.9.3 | Email (recap + magic links) | Already in project |
| jspdf | 2.5.x | PDF generation (scoresheets) | Client-side, no Chromium needed, serverless-friendly |
| jspdf-autotable | 5.0.x | Table layout in PDFs | Standard jsPDF plugin for tabular data |
| @uiw/react-md-editor | 4.x | Markdown editor with preview | Lightweight, textarea-based, no heavy editor deps, side-by-side mode built in |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fuse.js | 7.1.0 | Fuzzy bowler search | Already in project, reuse for unmatched bowler resolution |
| gray-matter | 4.0.3 | MDX frontmatter parsing | Already in project, needed for blog migration script |
| next-mdx-remote | 6.0.0 | MDX rendering | Already in project, blog post rendering |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom JWT (jose) | Auth.js v5 (NextAuth) | Auth.js is overkill for 2 users (1 admin + ~20 captains). Custom JWT with jose is simpler, no OAuth providers needed, no session database. Auth.js adds complexity for magic links. |
| jspdf + autotable | Puppeteer / @sparticuz/chromium-min | Puppeteer requires headless Chromium, too heavy for Vercel serverless. Scoresheets are simple tables, not complex layouts. |
| @uiw/react-md-editor | CodeMirror / Monaco-based editors | Heavy editors unnecessary for a single blog post per week. The uiw editor is ~100KB, textarea-based. |
| Custom admin UI (Tailwind) | shadcn/ui or Radix | Admin is internal-only, already using Tailwind extensively. Adding a component library increases bundle and learning curve for minimal benefit. |

**Installation:**
```bash
npm install jose jspdf jspdf-autotable @uiw/react-md-editor
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  app/
    admin/
      layout.tsx             # Admin layout with auth check, nav sidebar
      page.tsx               # Dashboard overview
      scores/
        page.tsx             # Score pipeline: pull, review, confirm
      blog/
        page.tsx             # Blog post list + create
        [id]/
          page.tsx           # Blog editor
      lineups/
        page.tsx             # View/manage lineup submissions
      scoresheets/
        page.tsx             # Generate + download scoresheets
      login/
        page.tsx             # Password login form (no layout wrap)
    lineup/
      page.tsx               # Captain lineup submission form
      login/
        page.tsx             # Magic link landing (token in URL)
    api/
      admin/
        auth/
          login/route.ts     # POST: verify password, return JWT cookie
          logout/route.ts    # POST: clear JWT cookie
        scores/
          pull/route.ts      # POST: pull from LP API
          confirm/route.ts   # POST: insert scores + run match results + patches
          validate/route.ts  # POST: validate staged scores
        blog/
          route.ts           # GET: list, POST: create
          [id]/route.ts      # GET/PUT/DELETE single post
        publish/route.ts     # POST: publish week (update leagueSettings, bump cache, trigger rebuild)
        email/route.ts       # POST: send recap email
        lineups/
          route.ts           # GET: all submissions, PUT: edit
          push/route.ts      # POST: push lineups to LP
        scoresheets/route.ts # POST: generate PDF (or client-side)
        magic-link/route.ts  # POST: generate + send magic link to captain
      lineup/
        auth/route.ts        # GET: verify magic link token, set session cookie
        submit/route.ts      # POST: submit lineup
  lib/
    admin/
      auth.ts               # JWT helpers: sign, verify, requireAdmin, requireCaptain
      scores.ts              # Score pipeline logic (refactored from scripts)
      blog-db.ts             # Blog CRUD (DB operations)
      lineups.ts             # Lineup submission logic
      lp-api.ts              # LeaguePals API client (refactored from scripts)
      scoresheets.ts         # PDF generation logic
      validation.ts          # Score validation rules
```

### Pattern 1: Custom JWT Auth with proxy.ts
**What:** Simple JWT-based auth using `jose` library, stored in HTTP-only cookies, verified in Next.js 16 `proxy.ts` (replaces middleware.ts)
**When to use:** All `/admin/*` and `/lineup/*` routes (except login pages)

```typescript
// src/lib/admin/auth.ts
import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!);

interface TokenPayload {
  role: 'admin' | 'captain';
  teamID?: number;       // captains only
  captainName?: string;  // captains only
}

export async function signToken(payload: TokenPayload, expiresIn = '30d'): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}
```

```typescript
// proxy.ts (root of project -- Next.js 16 replaces middleware.ts)
import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin routes (except login)
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = request.cookies.get('admin-token')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    // Full JWT verification happens in the layout/API route (proxy runs on Node.js in Next 16)
  }

  // Lineup routes (except magic link landing)
  if (pathname.startsWith('/lineup') && !pathname.startsWith('/lineup/login')) {
    const token = request.cookies.get('lineup-token')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/lineup/login?expired=1', request.url));
    }
  }

  // Admin API routes
  if (pathname.startsWith('/api/admin')) {
    const token = request.cookies.get('admin-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/lineup/:path*', '/api/admin/:path*'],
};
```

### Pattern 2: Refactoring Scripts to API Routes
**What:** Extract existing script logic into importable functions, then call from API routes
**When to use:** Every admin action that currently runs as a CLI script

```typescript
// src/lib/admin/scores.ts -- refactored from scripts/import-week-scores.mjs
import { getDb } from '@/lib/db';

export async function pullScoresFromLP(cookie: string, seasonID: number, weekNum: number) {
  // Same logic as scripts/import-week-scores.mjs pullScores()
  // but returns structured data instead of writing to file
  const headers = { Accept: 'application/json', Cookie: cookie, 'User-Agent': '...' };
  // ... LP API calls ...
  return { matches, warnings };
}

export async function insertScores(staged: StagedScores) {
  const db = await getDb();
  // Same logic as scripts/import-week-scores.mjs importScores()
  // Uses parameterized queries with db.request()
}

export async function runMatchResults(seasonID: number) {
  // Refactored from scripts/populate-match-results.mjs
}

export async function runPatches() {
  // Refactored from scripts/populate-patches.mjs
}
```

### Pattern 3: Score Review State Management
**What:** Client-side state for the score review/editing UI before confirmation
**When to use:** The score review page where admin adjusts pulled scores

```typescript
// Admin score review page is a client component with local state
// Staged scores are fetched from API, edited in-browser, then confirmed via API
'use client';
import { useState } from 'react';

interface StagedMatch {
  homeTeamName: string;
  awayTeamName: string;
  bowlers: StagedBowler[];
}

// State flows: pull -> review (client state) -> confirm (POST to API)
// No intermediate persistence needed -- session is short-lived
```

### Pattern 4: Magic Link Auth for Captains
**What:** Commissioner generates a signed URL token, sends via email, captain clicks to authenticate
**When to use:** Captain lineup submission

```typescript
// Generate magic link (admin action)
const token = await signToken({ role: 'captain', teamID: 14, captainName: 'John' }, '90d');
const magicLink = `https://splitzkrieg.com/lineup/login?token=${token}`;
// Send via Resend to captain's email

// Captain lands on /lineup/login?token=xxx
// API verifies token, sets HTTP-only cookie, redirects to /lineup
```

### Anti-Patterns to Avoid
- **Storing LP cookie in the DB:** LP cookie is session-based and short-lived. Admin pastes it into the UI each time they pull scores. Do not persist it.
- **Building a custom ORM layer:** The project uses direct `mssql` queries everywhere. Keep using that pattern for admin DB operations.
- **Client-side DB access:** All DB operations go through API routes. The admin UI is entirely client components calling API endpoints.
- **Overcomplicating blog storage:** Simple `blogPosts` table with markdown content column. Do not build a full CMS.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT signing/verification | Custom crypto | `jose` library | Subtle security bugs in custom JWT implementations |
| PDF table layout | Manual coordinate math | `jspdf-autotable` | Table positioning, page breaks, column widths are tedious |
| Markdown preview rendering | Custom parser | `@uiw/react-md-editor` | Live preview with syntax highlighting built in |
| Fuzzy bowler name matching | New matching algorithm | Existing `matchBowlerToDB()` + `fuse.js` | Already built and tested in import-week-scores.mjs |
| Score import/match results/patches | New pipeline | Refactor existing scripts | 500+ lines of battle-tested logic in scripts/ |
| Cache busting after score writes | Manual cache clearing | Existing `bumpDataVersion()` + `.published-week` pattern | Cache system is complex and error-prone, use established patterns |

**Key insight:** The majority of admin backend logic already exists in CLI scripts. The work is wrapping it in API routes and building the UI, not reimplementing the pipeline.

## Common Pitfalls

### Pitfall 1: Azure SQL Connection Exhaustion During Admin Operations
**What goes wrong:** Admin confirms scores, which triggers match results rebuild + patches + cache bust. Multiple concurrent DB-heavy operations exceed 30-connection limit.
**Why it happens:** Unlike build-time where `cachedQuery` serializes via semaphore, API routes run without that protection.
**How to avoid:** Use the existing `withRetry()` function. Serialize the confirm pipeline (insert -> match results -> patches) sequentially in a single API call. Do NOT parallelize.
**Warning signs:** `ETIMEOUT` errors, Azure SQL throttling responses.

### Pitfall 2: Cache Invalidation After Admin Score Writes
**What goes wrong:** Admin confirms scores but the public site still shows old data.
**Why it happens:** Score writes need cache busting (`.data-versions.json` bump, `.published-week` update) AND a Vercel rebuild/revalidation.
**How to avoid:** The confirm + publish pipeline must: 1) bump `.data-versions.json`, 2) write `.published-week`, 3) call the existing `/api/revalidate` endpoint OR trigger a Vercel deploy hook. The publish step already handles this in `scripts/publish-week.mjs`.
**Warning signs:** Public site shows stale data after admin publishes.

### Pitfall 3: LP Cookie Expiration Mid-Pull
**What goes wrong:** LP session cookie expires between admin clicking "Pull Scores" and the API completing the LP fetch.
**Why it happens:** LP cookies have limited TTL, and the admin may have opened the dashboard hours ago.
**How to avoid:** Return clear error message ("LP session expired, please get a fresh cookie"). Do not auto-retry. The admin re-logs into LP and pastes a new cookie.
**Warning signs:** LP API returns 401/403.

### Pitfall 4: Computed Columns in Score Inserts
**What goes wrong:** INSERT into `scores` table fails because computed columns are included.
**Why it happens:** The `scores` table has computed columns: `hcpGame1`, `hcpGame2`, `hcpGame3`, `handSeries`, `incomingHcp`, `scratchSeries`. INSERTing into these causes SQL errors.
**How to avoid:** Only INSERT: `bowlerID, seasonID, teamID, week, game1, game2, game3, incomingAvg, turkeys, isPenalty`. The existing `import-week-scores.mjs` already does this correctly.
**Warning signs:** SQL error about computed columns.

### Pitfall 5: Blog Migration Breaking Existing URLs
**What goes wrong:** Blog URLs change when migrating from MDX to DB.
**Why it happens:** The slug format or routing changes.
**How to avoid:** Keep the same slug format. The `[slug]` route reads from DB instead of filesystem. Existing blog post URLs must continue to work.
**Warning signs:** 404s on existing blog links.

### Pitfall 6: Vercel Serverless Function Size Limits
**What goes wrong:** API route bundle exceeds Vercel's 50MB function size limit.
**Why it happens:** `mssql` is already large (~5MB). Adding Puppeteer/Chromium would push over limits.
**How to avoid:** Use `jspdf` for PDF generation (client-side or lightweight serverless). Avoid Puppeteer. Keep API routes focused.
**Warning signs:** Build failures mentioning function size.

## Code Examples

### Score Validation Rules
```typescript
// src/lib/admin/validation.ts
interface ValidationWarning {
  bowlerID: number;
  field: string;
  message: string;
  severity: 'info' | 'warning';
}

export function validateScores(bowlers: StagedBowler[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  for (const b of bowlers) {
    if (b.isPenalty) continue;

    // Unusually high score
    for (const [i, game] of [b.game1, b.game2, b.game3].entries()) {
      if (game != null && game > 280) {
        warnings.push({
          bowlerID: b.bowlerID!,
          field: `game${i + 1}`,
          message: `${b.bowlerName}: Game ${i + 1} is ${game} (verify)`,
          severity: 'warning',
        });
      }
      // Unusually low score
      if (game != null && game < 50) {
        warnings.push({
          bowlerID: b.bowlerID!,
          field: `game${i + 1}`,
          message: `${b.bowlerName}: Game ${i + 1} is ${game} (verify)`,
          severity: 'warning',
        });
      }
    }

    // Score vs average deviation
    if (b.incomingAvg != null) {
      const avg = b.incomingAvg;
      for (const [i, game] of [b.game1, b.game2, b.game3].entries()) {
        if (game != null && Math.abs(game - avg) > 80) {
          warnings.push({
            bowlerID: b.bowlerID!,
            field: `game${i + 1}`,
            message: `${b.bowlerName}: Game ${i + 1} (${game}) is ${Math.abs(game - avg)} pins from avg (${avg})`,
            severity: 'info',
          });
        }
      }
    }

    // Duplicate bowler check (same bowlerID twice in same match)
    // Handled at match level
  }

  return warnings;
}
```

### Scoresheet PDF Generation
```typescript
// src/lib/admin/scoresheets.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ScoresheetMatch {
  homeTeamName: string;
  awayTeamName: string;
  week: number;
  date: string;
  bowlers: {
    name: string;
    side: 'home' | 'away';
    incomingAvg: number | null;
    handicap: number | null;
  }[];
}

export function generateScoresheet(matches: ScoresheetMatch[]): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });

  for (let i = 0; i < matches.length; i++) {
    if (i > 0) doc.addPage();
    const match = matches[i];

    // Header
    doc.setFontSize(16);
    doc.text(`${match.homeTeamName} vs ${match.awayTeamName}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Week ${match.week} | ${match.date}`, 14, 22);

    // Home team table
    const homeBowlers = match.bowlers.filter(b => b.side === 'home');
    autoTable(doc, {
      startY: 28,
      head: [['#', 'Bowler', 'Avg', 'HCP', 'Game 1', 'Game 2', 'Game 3', 'Turkeys']],
      body: homeBowlers.map((b, idx) => [
        idx + 1,
        b.name,
        b.incomingAvg ?? 'NEW',
        b.handicap ?? '-',
        '', '', '', '',  // blank for hand-writing
      ]),
      theme: 'grid',
    });

    // Away team table below
    const awayBowlers = match.bowlers.filter(b => b.side === 'away');
    autoTable(doc, {
      head: [['#', 'Bowler', 'Avg', 'HCP', 'Game 1', 'Game 2', 'Game 3', 'Turkeys']],
      body: awayBowlers.map((b, idx) => [
        idx + 1,
        b.name,
        b.incomingAvg ?? 'NEW',
        b.handicap ?? '-',
        '', '', '', '',
      ]),
      theme: 'grid',
    });
  }

  return doc;
}
```

### DB Schema for New Tables
```sql
-- Blog posts table (replaces MDX filesystem)
CREATE TABLE blogPosts (
  id INT IDENTITY(1,1) PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  title NVARCHAR(500) NOT NULL,
  content NVARCHAR(MAX) NOT NULL,        -- raw markdown
  excerpt NVARCHAR(500),
  type VARCHAR(50) DEFAULT 'recap',       -- recap | announcement
  seasonRomanNumeral VARCHAR(20),
  seasonSlug VARCHAR(100),
  week INT,
  heroImage VARCHAR(500),
  heroFocalY FLOAT,
  publishedAt DATETIME2,                  -- NULL = draft
  createdAt DATETIME2 DEFAULT GETDATE(),
  updatedAt DATETIME2 DEFAULT GETDATE()
);

-- Lineup submissions
CREATE TABLE lineupSubmissions (
  id INT IDENTITY(1,1) PRIMARY KEY,
  seasonID INT NOT NULL,
  week INT NOT NULL,
  teamID INT NOT NULL,
  submittedBy VARCHAR(100),               -- captain name from token
  submittedAt DATETIME2 DEFAULT GETDATE(),
  status VARCHAR(20) DEFAULT 'submitted', -- submitted | edited | pushed
  CONSTRAINT FK_lineup_team FOREIGN KEY (teamID) REFERENCES teams(teamID)
);

-- Individual bowler entries within a lineup
CREATE TABLE lineupEntries (
  id INT IDENTITY(1,1) PRIMARY KEY,
  submissionID INT NOT NULL,
  position INT NOT NULL,                   -- bowling order (1-4 typically)
  bowlerID INT,                            -- NULL if new bowler entered
  newBowlerName VARCHAR(200),              -- filled in if bowlerID is NULL
  CONSTRAINT FK_entry_submission FOREIGN KEY (submissionID) REFERENCES lineupSubmissions(id)
);

-- Magic link tokens for captains
CREATE TABLE captainSessions (
  id INT IDENTITY(1,1) PRIMARY KEY,
  teamID INT NOT NULL,
  captainName VARCHAR(100) NOT NULL,
  captainEmail VARCHAR(255) NOT NULL,
  token VARCHAR(500) NOT NULL,             -- JWT token value for revocation lookup
  createdAt DATETIME2 DEFAULT GETDATE(),
  expiresAt DATETIME2 NOT NULL,
  revoked BIT DEFAULT 0,
  CONSTRAINT FK_captain_team FOREIGN KEY (teamID) REFERENCES teams(teamID)
);
```

### Vercel Rebuild Trigger
```typescript
// src/lib/admin/rebuild.ts
export async function triggerVercelRebuild(): Promise<boolean> {
  // Option A: Use existing /api/revalidate endpoint (ISR)
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/revalidate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: process.env.REVALIDATION_SECRET }),
  });
  return res.ok;

  // Option B: Vercel Deploy Hook (full rebuild)
  // const res = await fetch(process.env.VERCEL_DEPLOY_HOOK_URL!, { method: 'POST' });
  // return res.ok;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` | `proxy.ts` | Next.js 16 | Renamed file, runs on Node.js runtime (not Edge) |
| NextAuth v4 | Auth.js v5 / custom JWT | 2024-2025 | For simple cases like this, custom JWT is simpler |
| Puppeteer server-side PDF | jsPDF client-side | Ongoing | Avoids Chromium dependency in serverless |
| MDX in filesystem | DB-backed content | This phase | Enables admin editing without code deployments |

**Deprecated/outdated:**
- `middleware.ts`: Still works in Next.js 16 but deprecated. Use `proxy.ts` instead.
- NextAuth v4: Superseded by Auth.js v5. Neither is needed for this use case.

## Open Questions

1. **LP Cookie Management**
   - What we know: LP uses `connect.sid` session cookie. Commissioner currently copies it from browser DevTools.
   - What's unclear: How long do LP cookies last? Can we store them encrypted in the DB for convenience, or must they be entered each time?
   - Recommendation: Start with paste-per-session. If painful, add encrypted storage later.

2. **ISR vs Deploy Hook for Publishing**
   - What we know: ISR revalidation via `/api/revalidate` already works. Deploy hooks trigger full rebuilds.
   - What's unclear: Does ISR revalidation properly pick up the `.data-versions.json` and `.published-week` changes? These are filesystem-based and read at import time, not per-request.
   - Recommendation: Use ISR revalidation first (already working). The cache tag system should handle it since `.data-versions.json` is read during build-time query execution. If stale data persists, fall back to deploy hook.

3. **Blog Image Handling**
   - What we know: Current blog has `heroImage` in frontmatter pointing to `/public` images. DB-backed posts need the same.
   - What's unclear: Will the admin upload new images, or just reference existing ones?
   - Recommendation: Start with referencing existing `/public` images by path. Image upload is a future enhancement.

4. **Recap Email From Address**
   - What we know: Currently sends from `noreply@splitzkrieg.com` via Resend. Commissioner wants it from their personal email.
   - What's unclear: Resend requires domain verification. Can't send from gmail.
   - Recommendation: Use `russ@splitzkrieg.com` or `commissioner@splitzkrieg.com` as the from address (Resend domain already verified for splitzkrieg.com). Set Reply-To to commissioner's personal email.

## Sources

### Primary (HIGH confidence)
- Project codebase: `src/lib/db.ts`, `scripts/import-week-scores.mjs`, `scripts/publish-week.mjs`, `scripts/send-recap-email.mjs`, `scripts/create-weekly-post.mjs`, `src/app/api/revalidate/route.ts`, `src/app/api/feedback/route.ts`, `src/lib/blog.ts`
- Next.js 16 official docs: proxy.ts migration, authentication patterns

### Secondary (MEDIUM confidence)
- [Next.js 16 middleware to proxy migration](https://nextjs.org/docs/messages/middleware-to-proxy) - proxy.ts replaces middleware.ts
- [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication) - JWT + cookie pattern with jose
- [jsPDF-AutoTable GitHub](https://github.com/simonbengtsson/jsPDF-AutoTable) - table PDF generation
- [@uiw/react-md-editor npm](https://www.npmjs.com/package/@uiw/react-md-editor) - markdown editor with preview
- [Resend domain verification docs](https://resend.com/docs/dashboard/receiving/custom-domains) - custom from address requires verified domain

### Tertiary (LOW confidence)
- LP cookie TTL and session behavior (based on project observation, not documented API)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries verified, most already in project
- Architecture: HIGH - patterns based on existing project conventions
- Auth approach: MEDIUM-HIGH - custom JWT is well-documented, but proxy.ts is new in Next.js 16
- PDF generation: MEDIUM - jspdf-autotable is mature but untested in this project
- Blog migration: MEDIUM - straightforward schema but rendering pipeline needs careful testing
- Pitfalls: HIGH - based on direct observation of existing codebase patterns

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable domain, established patterns)
