/**
 * Shared types for the admin dashboard and captain lineup features.
 * Used across API routes, UI components, and library functions.
 */

export interface TokenPayload {
  role: 'admin' | 'writer' | 'captain';
  teamID?: number;
  captainName?: string;
}

export interface StagedBowler {
  bowlerID: number | null;
  bowlerName: string;
  teamID: number;
  teamName: string;
  game1: number | null;
  game2: number | null;
  game3: number | null;
  turkeys: number;
  incomingAvg: number | null;
  isPenalty: boolean;
  isUnmatched: boolean;
  matchedSuggestions?: Array<{ bowlerID: number; name: string; score: number }>;
}

export interface StagedMatch {
  matchID?: number;
  homeTeamID: number;
  homeTeamName: string;
  awayTeamID: number;
  awayTeamName: string;
  bowlers: StagedBowler[];
}

export interface ValidationWarning {
  bowlerID: number | null;
  bowlerName: string;
  field: string;
  message: string;
  severity: 'info' | 'warning';
}

export interface PersonalBest {
  bowlerID: number;
  bowlerName: string;
  type: 'highGame' | 'highSeries';
  value: number;
  previousBest: number | null;
}

export interface PipelineStatus {
  step: 'idle' | 'pulled' | 'reviewing' | 'confirmed' | 'published';
  seasonID: number;
  week: number;
  matchCount: number;
}

export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  content: string;
  excerpt: string | null;
  type: 'recap' | 'announcement';
  seasonRomanNumeral: string | null;
  seasonSlug: string | null;
  week: number | null;
  heroImage: string | null;
  heroFocalY: number | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LineupEntry {
  id: number;
  submissionID: number;
  position: number;
  bowlerID: number | null;
  newBowlerName: string | null;
  bowlerName?: string;
}

export interface LineupSubmission {
  id: number;
  seasonID: number;
  week: number;
  teamID: number;
  teamName?: string;
  submittedBy: string | null;
  submittedAt: string;
  status: 'submitted' | 'edited' | 'pushed';
  entries: LineupEntry[];
}
