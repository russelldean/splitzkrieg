'use client';
import { useState } from 'react';
import Link from 'next/link';

export interface TeamStat {
  teamName: string;
  teamSlug: string | null;
  nights: number;
  pct: number;
}

interface Props {
  teams: TeamStat[];
}

export function TeamBreakdown({ teams }: Props) {
  const [open, setOpen] = useState(false);

  if (teams.length === 0) return null;

  const isLifer = teams.length === 1;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-3 py-1 bg-navy/5 rounded-full text-sm font-body text-navy hover:bg-navy/10 transition-colors"
      >
        <span className="text-navy/50">Teams</span>
        <span className="font-semibold">{teams.length}</span>
        <span className="text-navy/30 text-xs ml-0.5">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-10 bg-white rounded-lg border border-navy/10 shadow-lg p-3 min-w-[220px]">
          <ul className="space-y-2">
            {teams.map((team) => (
              <li key={team.teamSlug ?? team.teamName} className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {team.teamSlug ? (
                    <Link
                      href={`/team/${team.teamSlug}`}
                      className="text-sm text-navy hover:text-red-600 transition-colors truncate block"
                    >
                      {team.teamName}
                    </Link>
                  ) : (
                    <span className="text-sm text-navy/60 truncate block">{team.teamName}</span>
                  )}
                  {isLifer && (
                    <span className="text-[11px] italic text-navy/40">forever</span>
                  )}
                </div>
                <div
                  className="flex items-center gap-2 shrink-0"
                  title={`${team.nights} night${team.nights === 1 ? '' : 's'}`}
                >
                  <div className="w-16 h-1.5 bg-navy/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-navy/30 rounded-full"
                      style={{ width: `${Math.max(team.pct, team.nights > 0 ? 3 : 0)}%` }}
                    />
                  </div>
                  <span className="text-xs text-navy/50 tabular-nums w-8 text-right">
                    {team.pct === 0 && team.nights > 0 ? '<1' : team.pct}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
