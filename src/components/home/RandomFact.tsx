'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { RandomFact as RandomFactType } from '@/lib/queries/facts';

const MILESTONE_LABELS: Record<string, string> = {
  totalGames: 'Career Games',
  totalPins: 'Career Pins',
  games200Plus: '200+ Games',
  series600Plus: '600+ Series',
  totalTurkeys: 'Career Turkeys',
};

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatFact(fact: RandomFactType): { text: string; href: string } {
  const href = `/week/${fact.seasonSlug}/${fact.week}`;

  if (fact.factTypeID === 1) {
    const type = fact.isCareerHigh ? 'career-high game' : 'new personal high game';
    const prev = fact.previousValue ? ` Previous best: ${fact.previousValue}.` : '';
    return {
      text: `This week in ${fact.year}, ${fact.bowlerName} rolled their ${type} of ${fact.value}.${prev}`,
      href,
    };
  }

  if (fact.factTypeID === 2) {
    const type = fact.isCareerHigh ? 'career-high series' : 'new personal high series';
    const prev = fact.previousValue ? ` Previous best: ${fact.previousValue}.` : '';
    return {
      text: `This week in ${fact.year}, ${fact.bowlerName} rolled their ${type} of ${fact.value}.${prev}`,
      href,
    };
  }

  if (fact.factTypeID === 3 && fact.milestoneOrdinal && fact.milestoneCategory) {
    const label = MILESTONE_LABELS[fact.milestoneCategory] || fact.milestoneCategory;
    return {
      text: `${fact.bowlerName} was the ${ordinalSuffix(fact.milestoneOrdinal)} bowler to reach ${fact.value.toLocaleString()} ${label}.`,
      href,
    };
  }

  return { text: '', href: '/' };
}

/** Check if a fact's reference date is within +/- 4 days of today (ignoring year). */
function isWithinWindow(fact: RandomFactType): boolean {
  if (!fact.refMonth || !fact.refDay) return false;
  const now = new Date();
  const refDate = new Date(2024, fact.refMonth - 1, fact.refDay);
  const todayDate = new Date(2024, now.getMonth(), now.getDate());
  const diff = Math.abs((refDate.getTime() - todayDate.getTime()) / 86400000);
  return diff <= 4 || diff >= 362;
}

/**
 * Three-tier pool selection:
 * 1. Career highs (types 1&2, isCareerHigh) within +/- 4 days
 * 2. Temporary highs (types 1&2, !isCareerHigh) within +/- 4 days
 * 3. Milestones (type 3, ordinal <= 100) as fallback
 */
function pickPool(facts: RandomFactType[]): RandomFactType[] {
  const careerHighs = facts.filter(f => f.factTypeID <= 2 && f.isCareerHigh && isWithinWindow(f));
  if (careerHighs.length > 0) return careerHighs;

  const tempHighs = facts.filter(f => f.factTypeID <= 2 && !f.isCareerHigh && isWithinWindow(f));
  if (tempHighs.length > 0) return tempHighs;

  return facts.filter(f => f.factTypeID === 3);
}

interface RandomFactProps {
  facts: RandomFactType[];
}

export function RandomFact({ facts }: RandomFactProps) {
  const [fact, setFact] = useState<RandomFactType | null>(null);

  useEffect(() => {
    if (facts.length === 0) return;
    const pool = pickPool(facts);
    if (pool.length === 0) return;
    setFact(pool[Math.floor(Math.random() * pool.length)]);
  }, [facts]);

  if (!fact) return null;

  const { text, href } = formatFact(fact);
  if (!text) return null;

  return (
    <div className="text-center px-4 -mt-1 mb-1">
      <Link
        href={href}
        className="inline-block font-body text-xs sm:text-sm text-navy/60 italic hover:text-red-700 transition-colors"
      >
        {text}
      </Link>
    </div>
  );
}
