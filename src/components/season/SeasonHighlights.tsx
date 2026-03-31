'use client';
import Link from 'next/link';
import type { WeeklyMatchScore } from '@/lib/queries';
import { SectionHeading } from '@/components/ui/SectionHeading';

interface Props {
  weeklyScores: WeeklyMatchScore[];
}

interface SeasonRecord {
  name: string;
  slug: string;
  team: string;
  teamSlug: string;
  value: number;
  week: number;
}

interface TeamRecord {
  teamName: string;
  teamSlug: string;
  value: number;
  week: number;
}

interface CountEntry {
  name: string;
  slug: string;
  count: number;
}

interface CountEntryWithDelta extends CountEntry {
  thisWeek: number;
}

interface TopResult<T> {
  items: T[];
  tiedCount: number;
  tiedValue: number;
}

function topWithTies<T>(sorted: T[], n: number, getValue: (item: T) => number, maxShow = 7): TopResult<T> {
  if (sorted.length <= n) return { items: sorted, tiedCount: 0, tiedValue: 0 };
  const cutoffValue = getValue(sorted[n - 1]);
  let end = n;
  while (end < sorted.length && getValue(sorted[end]) === cutoffValue) end++;
  if (end <= maxShow) {
    return { items: sorted.slice(0, end), tiedCount: 0, tiedValue: 0 };
  }
  let aboveTie = 0;
  while (aboveTie < sorted.length && getValue(sorted[aboveTie]) > cutoffValue) aboveTie++;
  const tiedCount = end - aboveTie;
  return { items: sorted.slice(0, aboveTie), tiedCount, tiedValue: cutoffValue };
}

