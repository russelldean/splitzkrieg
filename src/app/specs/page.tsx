import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Specs | Splitzkrieg',
  description: 'Splitzkrieg specs notes.',
  robots: { index: false, follow: false },
};

export default function SpecsPage() {
  return (
    <main>
      {/* Hero */}
      <div className="relative overflow-hidden h-40 sm:h-48 bg-navy">
        <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy/95 to-navy/80" />
        <div className="relative z-10 flex items-end h-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <div>
            <h1 className="font-heading text-4xl sm:text-5xl text-white drop-shadow-lg">
              Splitzkrieg Specs Notes
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="font-body text-navy/70 leading-relaxed space-y-10">

          {/* Intro */}
          <p className="text-lg">
            Splitzkrieg.com is a fully static stats site. Every page is
            pre-rendered at build time with the database only touched at build time.
          </p>

          {/* Framework */}
          <Section title="Framework">
            <TechItem name="Next.js 16" desc="App Router with full static generation via generateStaticParams(). Every route is pre-rendered at build time." />
            <TechItem name="React 19" desc="Server components by default. Client components only where interactivity is needed (search, navigation, analytics)." />
            <TechItem name="TypeScript" desc="Strict mode across the entire codebase. No any escapes." />
          </Section>

          {/* Database */}
          <Section title="Database">
            <TechItem name="Azure SQL Server" desc="Microsoft SQL Server hosted on Azure. Raw T-SQL queries with parameterized inputs. No ORM." />
            <TechItem name="Build-Time Only" desc="The database is queried exclusively during Vercel builds. Visitors never hit the DB. A disk-based cache layer (MD5-hashed query results) means most builds skip the DB entirely too." />
            <TechItem name="40+ Query Functions" desc="Organized by domain: bowlers, seasons, teams, all-time stats, milestones, home page. Each wrapped in React.cache() for deduplication within a single render." />
          </Section>

          {/* Hosting */}
          <Section title="Hosting &amp; Deployment">
            <TechItem name="Vercel" desc="Auto-deploys on every push to main. Deployed to the Cleveland region (cle1). Cache persists between deploys so subsequent builds are fast (~2 minutes)." />
            <TechItem name="Git + GitHub" desc="Single main branch. Commits deploy automatically." />
          </Section>

          {/* Styling */}
          <Section title="Styling &amp; Design">
            <TechItem name="Tailwind CSS v4" desc="Utility-first CSS with an inline theme. No CSS modules, no styled-components." />
            <TechItem name="Custom Animations" desc="Ticker scrolling, shimmer loading skeletons, search glow effects, celebration animations. All defined as Tailwind keyframes. Respects prefers-reduced-motion." />
            <TechItem name="Mobile-First" desc="Responsive at every breakpoint. Parallax hero images use a CSS-only technique (position: fixed + clip-path) that works smoothly on iOS without JavaScript scroll listeners." />
          </Section>

          {/* Fonts */}
          <Section title="Typography">
            <TechItem name="DM Serif Display" desc="Headings. A sharp, editorial serif that gives the stats pages a newspaper-scoreboard feel." />
            <TechItem name="Inter" desc="Body text. Clean and highly legible at small sizes for dense stat tables." />
            <TechItem name="Orbitron" desc="Digital/accent elements. Used sparingly for a tech-scoreboard vibe." />
            <p className="text-sm text-navy/50 mt-2">All loaded via next/font with font-display: swap for zero layout shift.</p>
          </Section>

          {/* Search */}
          <Section title="Search">
            <TechItem name="Fuse.js" desc="Client-side fuzzy search. A static JSON index of all bowlers is generated at build time. Search runs entirely in the browser. No server calls, instant results." />
          </Section>

          {/* Data Viz */}
          <Section title="Data Visualization">
            <TechItem name="Recharts" desc="React charting library for average progression lines, standings race charts, and other data graphics." />
          </Section>

          {/* Analytics & Email */}
          <Section title="Analytics &amp; Email">
            <TechItem name="PostHog" desc="Privacy-friendly product analytics. Manual pageview capture on route changes." />
            <TechItem name="Resend" desc="Transactional email for the feedback form. No newsletters, no marketing." />
          </Section>

          {/* Data Pipeline */}
          <Section title="Data Pipeline">
            <TechItem name="CSV Scoresheets" desc="Raw scores come in as CSV exports. Node.js scripts parse, validate, and insert them into the database." />
            <TechItem name="20+ Automation Scripts" desc="Match results, playoff brackets, achievement patches, schedule imports, rolling averages, team name history. Each has a dedicated script that can be run incrementally." />
            <TechItem name="LeaguePals Sync" desc="A script that reads the weekly CSV, fuzzy-matches bowlers by name, and auto-updates team rosters and averages on LeaguePals." />
          </Section>

          {/* Patches */}
          <Section title="Achievement Patches">
            <TechItem name="12 Patch Types" desc="Pre-computed achievements stored in the database. Awarded by a populate script after each score upload. Build-time queries are simple indexed lookups, not heavy computations." />
          </Section>

          {/* Testing */}
          <Section title="Testing">
            <TechItem name="Vitest" desc="Unit tests for scoring utilities and business logic." />
          </Section>

          {/* Scale */}
          <Section title="By the Numbers">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-3">
              <Stat label="Seasons tracked" value="35" />
              <Stat label="Bowlers" value="620+" />
              <Stat label="Games scored" value="45,000+" />
              <Stat label="Pins knocked down" value="9M+" />
              <Stat label="Query functions" value="40+" />
              <Stat label="Automation scripts" value="20+" />
            </div>
          </Section>

          {/* Built with */}
          <div className="border-t border-navy/10 pt-8 mt-12">
            <p className="text-sm text-navy/40">
              Built by Russ Dean with Claude Code. Deployed on Vercel. Data goes
              back to Season I (Spring 2007).
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-heading text-2xl text-navy mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function TechItem({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="pl-4 border-l-2 border-red/30">
      <span className="font-semibold text-navy">{name}</span>
      <span className="text-navy/50"> · </span>
      <span>{desc}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center p-3 bg-navy/5 rounded-lg">
      <div className="font-heading text-2xl text-navy">{value}</div>
      <div className="text-xs text-navy/50 mt-1">{label}</div>
    </div>
  );
}