export function SeasonHighlights({ weeklyScores }: Props) {
  if (weeklyScores.length === 0) return null;

  const bowlers = weeklyScores.filter(s => s.scratchSeries != null && !s.isPenalty);
  const currentWeek = Math.max(...weeklyScores.map(s => s.week));

  // --- High Team Hcp Series & Scratch Series (best single-week team totals) ---
  // HCP series includes penalties (they contribute 597), scratch series excludes them
  const teamWeekTotals = new Map<string, { teamName: string; teamSlug: string; week: number; hcpSeries: number; scratchSeries: number }>();
  for (const s of weeklyScores) {
    if (s.handSeries == null && s.scratchSeries == null) continue;
    const key = `${s.teamID}-${s.week}`;
    const cur = teamWeekTotals.get(key) ?? { teamName: s.teamName, teamSlug: s.teamSlug, week: s.week, hcpSeries: 0, scratchSeries: 0 };
    cur.hcpSeries += s.handSeries ?? 0;
    if (!s.isPenalty) cur.scratchSeries += s.scratchSeries ?? 0;
    teamWeekTotals.set(key, cur);
  }
  const teamWeekList = Array.from(teamWeekTotals.values());

  const topTeamHcp: TeamRecord[] = [...teamWeekList]
    .sort((a, b) => b.hcpSeries - a.hcpSeries)
    .slice(0, 5)
    .map(t => ({ teamName: t.teamName, teamSlug: t.teamSlug, value: t.hcpSeries, week: t.week }));

  const topTeamScratch: TeamRecord[] = [...teamWeekList]
    .sort((a, b) => b.scratchSeries - a.scratchSeries)
    .slice(0, 5)
    .map(t => ({ teamName: t.teamName, teamSlug: t.teamSlug, value: t.scratchSeries, week: t.week }));

  // --- High Men's Scratch Series ---
  const topMenSeries: SeasonRecord[] = [...bowlers]
    .filter(b => b.gender === 'M' && b.scratchSeries != null)
    .sort((a, b) => (b.scratchSeries ?? 0) - (a.scratchSeries ?? 0))
    .slice(0, 5)
    .map(b => ({ name: b.bowlerName, slug: b.bowlerSlug, team: b.teamName, teamSlug: b.teamSlug, value: b.scratchSeries!, week: b.week }));

  // --- High Women's Scratch Series ---
  const topWomenSeries: SeasonRecord[] = [...bowlers]
    .filter(b => b.gender === 'F' && b.scratchSeries != null)
    .sort((a, b) => (b.scratchSeries ?? 0) - (a.scratchSeries ?? 0))
    .slice(0, 5)
    .map(b => ({ name: b.bowlerName, slug: b.bowlerSlug, team: b.teamName, teamSlug: b.teamSlug, value: b.scratchSeries!, week: b.week }));

  // --- High Scratch Game (individual games across season) ---
  const allGames: { name: string; slug: string; team: string; teamSlug: string; score: number; week: number }[] = [];
  for (const b of bowlers) {
    if (b.game1 != null) allGames.push({ name: b.bowlerName, slug: b.bowlerSlug, team: b.teamName, teamSlug: b.teamSlug, score: b.game1, week: b.week });
    if (b.game2 != null) allGames.push({ name: b.bowlerName, slug: b.bowlerSlug, team: b.teamName, teamSlug: b.teamSlug, score: b.game2, week: b.week });
    if (b.game3 != null) allGames.push({ name: b.bowlerName, slug: b.bowlerSlug, team: b.teamName, teamSlug: b.teamSlug, score: b.game3, week: b.week });
  }
  allGames.sort((a, b) => b.score - a.score);
  // Show top 5, but expand if the 5th entry ties with more
  let scratchGameCutoff = 5;
  if (allGames.length > 5) {
    const cutVal = allGames[4].score;
    while (scratchGameCutoff < allGames.length && allGames[scratchGameCutoff].score === cutVal) scratchGameCutoff++;
    if (scratchGameCutoff > 8) scratchGameCutoff = 5; // too many ties, just show 5
  }
  const topScratchGames = allGames.slice(0, scratchGameCutoff);

  // --- Turkeys (season cumulative + this week delta) ---
  const turkeyMap = new Map<number, { name: string; slug: string; count: number; thisWeek: number }>();
  for (const b of weeklyScores) {
    if (b.isPenalty) continue;
    if (b.turkeys > 0) {
      const cur = turkeyMap.get(b.bowlerID) ?? { name: b.bowlerName, slug: b.bowlerSlug, count: 0, thisWeek: 0 };
      cur.count += b.turkeys;
      if (b.week === currentWeek) cur.thisWeek += b.turkeys;
      turkeyMap.set(b.bowlerID, cur);
    }
  }
  const turkeyListAll: CountEntryWithDelta[] = Array.from(turkeyMap.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const topTurkeys = topWithTies(turkeyListAll, 5, e => e.count);

  // --- 200 Games (season cumulative + this week delta) ---
  const twoHundredMap = new Map<number, { name: string; slug: string; count: number; thisWeek: number }>();
  for (const b of bowlers) {
    let count = 0;
    if (b.game1 != null && b.game1 >= 200) count++;
    if (b.game2 != null && b.game2 >= 200) count++;
    if (b.game3 != null && b.game3 >= 200) count++;
    if (count > 0) {
      const cur = twoHundredMap.get(b.bowlerID) ?? { name: b.bowlerName, slug: b.bowlerSlug, count: 0, thisWeek: 0 };
      cur.count += count;
      if (b.week === currentWeek) cur.thisWeek += count;
      twoHundredMap.set(b.bowlerID, cur);
    }
  }
  const twoHundredListAll: CountEntryWithDelta[] = Array.from(twoHundredMap.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const topTwoHundred = topWithTies(twoHundredListAll, 5, e => e.count);

  return (
    <section className="space-y-6">
      <SectionHeading className="mb-1">Season Records</SectionHeading>

      {/* Team records */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TeamRecordCard title="High Team Hcp Series" records={topTeamHcp} currentWeek={currentWeek} />
        <TeamRecordCard title="High Team Scratch Series" records={topTeamScratch} currentWeek={currentWeek} />
      </div>

      {/* Individual series records */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {topMenSeries.length > 0 && <IndividualRecordCard title="High Men's Scratch Series" records={topMenSeries} currentWeek={currentWeek} />}
        {topWomenSeries.length > 0 && <IndividualRecordCard title="High Women's Scratch Series" records={topWomenSeries} currentWeek={currentWeek} />}
      </div>

      {/* High scratch game */}
      {topScratchGames.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <IndividualRecordCard
            title="High Scratch Game"
            currentWeek={currentWeek}
            records={topScratchGames.map(g => ({
              name: g.name, slug: g.slug, team: g.team, teamSlug: g.teamSlug, value: g.score, week: g.week,
            }))}
          />
        </div>
      )}

      {/* Turkeys + 200 Games */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {topTurkeys.items.length > 0 && <CountCard title="Turkeys" entries={topTurkeys.items} tiedCount={topTurkeys.tiedCount} tiedValue={topTurkeys.tiedValue} />}
        {topTwoHundred.items.length > 0 && <CountCard title="200 Games" entries={topTwoHundred.items} tiedCount={topTwoHundred.tiedCount} tiedValue={topTwoHundred.tiedValue} />}
      </div>
    </section>
  );
}

function TeamRecordCard({ title, records, currentWeek }: { title: string; records: TeamRecord[]; currentWeek: number }) {
  if (records.length === 0) return null;
  const topVal = records[0].value;
  return (
    <div className="bg-white border border-navy/10 rounded-lg p-3 shadow-sm">
      <h3 className="font-heading text-sm text-navy/60 uppercase tracking-wider mb-1.5">{title}</h3>
      {records.map((r, i) => {
        const isTop = r.value === topVal;
        const isNew = r.week === currentWeek;
        return (
          <div key={`${r.teamSlug}-${r.week}-${i}`} className={`flex justify-between text-sm font-body py-0.5 px-1.5 -mx-1.5 rounded ${isNew ? 'bg-amber-100 border-l-2 border-l-amber-400' : ''}`}>
            <span className="truncate mr-2">
              <Link href={`/team/${r.teamSlug}`} className={`text-navy hover:text-red-600 transition-colors ${isTop ? 'font-bold' : ''}`}>
                {r.teamName}
              </Link>
              <span className="text-navy/65 text-xs ml-1">Wk {r.week}</span>
            </span>
            <span className={`tabular-nums shrink-0 ${isTop ? 'font-bold text-navy' : 'text-navy/60'}`}>{r.value}</span>
          </div>
        );
      })}
    </div>
  );
}

function IndividualRecordCard({ title, records, currentWeek }: { title: string; records: SeasonRecord[]; currentWeek: number }) {
  if (records.length === 0) return null;
  const topVal = records[0].value;
  return (
    <div className="bg-white border border-navy/10 rounded-lg p-3 shadow-sm">
      <h3 className="font-heading text-sm text-navy/60 uppercase tracking-wider mb-1.5">{title}</h3>
      {records.map((r, i) => {
        const isTop = r.value === topVal;
        const isNew = r.week === currentWeek;
        return (
          <div key={`${r.slug}-${r.week}-${i}`} className={`flex justify-between text-sm font-body py-0.5 px-1.5 -mx-1.5 rounded ${isNew ? 'bg-amber-100 border-l-2 border-l-amber-400' : ''}`}>
            <span className="truncate mr-2">
              <Link href={`/bowler/${r.slug}`} className={`text-navy hover:text-red-600 transition-colors ${isTop ? 'font-bold' : ''}`}>
                {r.name}
              </Link>
              <span className="text-navy/65 text-xs ml-1">Wk {r.week}</span>
            </span>
            <span className={`tabular-nums shrink-0 ${isTop ? 'font-bold text-navy' : 'text-navy/60'}`}>{r.value}</span>
          </div>
        );
      })}
    </div>
  );
}

function CountCard({ title, entries, tiedCount = 0, tiedValue = 0 }: { title: string; entries: (CountEntry | CountEntryWithDelta)[]; tiedCount?: number; tiedValue?: number }) {
  const topCount = entries[0]?.count ?? 0;
  return (
    <div className="bg-white border border-navy/10 rounded-lg p-3 shadow-sm">
      <h3 className="font-heading text-sm text-navy/60 uppercase tracking-wider mb-1.5">{title}</h3>
      {entries.map((e, i) => {
        const isTop = e.count === topCount;
        const delta = 'thisWeek' in e ? e.thisWeek : 0;
        return (
          <div key={`${e.slug}-${i}`} className="flex justify-between text-sm font-body py-0.5 px-1.5 -mx-1.5 rounded">
            <Link href={`/bowler/${e.slug}`} className={`text-navy hover:text-red-600 transition-colors truncate mr-2 ${isTop ? 'font-bold' : ''}`}>
              {e.name}
            </Link>
            <span className={`tabular-nums shrink-0 ${isTop ? 'font-bold text-navy' : 'text-navy/60'}`}>
              {e.count}
              {delta > 0 && <span className="text-amber-600 text-xs ml-1">(+{delta})</span>}
            </span>
          </div>
        );
      })}
      {tiedCount > 0 && (
        <div className="text-sm font-body text-navy/65 italic py-0.5">
          {tiedCount} tied with {tiedValue}
        </div>
      )}
    </div>
  );
}
