/**
 * Bowler season recap ("Wrapped") view-model.
 *
 * One batched per-bowler, per-season read (result.recordsets[0..8]) plus pure
 * assembly into card-ready facts. The SQL is scoped to a single bowler except
 * for the league aggregate (recordset 3), which exists so ranks can be computed
 * against the whole field without a second round-trip.
 *
 * Cache: keyed per bowler (bowlerID option). The league ranks inside the result
 * can lag by a week for a bowler who sat out, because only bowlers who bowled
 * get their version bumped on import. Acceptable while this is a prototype;
 * revisit before prebuilding these pages.
 */
import { cache } from 'react';
import { getDb, cachedQuery } from '../db';
import { getMinGamesForWeek } from '../queries/seasons/standings';
import { classifyArchetype, type GameArchetype } from '../queries/alltime';
import { pinScoresForWeek, type PinBowler, type PinMatch } from '../scoring/pin';

export interface WrappedWeek {
  week: number;
  matchDate: Date | null;
  game1: number | null;
  game2: number | null;
  game3: number | null;
  scratchSeries: number | null;
  turkeys: number;
  incomingAvg: number | null;
  incomingHcp: number | null;
  teamID: number | null;
  opponentName: string | null;
  opponentSlug: string | null;
  teamGamePts: number | null;
  oppGamePts: number | null;
  teamSeries: number | null;
  teamBestSeries: number | null;
  handSeries: number | null;
  teamBestHandSeries: number | null;
}

export interface WrappedSeasonRow {
  seasonID: number;
  romanNumeral: string;
  displayName: string;
  nights: number;
  games: number;
  pins: number;
  average: number;
  highSeries: number;
  turkeys: number;
}

export interface LeagueBowlerRow {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  nights: number;
  games: number;
  pins: number;
  average: number;
  turkeys: number;
  highGame: number;
  highSeries: number;
}

export interface TeammateRow {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  nightsTogether: number;
}

export interface TeamStandingRow {
  teamID: number;
  teamName: string;
  slug: string;
  divisionName: string | null;
  wins: number;
  xp: number;
  matches: number;
}

export interface WrappedPatchRow { code: string; week: number | null }
export interface WrappedMilestoneRow { category: string; threshold: number; week: number }

export interface LeagueNightRow { seasonID: number; romanNumeral: string; week: number; matchDate: Date; bowled: number }
export interface NightStreak { length: number; from: Date; to: Date }

/** Longest run of consecutive league nights bowled, and the run still alive at the end. */
export function nightStreaks(nights: LeagueNightRow[]): { longest: NightStreak | null; current: number } {
  let longest: NightStreak | null = null;
  let run: LeagueNightRow[] = [];
  const close = () => {
    if (run.length > 0 && (!longest || run.length > longest.length)) {
      longest = { length: run.length, from: run[0].matchDate, to: run[run.length - 1].matchDate };
    }
  };
  for (const n of nights) {
    if (n.bowled) run.push(n);
    else { close(); run = []; }
  }
  close();
  return { longest, current: run.length };
}

export interface RankNeighbor { bowlerName: string; slug: string; value: number; rank: number }
export interface Ranked {
  rank: number;
  field: number;
  value: number;
  /** Everyone sharing the next value up, best first. */
  above: RankNeighbor[];
  /** Everyone sharing the next value down. */
  below: RankNeighbor[];
  tiedWith: RankNeighbor[];
}

export interface DebutSeasonRow { bowlerID: number; bowlerName: string; slug: string; seasonID: number; romanNumeral: string; games: number; average: number }

/** Average by game slot this season, with the archetype the bowler page uses. */
export interface SlotProfile {
  avg1: number; avg2: number; avg3: number;
  bestGame: 1 | 2 | 3;
  archetype: GameArchetype;
  pctSpread: number;
  league: { avg1: number; avg2: number; avg3: number } | null;
}

export interface CareerNightRow { seasonID: number; week: number; scratchSeries: number }

/** One night's PIN for the bowler and where it sat in the league that week. */
export interface NightPin { week: number; pin: number; rank: number; field: number; /** Others on the same PIN that week. */ tiedWith: number }

export interface BestNightContext {
  /** Average series of the bowler's other nights this season, null with one night. */
  otherNightsAvg: number | null;
  /** 1 = best night of the career, ties share a rank. */
  careerRank: number;
  careerNights: number;
  pin: NightPin | null;
}

export interface CareerGameNightRow { seasonID: number; romanNumeral: string; week: number; matchDate: Date | null; game1: number | null; game2: number | null; game3: number | null }

export interface HighGameContext {
  /** Average of the bowler's other games this season. */
  otherGamesAvg: number | null;
  /** Games this season at or above 200. */
  games200: number;
  /** 1 = highest game of the career, ties share a rank. */
  careerRank: number;
  careerGames: number;
  /** The most recent earlier game at least this high, null if there is none. */
  lastAsGood: { seasonID: number; romanNumeral: string; week: number; matchDate: Date | null; score: number } | null;
}

export interface BigSwing {
  week: number;
  /** 1 = game one to game two, 2 = game two to game three. */
  fromGame: 1 | 2;
  from: number;
  to: number;
  /** to minus from; negative is a drop. */
  gap: number;
  /** Rank by size among every bowler's swing in the same direction this season, 0 when unknown. */
  leagueRank: number;
  leagueField: number;
}

export interface TeamStint {
  teamID: number;
  teamName: string;
  slug: string;
  nights: number;
  firstWeek: number;
  /** The team's points won and lost on the nights the bowler was in the lineup, same scale as the standings record. */
  record: { won: number; lost: number };
  nightsAsTeamBest: number;
  nightsAsTeamBestHcp: number;
}

/** How the bowler bowls, not how well: steadiness against the league, games above and below average, and team impact. */
export interface BowlerStyle {
  /** Game-to-game standard deviation as a share of the season average, in percent. */
  variation: number;
  /** Share of the qualifying field that is steadier than this bowler, 0 (steadiest) to 100 (most mercurial). */
  variationPercentile: number;
  /** The league's median variation, for the tick on the line. */
  leagueMedianVariation: number;
  fieldSize: number;
  /** Games above and below the bowler's book average when there is one, else the season average. */
  aboveBelow: { above: number; below: number; even: number; basis: 'book' | 'season' };
  /** Season PIN total, and where it ranks among everyone with a PIN this season. */
  impact: { total: number; rank: number; field: number; tiedWith: number };
}

export interface CareerNightsRow { bowlerID: number; bowlerName: string; slug: string; nights: number }

export interface CareerNightsRank {
  /** 1 = most nights; ties share a rank. */
  rank: number;
  total: number;
  /** Other bowlers on exactly the same night count. */
  tiedWith: number;
  /** The rank one more night would earn, everyone else standing still. Equals rank when the gap is wider than a night. */
  rankAfterOneMore: number;
  /** Nearest bowler with strictly more nights. */
  above: { bowlerName: string; slug: string; nights: number; rank: number } | null;
  /** Nearest bowler with strictly fewer nights. */
  below: { bowlerName: string; slug: string; nights: number } | null;
}

export interface BowlerWrapped {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  season: { seasonID: number; romanNumeral: string; displayName: string; weekCount: number | null };
  /** Ordinal of this season among the bowler's own, 1 = first season ever. */
  seasonNumber: number;
  leagueSeasonCount: number;
  /** The bowler's first league night, the league's first night, and this season's last. */
  tenure: {
    firstNight: Date | null;
    /** The most recent night the bowler bowled, any season. */
    lastNight: Date | null;
    leagueFirstNight: Date | null;
    seasonLastNight: Date | null;
    pctOfHistory: number | null;
    /** Nights the bowler has bowled, career. */
    careerNights: number;
    /** League nights (season, week) that have been bowled since the bowler's first night, this one included. */
    leagueNightsSinceFirst: number;
  };
  /** What was number one on the bowler's first night: the Hot 100 chart in force and the weekend's box office. */
  firstNightCulture: { song: string; artist: string } | null;
  firstNightFilm: string | null;
  attendance: {
    /** Share of bowlers active since the first night who have bowled fewer nights than this bowler, 0 to 100. */
    pctBowlersBelow: number | null;
    bowlersInWindow: number;
    /** Share of league nights since the first night that this bowler bowled, 0 to 100. */
    pctOfNights: number | null;
    longestStreak: NightStreak | null;
    /** Consecutive nights bowled ending at the most recent league night, 0 if the last night was missed. */
    currentStreak: number;
  };
  /** Where the bowler's career night count sits among every bowler who has ever bowled, through this season. */
  careerNightsRank: CareerNightsRank;
  style: BowlerStyle | null;
  /** Game 1/2/3 averages this season; null until the bowler has a full night. */
  slotProfile: SlotProfile | null;
  /** For a first-season bowler, this average ranked against every other bowler's first season. Null otherwise. */
  debut: Ranked | null;
  /** Everyone else whose first league night was the same night, active bowlers first. */
  firstNightClassmates: Array<{ bowlerID: number; bowlerName: string; slug: string; isActive: boolean }>;
  weeks: WrappedWeek[];
  nights: number;
  games: number;
  pins: number;
  average: number;
  startingAvg: number | null;
  endingAvg: number | null;
  startingHcp: number | null;
  endingHcp: number | null;
  turkeys: number;
  turkeyNights: number;
  bestNight: WrappedWeek | null;
  bestNightContext: BestNightContext | null;
  highGameContext: HighGameContext | null;
  /** The bowler's PIN each night this season, in week order. */
  nightPins: NightPin[];
  highGame: { score: number; week: number; gameNo: 1 | 2 | 3 } | null;
  /** The largest jump or drop between consecutive games this season, sign kept, with its place among the league's swings in that direction. */
  bigSwing: BigSwing | null;
  ranks: { pins: Ranked; average: Ranked; turkeys: Ranked; highGame: Ranked };
  ownSeasons: { rank: number; total: number; bestSince: WrappedSeasonRow | null; previous: WrappedSeasonRow | null };
  /** Every season the bowler has played, oldest first. */
  seasons: WrappedSeasonRow[];
  team: {
    teamID: number;
    teamName: string;
    slug: string;
    divisionName: string | null;
    place: number;
    divisionSize: number;
    wins: number;
    losses: number;
    xp: number;
    /** Points the team won and lost on the bowler's nights, same scale as wins and losses. */
    matchRecordWithMe: { won: number; lost: number };
    nightsAsTeamBest: number;
    /** Nights the bowler's handicap series was the best on the team. */
    nightsAsTeamBestHcp: number;
  } | null;
  /** Every team the bowler scored for this season, most nights first. */
  teamStints: TeamStint[];
  /** True when no single team holds two thirds of the bowler's nights. */
  isFloater: boolean;
  teammates: TeammateRow[];
  patches: WrappedPatchRow[];
  milestones: WrappedMilestoneRow[];
}

/**
 * The recap reads two batches. The per-bowler batch is everything keyed on
 * @bowlerID and is cached per bowler. The per-season batch is the league-wide
 * context every bowler shares (the season's scores and match results, the
 * standings, career nights and debut seasons for the whole league) and is
 * cached once per season, so 135 recaps do not each pull the same rows.
 *
 * mergeRecordsets puts the two back into the single 20-slot order the
 * assembler was written against: season slots are 3, 5, 13, 14, 15, 16, 17.
 */
export const BOWLER_WRAPPED_BOWLER_SQL = `

  SELECT b.bowlerID, b.bowlerName, b.slug,
         sn.seasonID, sn.romanNumeral, sn.displayName, sn.weekCount,
         (SELECT COUNT(*) FROM seasons) AS leagueSeasonCount
  FROM bowlers b CROSS JOIN seasons sn
  WHERE b.bowlerID = @bowlerID AND sn.seasonID = @seasonID;

  SELECT sc.week, sch.matchDate, sc.game1, sc.game2, sc.game3, sc.scratchSeries,
         ISNULL(sc.turkeys, 0) AS turkeys, sc.incomingAvg, sc.incomingHcp, sc.teamID,
         COALESCE(oppHist.teamName, opp.teamName) AS opponentName,
         opp.slug AS opponentSlug,
         CASE WHEN sch.team1ID = sc.teamID THEN mr.team1GamePts ELSE mr.team2GamePts END AS teamGamePts,
         CASE WHEN sch.team1ID = sc.teamID THEN mr.team2GamePts ELSE mr.team1GamePts END AS oppGamePts,
         CASE WHEN sch.team1ID = sc.teamID THEN mr.team1Series ELSE mr.team2Series END AS teamSeries,
         (SELECT MAX(x.scratchSeries) FROM scores x
            WHERE x.seasonID = sc.seasonID AND x.week = sc.week AND x.teamID = sc.teamID AND x.isPenalty = 0) AS teamBestSeries,
         sc.handSeries,
         (SELECT MAX(x.handSeries) FROM scores x
            WHERE x.seasonID = sc.seasonID AND x.week = sc.week AND x.teamID = sc.teamID AND x.isPenalty = 0) AS teamBestHandSeries
  FROM scores sc
  LEFT JOIN schedule sch ON sch.seasonID = sc.seasonID AND sch.week = sc.week
                        AND (sch.team1ID = sc.teamID OR sch.team2ID = sc.teamID)
  LEFT JOIN matchResults mr ON mr.scheduleID = sch.scheduleID
  LEFT JOIN teams opp ON opp.teamID = CASE WHEN sch.team1ID = sc.teamID THEN sch.team2ID ELSE sch.team1ID END
  LEFT JOIN teamNameHistory oppHist ON oppHist.seasonID = sc.seasonID
                                   AND oppHist.teamID = CASE WHEN sch.team1ID = sc.teamID THEN sch.team2ID ELSE sch.team1ID END
  WHERE sc.bowlerID = @bowlerID AND sc.seasonID = @seasonID AND sc.isPenalty = 0
  ORDER BY sc.week;

  SELECT sc.seasonID, sn.romanNumeral, sn.displayName,
         COUNT(*) AS nights, SUM(sc.gamesBowled) AS games, SUM(sc.scratchSeries) AS pins,
         CAST(SUM(sc.scratchSeries) * 1.0 / NULLIF(SUM(sc.gamesBowled), 0) AS DECIMAL(5,1)) AS average,
         MAX(sc.scratchSeries) AS highSeries, SUM(ISNULL(sc.turkeys, 0)) AS turkeys
  FROM scores sc JOIN seasons sn ON sn.seasonID = sc.seasonID
  WHERE sc.bowlerID = @bowlerID AND sc.isPenalty = 0
  GROUP BY sc.seasonID, sn.romanNumeral, sn.displayName, sn.year, sn.period
  ORDER BY sn.year, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END;

  SELECT tm.bowlerID, b.bowlerName, b.slug, COUNT(*) AS nightsTogether
  FROM scores me
  JOIN scores tm ON tm.seasonID = me.seasonID AND tm.week = me.week AND tm.teamID = me.teamID
                AND tm.bowlerID <> me.bowlerID AND tm.isPenalty = 0
  JOIN bowlers b ON b.bowlerID = tm.bowlerID
  WHERE me.bowlerID = @bowlerID AND me.seasonID = @seasonID AND me.isPenalty = 0
  GROUP BY tm.bowlerID, b.bowlerName, b.slug
  ORDER BY nightsTogether DESC, b.bowlerName;

  SELECT p.code, bp.week
  FROM bowlerPatches bp JOIN patches p ON p.patchID = bp.patchID
  WHERE bp.bowlerID = @bowlerID AND bp.seasonID = @seasonID
  ORDER BY bp.week;

  SELECT category, threshold, week
  FROM bowlerMilestones
  WHERE bowlerID = @bowlerID AND seasonID = @seasonID
  ORDER BY week;

  SELECT
    (SELECT MIN(sch.matchDate) FROM scores sc
       JOIN schedule sch ON sch.seasonID = sc.seasonID AND sch.week = sc.week
                        AND (sch.team1ID = sc.teamID OR sch.team2ID = sc.teamID)
       WHERE sc.bowlerID = @bowlerID AND sc.isPenalty = 0) AS firstNight,
    (SELECT MIN(matchDate) FROM schedule) AS leagueFirstNight,
    (SELECT MAX(matchDate) FROM schedule WHERE seasonID = @seasonID) AS seasonLastNight,
    (SELECT COUNT(*) FROM scores WHERE bowlerID = @bowlerID AND isPenalty = 0) AS careerNights,
    (SELECT MAX(sch.matchDate) FROM scores sc
       JOIN schedule sch ON sch.seasonID = sc.seasonID AND sch.week = sc.week
                        AND (sch.team1ID = sc.teamID OR sch.team2ID = sc.teamID)
       WHERE sc.bowlerID = @bowlerID AND sc.isPenalty = 0) AS lastNight,
    (SELECT COUNT(*) FROM (
       SELECT DISTINCT sch.seasonID, sch.week FROM schedule sch
       WHERE sch.seasonID <= @seasonID
         AND sch.matchDate >= (SELECT MIN(sch2.matchDate) FROM scores sc2
                                JOIN schedule sch2 ON sch2.seasonID = sc2.seasonID AND sch2.week = sc2.week
                                                  AND (sch2.team1ID = sc2.teamID OR sch2.team2ID = sc2.teamID)
                                WHERE sc2.bowlerID = @bowlerID AND sc2.isPenalty = 0)
         AND EXISTS (SELECT 1 FROM scores x WHERE x.seasonID = sch.seasonID AND x.week = sch.week)
     ) n) AS leagueNightsSinceFirst;

  WITH fn AS (
    SELECT MIN(sch.matchDate) AS firstNight FROM scores sc
    JOIN schedule sch ON sch.seasonID = sc.seasonID AND sch.week = sc.week
                     AND (sch.team1ID = sc.teamID OR sch.team2ID = sc.teamID)
    WHERE sc.bowlerID = @bowlerID AND sc.isPenalty = 0
  )
  SELECT
    (SELECT TOP 1 song FROM billboardNumberOnes b, fn
       WHERE b.chartDate >= fn.firstNight AND b.chartDate < DATEADD(day, 14, fn.firstNight) ORDER BY b.chartDate) AS song,
    (SELECT TOP 1 artist FROM billboardNumberOnes b, fn
       WHERE b.chartDate >= fn.firstNight AND b.chartDate < DATEADD(day, 14, fn.firstNight) ORDER BY b.chartDate) AS artist,
    (SELECT TOP 1 film FROM boxOfficeNumberOnes x, fn
       WHERE x.weekendEndDate <= fn.firstNight AND x.weekendEndDate > DATEADD(day, -8, fn.firstNight) ORDER BY x.weekendEndDate DESC) AS film;

  WITH firstNights AS (
    SELECT sc.bowlerID, MIN(sch.matchDate) AS firstNight FROM scores sc
    JOIN schedule sch ON sch.seasonID = sc.seasonID AND sch.week = sc.week
                     AND (sch.team1ID = sc.teamID OR sch.team2ID = sc.teamID)
    WHERE sc.isPenalty = 0
    GROUP BY sc.bowlerID
  )
  SELECT b.bowlerID, b.bowlerName, b.slug, b.isActive
  FROM firstNights o
  JOIN firstNights me ON me.bowlerID = @bowlerID AND o.firstNight = me.firstNight
  JOIN bowlers b ON b.bowlerID = o.bowlerID
  WHERE o.bowlerID <> @bowlerID
  ORDER BY b.isActive DESC, b.bowlerName;

  WITH fn AS (
    SELECT MIN(sch.matchDate) AS firstNight FROM scores sc
    JOIN schedule sch ON sch.seasonID = sc.seasonID AND sch.week = sc.week
                     AND (sch.team1ID = sc.teamID OR sch.team2ID = sc.teamID)
    WHERE sc.bowlerID = @bowlerID AND sc.isPenalty = 0
  ),
  nights AS (
    SELECT sc.seasonID, sc.week, MIN(sch.matchDate) AS matchDate
    FROM (SELECT DISTINCT seasonID, week FROM scores WHERE isPenalty = 0 AND seasonID <= @seasonID) sc
    JOIN schedule sch ON sch.seasonID = sc.seasonID AND sch.week = sc.week
    GROUP BY sc.seasonID, sc.week
  ),
  mine AS (
    SELECT DISTINCT seasonID, week FROM scores WHERE bowlerID = @bowlerID AND isPenalty = 0
  )
  SELECT n.seasonID, sn.romanNumeral, n.week, n.matchDate,
         CASE WHEN m.seasonID IS NULL THEN 0 ELSE 1 END AS bowled
  FROM nights n
  JOIN seasons sn ON sn.seasonID = n.seasonID
  CROSS JOIN fn
  LEFT JOIN mine m ON m.seasonID = n.seasonID AND m.week = n.week
  WHERE n.matchDate >= fn.firstNight
  ORDER BY n.matchDate, n.seasonID, n.week;

  WITH fn AS (
    SELECT MIN(sch.matchDate) AS firstNight FROM scores sc
    JOIN schedule sch ON sch.seasonID = sc.seasonID AND sch.week = sc.week
                     AND (sch.team1ID = sc.teamID OR sch.team2ID = sc.teamID)
    WHERE sc.bowlerID = @bowlerID AND sc.isPenalty = 0
  ),
  nights AS (
    SELECT seasonID, week, MIN(matchDate) AS matchDate FROM schedule WHERE seasonID <= @seasonID GROUP BY seasonID, week
  ),
  perBowler AS (
    SELECT sc.bowlerID, COUNT(*) AS nights
    FROM scores sc
    JOIN nights n ON n.seasonID = sc.seasonID AND n.week = sc.week
    CROSS JOIN fn
    WHERE sc.isPenalty = 0 AND n.matchDate >= fn.firstNight
    GROUP BY sc.bowlerID
  )
  SELECT
    (SELECT COUNT(*) FROM perBowler) AS bowlersInWindow,
    (SELECT COUNT(*) FROM perBowler p WHERE p.nights < (SELECT nights FROM perBowler WHERE bowlerID = @bowlerID)) AS bowlersBelow;

  SELECT sc.seasonID, sc.week, sc.scratchSeries
  FROM scores sc
  WHERE sc.bowlerID = @bowlerID AND sc.isPenalty = 0 AND sc.scratchSeries IS NOT NULL
  ORDER BY sc.scratchSeries DESC;

  SELECT sc.seasonID, sn.romanNumeral, sc.week, MIN(sch.matchDate) AS matchDate, sc.game1, sc.game2, sc.game3
  FROM scores sc
  JOIN seasons sn ON sn.seasonID = sc.seasonID
  JOIN schedule sch ON sch.seasonID = sc.seasonID AND sch.week = sc.week
                   AND (sch.team1ID = sc.teamID OR sch.team2ID = sc.teamID)
  WHERE sc.bowlerID = @bowlerID AND sc.isPenalty = 0
  GROUP BY sc.seasonID, sn.romanNumeral, sc.week, sc.game1, sc.game2, sc.game3
  ORDER BY matchDate, sc.week;;
`;

export const BOWLER_WRAPPED_SEASON_SQL = `

  SELECT sc.bowlerID, b.bowlerName, b.slug,
         COUNT(*) AS nights, SUM(sc.gamesBowled) AS games, SUM(sc.scratchSeries) AS pins,
         CAST(SUM(sc.scratchSeries) * 1.0 / NULLIF(SUM(sc.gamesBowled), 0) AS DECIMAL(5,1)) AS average,
         SUM(ISNULL(sc.turkeys, 0)) AS turkeys,
         MAX(CASE WHEN ISNULL(sc.game1,0) >= ISNULL(sc.game2,0) AND ISNULL(sc.game1,0) >= ISNULL(sc.game3,0) THEN sc.game1
                  WHEN ISNULL(sc.game2,0) >= ISNULL(sc.game3,0) THEN sc.game2 ELSE sc.game3 END) AS highGame,
         MAX(sc.scratchSeries) AS highSeries
  FROM scores sc JOIN bowlers b ON b.bowlerID = sc.bowlerID
  WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0
  GROUP BY sc.bowlerID, b.bowlerName, b.slug;

  WITH pts AS (
    SELECT sch.team1ID AS teamID, mr.team1GamePts AS gp, mr.team1BonusPts AS xp
    FROM matchResults mr JOIN schedule sch ON sch.scheduleID = mr.scheduleID WHERE sch.seasonID = @seasonID
    UNION ALL
    SELECT sch.team2ID, mr.team2GamePts, mr.team2BonusPts
    FROM matchResults mr JOIN schedule sch ON sch.scheduleID = mr.scheduleID WHERE sch.seasonID = @seasonID
  )
  SELECT t.teamID, COALESCE(tnh.teamName, t.teamName) AS teamName, t.slug, sd.divisionName,
         SUM(pts.gp) AS wins, SUM(pts.xp) AS xp, COUNT(*) AS matches
  FROM pts
  JOIN teams t ON t.teamID = pts.teamID
  LEFT JOIN teamNameHistory tnh ON tnh.seasonID = @seasonID AND tnh.teamID = t.teamID
  LEFT JOIN seasonDivisions sd ON sd.seasonID = @seasonID AND sd.teamID = t.teamID
  GROUP BY t.teamID, COALESCE(tnh.teamName, t.teamName), t.slug, sd.divisionName;

  SELECT b.bowlerID, b.bowlerName, b.slug, COUNT(*) AS nights
  FROM scores sc JOIN bowlers b ON b.bowlerID = sc.bowlerID
  WHERE sc.isPenalty = 0 AND sc.seasonID <= @seasonID
  GROUP BY b.bowlerID, b.bowlerName, b.slug
  ORDER BY nights DESC, b.bowlerName;

  SELECT AVG(CAST(game1 AS FLOAT)) AS avg1, AVG(CAST(game2 AS FLOAT)) AS avg2, AVG(CAST(game3 AS FLOAT)) AS avg3
  FROM scores WHERE seasonID = @seasonID AND isPenalty = 0;

  WITH firstSeason AS (
    SELECT bowlerID, MIN(seasonID) AS seasonID FROM scores WHERE isPenalty = 0 GROUP BY bowlerID
  )
  SELECT b.bowlerID, b.bowlerName, b.slug, f.seasonID, sn.romanNumeral,
         SUM(sc.gamesBowled) AS games,
         CAST(SUM(sc.scratchSeries) AS FLOAT) / NULLIF(SUM(sc.gamesBowled), 0) AS average
  FROM firstSeason f
  JOIN scores sc ON sc.bowlerID = f.bowlerID AND sc.seasonID = f.seasonID AND sc.isPenalty = 0
  JOIN bowlers b ON b.bowlerID = f.bowlerID
  JOIN seasons sn ON sn.seasonID = f.seasonID
  WHERE f.seasonID <= @seasonID
  GROUP BY b.bowlerID, b.bowlerName, b.slug, f.seasonID, sn.romanNumeral
  ORDER BY average DESC;

  SELECT sc.week, sc.bowlerID, b.bowlerName, b.slug AS bowlerSlug, sc.teamID, t.teamName,
         sc.game1, sc.game2, sc.game3, sc.incomingHcp
  FROM scores sc JOIN bowlers b ON b.bowlerID = sc.bowlerID JOIN teams t ON t.teamID = sc.teamID
  WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0;

  SELECT sch.week, sch.team1ID AS homeTeamID, sch.team2ID AS awayTeamID,
         mr.team1Game1, mr.team1Game2, mr.team1Game3, mr.team1Series,
         mr.team2Game1, mr.team2Game2, mr.team2Game3, mr.team2Series
  FROM matchResults mr JOIN schedule sch ON sch.scheduleID = mr.scheduleID
  WHERE sch.seasonID = @seasonID;
`;

export const SEASON_RECORDSET_SLOTS = [3, 5, 13, 14, 15, 16, 17] as const;
export const WRAPPED_RECORDSET_COUNT = 20;

export function mergeRecordsets(bowler: unknown[][], season: unknown[][]): unknown[][] {
  const merged: unknown[][] = [];
  let b = 0, se = 0;
  for (let i = 0; i < WRAPPED_RECORDSET_COUNT; i++) {
    merged.push((SEASON_RECORDSET_SLOTS as readonly number[]).includes(i) ? (season[se++] ?? []) : (bowler[b++] ?? []));
  }
  return merged;
}

/** Rank a value within the field (1 = best, ties share a rank), with neighbors. */
export function rankWithin(
  field: LeagueBowlerRow[],
  key: 'pins' | 'average' | 'turkeys' | 'highGame',
  bowlerID: number,
): Ranked {
  const sorted = [...field].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0) || a.bowlerName.localeCompare(b.bowlerName));
  const idx = sorted.findIndex(r => r.bowlerID === bowlerID);
  const value = idx >= 0 ? sorted[idx][key] : 0;
  const rankOf = (v: number) => sorted.findIndex(r => r[key] === v) + 1;
  const toNeighbor = (r: LeagueBowlerRow): RankNeighbor => ({ bowlerName: r.bowlerName, slug: r.slug, value: r[key], rank: rankOf(r[key]) });
  const rank = idx >= 0 ? rankOf(value) : 0;
  const tiedWith = sorted.filter(r => r.bowlerID !== bowlerID && r[key] === value).map(toNeighbor);
  const aboveValue = [...sorted].reverse().find(r => r[key] > value)?.[key];
  const belowValue = sorted.find(r => r[key] < value)?.[key];
  return {
    rank,
    field: sorted.length,
    value,
    above: aboveValue == null ? [] : sorted.filter(r => r[key] === aboveValue).map(toNeighbor),
    below: belowValue == null ? [] : sorted.filter(r => r[key] === belowValue).map(toNeighbor),
    tiedWith,
  };
}

/** The biggest climb from one game to the next within a single night. */
/** The biggest swing between consecutive games across the bowler's nights, up or down. Ties go to the climb. */
export function findBigSwing(weeks: WrappedWeek[]): Omit<BigSwing, 'leagueRank' | 'leagueField'> | null {
  let best: Omit<BigSwing, 'leagueRank' | 'leagueField'> | null = null;
  for (const w of weeks) {
    const pairs: Array<[number | null, number | null, 1 | 2]> = [[w.game1, w.game2, 1], [w.game2, w.game3, 2]];
    for (const [from, to, fromGame] of pairs) {
      if (from == null || to == null) continue;
      const gap = to - from;
      if (!best || Math.abs(gap) > Math.abs(best.gap) || (Math.abs(gap) === Math.abs(best.gap) && gap > best.gap)) {
        best = { week: w.week, fromGame, from, to, gap };
      }
    }
  }
  return best;
}

/** Every consecutive-game swing in the season's scores, so a bowler's can be ranked against the league's. */
export function rankSwing(swing: Omit<BigSwing, 'leagueRank' | 'leagueField'> | null, scores: Array<{ game1: number | null; game2: number | null; game3: number | null }>): BigSwing | null {
  if (!swing) return null;
  const sameWay = scores.flatMap(sc => [[sc.game1, sc.game2], [sc.game2, sc.game3]] as Array<[number | null, number | null]>)
    .filter((p): p is [number, number] => p[0] != null && p[1] != null)
    .map(([a, b]) => b - a)
    .filter(g => (swing.gap >= 0 ? g > 0 : g < 0));
  const size = Math.abs(swing.gap);
  return {
    ...swing,
    leagueRank: sameWay.length ? 1 + sameWay.filter(g => Math.abs(g) > size).length : 0,
    leagueField: sameWay.length,
  };
}

export function findHighGame(weeks: WrappedWeek[]): BowlerWrapped['highGame'] {
  let best: BowlerWrapped['highGame'] = null;
  for (const w of weeks) {
    const games: Array<[number | null, 1 | 2 | 3]> = [[w.game1, 1], [w.game2, 2], [w.game3, 3]];
    for (const [score, gameNo] of games) {
      if (score != null && (!best || score > best.score)) best = { score, week: w.week, gameNo };
    }
  }
  return best;
}

/** Where this season sits among the bowler's own seasons by average (1 = best). */
export function rankOwnSeasons(seasons: WrappedSeasonRow[], seasonID: number): BowlerWrapped['ownSeasons'] {
  const idx = seasons.findIndex(s => s.seasonID === seasonID);
  const mine = idx >= 0 ? seasons[idx] : null;
  if (!mine) return { rank: 0, total: seasons.length, bestSince: null, previous: null };
  const rank = seasons.filter(s => s.average > mine.average).length + 1;
  // Most recent earlier season with an average at least this good.
  let bestSince: WrappedSeasonRow | null = null;
  for (let i = idx - 1; i >= 0; i--) {
    if (seasons[i].average >= mine.average) { bestSince = seasons[i]; break; }
  }
  // Only meaningful when at least one season in between was worse.
  if (bestSince && idx - seasons.indexOf(bestSince) < 2) bestSince = null;
  return { rank, total: seasons.length, bestSince, previous: idx > 0 ? seasons[idx - 1] : null };
}

/**
 * Share of the league's history the bowler has been around for: from their
 * first night to the end of this season, over the league's first night to the
 * same end. Night one of the league scores 100.
 */
/** Average by game slot over the season's weeks, skipping unbowled games. */
export function slotProfile(weeks: WrappedWeek[], league: { avg1: number | null; avg2: number | null; avg3: number | null } | undefined): SlotProfile | null {
  const avgOf = (vals: Array<number | null>) => { const v = vals.filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const avg1 = avgOf(weeks.map(w => w.game1)), avg2 = avgOf(weeks.map(w => w.game2)), avg3 = avgOf(weeks.map(w => w.game3));
  if (avg1 == null || avg2 == null || avg3 == null) return null;
  const overall = (avg1 + avg2 + avg3) / 3;
  const pctSpread = overall > 0 ? ((Math.max(avg1, avg2, avg3) - Math.min(avg1, avg2, avg3)) / overall) * 100 : 0;
  const { bestGame, archetype } = classifyArchetype(avg1, avg2, avg3, pctSpread);
  const lg = league && league.avg1 != null && league.avg2 != null && league.avg3 != null ? { avg1: league.avg1, avg2: league.avg2, avg3: league.avg3 } : null;
  return { avg1, avg2, avg3, bestGame, archetype, pctSpread, league: lg };
}

/** Rank a first-season average against every bowler's first season that cleared the games line. */
export function rankDebut(rows: DebutSeasonRow[], bowlerID: number, minGames: number): Ranked | null {
  const me = rows.find(r => r.bowlerID === bowlerID);
  if (!me) return null;
  const field: LeagueBowlerRow[] = rows
    .filter(r => r.games >= minGames || r.bowlerID === bowlerID)
    .map(r => ({ bowlerID: r.bowlerID, bowlerName: r.bowlerName, slug: r.slug, nights: 0, games: r.games, pins: 0, average: r.average, turkeys: 0, highGame: 0, highSeries: 0 }));
  return rankWithin(field, 'average', bowlerID);
}

/** The bowler's PIN for every week of the season, with its rank among everyone who bowled that week. */
export function nightPinsFor(bowlerID: number, scores: Array<PinBowler & { week: number }>, matches: Array<PinMatch & { week: number }>): NightPin[] {
  const weeks = [...new Set(scores.filter(sc => sc.bowlerID === bowlerID).map(sc => sc.week))].sort((a, b) => a - b);
  const out: NightPin[] = [];
  for (const week of weeks) {
    const pins = pinScoresForWeek(scores.filter(sc => sc.week === week), matches.filter(m => m.week === week));
    const mine = pins.find(p => p.bowlerID === bowlerID);
    if (!mine) continue;
    out.push({ week, pin: mine.pin, rank: 1 + pins.filter(p => p.pin > mine.pin).length, field: pins.length, tiedWith: pins.filter(p => p.pin === mine.pin).length - 1 });
  }
  return out;
}

const stdevPct = (games: number[]): number | null => {
  if (games.length < 2) return null;
  const mean = games.reduce((a, b) => a + b, 0) / games.length;
  if (mean <= 0) return null;
  const variance = games.reduce((a, g) => a + (g - mean) ** 2, 0) / games.length;
  return (Math.sqrt(variance) / mean) * 100;
};

/** Season PIN total for every bowler, from the same per-week math the nightly PIN uses. */
export function seasonPinTotals(scores: Array<PinBowler & { week: number }>, matches: Array<PinMatch & { week: number }>): Map<number, number> {
  const totals = new Map<number, number>();
  for (const week of new Set(scores.map(sc => sc.week))) {
    for (const p of pinScoresForWeek(scores.filter(sc => sc.week === week), matches.filter(m => m.week === week))) {
      totals.set(p.bowlerID, (totals.get(p.bowlerID) ?? 0) + p.pin);
    }
  }
  return totals;
}

export function styleFor(
  bowlerID: number,
  weeks: WrappedWeek[],
  scores: Array<PinBowler & { week: number; incomingAvg?: number | null }>,
  matches: Array<PinMatch & { week: number }>,
  minGames: number,
): BowlerStyle | null {
  const myGames = weeks.flatMap(w => [w.game1, w.game2, w.game3]).filter((g): g is number => g != null);
  const variation = stdevPct(myGames);
  if (variation == null) return null;

  // Variation for everyone who cleared the games line this season.
  const byBowler = new Map<number, number[]>();
  for (const sc of scores) {
    const gs = [sc.game1, sc.game2, sc.game3].filter((g): g is number => g != null);
    byBowler.set(sc.bowlerID, [...(byBowler.get(sc.bowlerID) ?? []), ...gs]);
  }
  const field = [...byBowler.entries()]
    .filter(([id, gs]) => gs.length >= minGames || id === bowlerID)
    .map(([, gs]) => stdevPct(gs))
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);
  const steadier = field.filter(v => v < variation).length;
  const median = field.length ? field[Math.floor(field.length / 2)] : variation;

  const hasBook = weeks.some(w => w.incomingAvg != null);
  const seasonAvg = myGames.reduce((a, b) => a + b, 0) / myGames.length;
  let above = 0, below = 0, even = 0;
  for (const w of weeks) {
    const basis = hasBook ? w.incomingAvg : seasonAvg;
    if (basis == null) continue;
    for (const g of [w.game1, w.game2, w.game3]) {
      if (g == null) continue;
      if (g > basis) above++; else if (g < basis) below++; else even++;
    }
  }

  const totals = seasonPinTotals(scores, matches);
  const mine = totals.get(bowlerID) ?? 0;
  const all = [...totals.values()];
  return {
    variation,
    variationPercentile: field.length > 1 ? Math.round((steadier / (field.length - 1)) * 100) : 50,
    leagueMedianVariation: median,
    fieldSize: field.length,
    aboveBelow: { above, below, even, basis: hasBook ? 'book' : 'season' },
    impact: {
      total: mine,
      rank: totals.has(bowlerID) ? 1 + all.filter(v => v > mine).length : 0,
      field: all.length,
      tiedWith: totals.has(bowlerID) ? all.filter(v => v === mine).length - 1 : 0,
    },
  };
}

/** Context for the season's high game: against the other games, the career, and when the bowler last shot that well. */
export function highGameContextFor(
  high: BowlerWrapped['highGame'], weeks: WrappedWeek[], career: CareerGameNightRow[], seasonID: number,
): HighGameContext | null {
  if (!high) return null;
  const seasonGames = weeks.flatMap(w => [w.game1, w.game2, w.game3]).filter((g): g is number => g != null);
  const others = [...seasonGames];
  others.splice(others.indexOf(high.score), 1);
  const careerGames = career.flatMap(n => ([[n.game1, 1], [n.game2, 2], [n.game3, 3]] as Array<[number | null, 1 | 2 | 3]>)
    .filter((g): g is [number, 1 | 2 | 3] => g[0] != null)
    .map(([score, gameNo]) => ({ ...n, score, gameNo })));
  const thisGame = careerGames.find(g => g.seasonID === seasonID && g.week === high.week && g.gameNo === high.gameNo);
  const before = thisGame
    ? careerGames.filter(g => (g.matchDate && thisGame.matchDate ? g.matchDate < thisGame.matchDate : g.seasonID < seasonID) || (g.seasonID === seasonID && g.week === high.week && g.gameNo < high.gameNo))
    : careerGames.filter(g => g.seasonID < seasonID);
  const asGood = before.filter(g => g.score >= high.score);
  const last = asGood.length ? asGood.reduce((a, b) => ((b.matchDate ?? 0) > (a.matchDate ?? 0) ? b : a)) : null;
  return {
    otherGamesAvg: others.length ? Math.round(others.reduce((a, b) => a + b, 0) / others.length) : null,
    games200: seasonGames.filter(g => g >= 200).length,
    careerRank: 1 + careerGames.filter(g => g.score > high.score).length,
    careerGames: careerGames.length,
    lastAsGood: last ? { seasonID: last.seasonID, romanNumeral: last.romanNumeral, week: last.week, matchDate: last.matchDate, score: last.score } : null,
  };
}

/** Context for the best night: against the bowler's other nights, against the career, and the PIN. */
export function bestNightContextFor(best: WrappedWeek | null, weeks: WrappedWeek[], career: CareerNightRow[], pins: NightPin[]): BestNightContext | null {
  if (!best || best.scratchSeries == null) return null;
  const others = weeks.filter(w => w !== best && w.scratchSeries != null).map(w => w.scratchSeries as number);
  const series = best.scratchSeries;
  return {
    otherNightsAvg: others.length ? Math.round(others.reduce((a, b) => a + b, 0) / others.length) : null,
    careerRank: 1 + career.filter(c => c.scratchSeries > series).length,
    careerNights: career.length,
    pin: pins.find(p => p.week === best.week) ?? null,
  };
}

/** One stint per team the bowler scored for, most nights first, with the record and team-best counts on those nights. */
export function teamStintsFor(weeks: WrappedWeek[], standings: TeamStandingRow[]): TeamStint[] {
  const byTeam = new Map<number, WrappedWeek[]>();
  for (const w of weeks) if (w.teamID != null) byTeam.set(w.teamID, [...(byTeam.get(w.teamID) ?? []), w]);
  return [...byTeam.entries()].map(([teamID, ws]) => {
    const row = standings.find(t => t.teamID === teamID);
    const scored = ws.filter(w => w.teamGamePts != null);
    return {
      teamID,
      teamName: row?.teamName ?? 'Unknown team',
      slug: row?.slug ?? '',
      nights: ws.length,
      firstWeek: Math.min(...ws.map(w => w.week)),
      record: {
        won: scored.reduce((n, w) => n + (w.teamGamePts ?? 0), 0),
        lost: scored.reduce((n, w) => n + (w.oppGamePts ?? 0), 0),
      },
      nightsAsTeamBest: ws.filter(w => w.scratchSeries != null && w.scratchSeries === w.teamBestSeries).length,
      nightsAsTeamBestHcp: ws.filter(w => w.handSeries != null && w.handSeries === w.teamBestHandSeries).length,
    };
  }).sort((a, b) => b.nights - a.nights || a.firstWeek - b.firstWeek);
}

/** Rank a bowler's career nights among every bowler, with the nearest neighbors either side. */
export function careerNightsLadder(rows: CareerNightsRow[], bowlerID: number): CareerNightsRank {
  const mine = rows.find(r => r.bowlerID === bowlerID)?.nights ?? 0;
  const rankOf = (n: number) => 1 + rows.filter(r => r.nights > n).length;
  const aboveRow = rows.filter(r => r.nights > mine).sort((a, b) => a.nights - b.nights)[0] ?? null;
  const belowRow = rows.filter(r => r.nights < mine).sort((a, b) => b.nights - a.nights)[0] ?? null;
  return {
    rank: rankOf(mine),
    total: rows.some(r => r.bowlerID === bowlerID) ? rows.length : rows.length + 1,
    tiedWith: rows.filter(r => r.nights === mine && r.bowlerID !== bowlerID).length,
    rankAfterOneMore: rankOf(mine + 1),
    above: aboveRow ? { bowlerName: aboveRow.bowlerName, slug: aboveRow.slug, nights: aboveRow.nights, rank: rankOf(aboveRow.nights) } : null,
    below: belowRow ? { bowlerName: belowRow.bowlerName, slug: belowRow.slug, nights: belowRow.nights } : null,
  };
}

export function computeTenure(firstNight: Date | null, leagueFirstNight: Date | null, seasonLastNight: Date | null): Omit<BowlerWrapped['tenure'], 'careerNights' | 'leagueNightsSinceFirst' | 'lastNight'> {
  let pctOfHistory: number | null = null;
  if (firstNight && leagueFirstNight && seasonLastNight) {
    const total = new Date(seasonLastNight).getTime() - new Date(leagueFirstNight).getTime();
    const mine = new Date(seasonLastNight).getTime() - new Date(firstNight).getTime();
    if (total > 0) pctOfHistory = Math.max(0, Math.min(100, Math.round((mine / total) * 100)));
  }
  return { firstNight, leagueFirstNight, seasonLastNight, pctOfHistory };
}

export function assembleWrapped(recordsets: unknown[][]): BowlerWrapped | null {
  const head = recordsets[0]?.[0] as Record<string, unknown> | undefined;
  if (!head) return null;
  const weeks = recordsets[1] as WrappedWeek[];
  const seasons = recordsets[2] as WrappedSeasonRow[];
  const league = recordsets[3] as LeagueBowlerRow[];
  const teammates = recordsets[4] as TeammateRow[];
  const standings = recordsets[5] as TeamStandingRow[];
  const patches = recordsets[6] as WrappedPatchRow[];
  const milestones = recordsets[7] as WrappedMilestoneRow[];
  const leagueNights = (recordsets[11] ?? []) as LeagueNightRow[];
  const streaks = nightStreaks(leagueNights);
  const window = { bowlersInWindow: 0, bowlersBelow: 0, ...((recordsets[12]?.[0] ?? {}) as { bowlersInWindow?: number; bowlersBelow?: number }) };
  const culture = (recordsets[9]?.[0] ?? {}) as { song?: string | null; artist?: string | null; film?: string | null };
  const dates = (recordsets[8]?.[0] ?? {}) as {
    firstNight?: Date | null; leagueFirstNight?: Date | null; seasonLastNight?: Date | null;
    careerNights?: number; leagueNightsSinceFirst?: number; lastNight?: Date | null;
  };

  const bowlerID = head.bowlerID as number;
  const seasonID = head.seasonID as number;
  // A bowler with no scores at all has nothing to say. One who sat this season
  // out still gets the career cards, so the empty-season case flows through.
  if (seasons.length === 0) return null;

  const games = weeks.reduce((n, w) => n + [w.game1, w.game2, w.game3].filter(g => g != null).length, 0);
  const pins = weeks.reduce((n, w) => n + (w.scratchSeries ?? 0), 0);
  const average = games > 0 ? Math.round((pins / games) * 10) / 10 : 0;
  const turkeys = weeks.reduce((n, w) => n + (w.turkeys ?? 0), 0);
  const highGame = findHighGame(weeks);
  const first = weeks[0] as WrappedWeek | undefined;
  const last = weeks[weeks.length - 1] as WrappedWeek | undefined;

  const minGames = getMinGamesForWeek(last?.week ?? 9);
  const bestNight = weeks.reduce<WrappedWeek | null>((b, w) =>
    w.scratchSeries != null && (!b || w.scratchSeries > (b.scratchSeries ?? 0)) ? w : b, null);
  const nightPins = nightPinsFor(
    bowlerID,
    (recordsets[16] ?? []) as Array<PinBowler & { week: number }>,
    (recordsets[17] ?? []) as Array<PinMatch & { week: number }>,
  );

  // Primary team = the one bowled with most this season (earliest stint breaks a tie).
  const teamStints = teamStintsFor(weeks, standings);
  const primaryTeamID = teamStints[0]?.teamID ?? null;
  const isFloater = teamStints.length > 1 && teamStints[0].nights < (weeks.length * 2) / 3;
  const teamRow = standings.find(t => t.teamID === primaryTeamID) ?? null;

  let team: BowlerWrapped['team'] = null;
  if (teamRow) {
    const division = standings
      .filter(t => t.divisionName === teamRow.divisionName)
      .sort((a, b) => (b.wins + b.xp) - (a.wins + a.xp) || b.wins - a.wins);
    const place = division.findIndex(t => t.teamID === teamRow.teamID) + 1;
    const myWeeks = weeks.filter(w => w.teamID === teamRow.teamID && w.teamGamePts != null);
    const matchRecordWithMe = {
      won: myWeeks.reduce((n, w) => n + (w.teamGamePts ?? 0), 0),
      lost: myWeeks.reduce((n, w) => n + (w.oppGamePts ?? 0), 0),
    };
    const nightsAsTeamBest = weeks.filter(w => w.teamID === teamRow.teamID && w.scratchSeries != null && w.scratchSeries === w.teamBestSeries).length;
    const nightsAsTeamBestHcp = weeks.filter(w => w.teamID === teamRow.teamID && w.handSeries != null && w.handSeries === w.teamBestHandSeries).length;
    team = {
      teamID: teamRow.teamID,
      teamName: teamRow.teamName,
      slug: teamRow.slug,
      divisionName: teamRow.divisionName,
      place,
      divisionSize: division.length,
      wins: teamRow.wins,
      // Six game points per match, so the rest of the pot went to opponents.
      losses: Math.max(0, teamRow.matches * 6 - teamRow.wins),
      xp: teamRow.xp,
      matchRecordWithMe,
      nightsAsTeamBest,
      nightsAsTeamBestHcp,
    };
  }

  return {
    bowlerID,
    bowlerName: head.bowlerName as string,
    slug: head.slug as string,
    season: {
      seasonID,
      romanNumeral: head.romanNumeral as string,
      displayName: head.displayName as string,
      weekCount: (head.weekCount as number | null) ?? null,
    },
    seasonNumber: seasons.findIndex(s => s.seasonID === seasonID) + 1,
    leagueSeasonCount: head.leagueSeasonCount as number,
    tenure: {
      ...computeTenure(dates.firstNight ?? null, dates.leagueFirstNight ?? null, dates.seasonLastNight ?? null),
      lastNight: dates.lastNight ?? null,
      careerNights: dates.careerNights ?? weeks.length,
      leagueNightsSinceFirst: dates.leagueNightsSinceFirst ?? weeks.length,
    },
    firstNightCulture: culture.song && culture.artist ? { song: culture.song, artist: culture.artist } : null,
    firstNightFilm: culture.film ?? null,
    careerNightsRank: careerNightsLadder((recordsets[13] ?? []) as CareerNightsRow[], bowlerID),
    style: styleFor(
      bowlerID, weeks,
      (recordsets[16] ?? []) as Array<PinBowler & { week: number }>,
      (recordsets[17] ?? []) as Array<PinMatch & { week: number }>,
      minGames,
    ),
    teamStints,
    isFloater,
    bestNightContext: bestNightContextFor(bestNight, weeks, (recordsets[18] ?? []) as CareerNightRow[], nightPins),
    highGameContext: highGameContextFor(highGame, weeks, (recordsets[19] ?? []) as CareerGameNightRow[], seasonID),
    nightPins,
    slotProfile: slotProfile(weeks, (recordsets[14]?.[0] ?? undefined) as { avg1: number | null; avg2: number | null; avg3: number | null } | undefined),
    debut: seasons.findIndex(sn => sn.seasonID === seasonID) === 0 && weeks.length > 0
      ? rankDebut((recordsets[15] ?? []) as DebutSeasonRow[], bowlerID, minGames)
      : null,
    firstNightClassmates: (recordsets[10] ?? []) as BowlerWrapped['firstNightClassmates'],
    attendance: {
      // "More than 100% of bowlers" is never true, so the top of the field reads 99.
      pctBowlersBelow: window.bowlersInWindow > 1 ? Math.min(99, Math.round((window.bowlersBelow / (window.bowlersInWindow - 1)) * 100)) : null,
      bowlersInWindow: window.bowlersInWindow,
      pctOfNights: leagueNights.length > 0 ? Math.round((leagueNights.filter(n => n.bowled).length / leagueNights.length) * 100) : null,
      longestStreak: streaks.longest,
      currentStreak: streaks.current,
    },
    weeks,
    nights: weeks.length,
    games,
    pins,
    average,
    startingAvg: first?.incomingAvg ?? null,
    endingAvg: last?.incomingAvg ?? null,
    startingHcp: first?.incomingHcp ?? null,
    endingHcp: last?.incomingHcp ?? null,
    turkeys,
    turkeyNights: weeks.filter(w => (w.turkeys ?? 0) > 0).length,
    bestNight,
    highGame,
    bigSwing: rankSwing(findBigSwing(weeks), (recordsets[16] ?? []) as Array<{ game1: number | null; game2: number | null; game3: number | null }>),
    ranks: {
      pins: rankWithin(league, 'pins', bowlerID),
      // Average is the one rank where a two-night sub would distort the field,
      // so it uses the same minimum-games line as the season leaderboards.
      average: rankWithin(league.filter(r => r.games >= minGames), 'average', bowlerID),
      turkeys: rankWithin(league, 'turkeys', bowlerID),
      highGame: rankWithin(league, 'highGame', bowlerID),
    },
    ownSeasons: rankOwnSeasons(seasons, seasonID),
    seasons,
    team,
    teammates,
    patches,
    milestones,
  };
}

/**
 * The disk cache holds the raw recordsets, not the assembled view, so a change
 * to assembleWrapped takes effect without a SQL edit or a cache bump.
 */
/** League-wide context for one season, shared by every bowler's recap. */
export const getWrappedSeasonContext = cache(async (seasonID: number): Promise<unknown[][]> => {
  return cachedQuery<unknown[][]>(`getWrappedSeasonContext-${seasonID}`, async () => {
    const db = await getDb();
    const result = await db.request().input('seasonID', seasonID).query(BOWLER_WRAPPED_SEASON_SQL);
    return result.recordsets as unknown[][];
  }, [], { sql: BOWLER_WRAPPED_SEASON_SQL, seasonID, dependsOn: ['scores'] });
});

export const getBowlerWrapped = cache(async (bowlerID: number, seasonID: number): Promise<BowlerWrapped | null> => {
  const [bowlerSets, seasonSets] = await Promise.all([
    cachedQuery<unknown[][]>(`getBowlerWrapped-${bowlerID}-${seasonID}`, async () => {
      const db = await getDb();
      const result = await db.request()
        .input('bowlerID', bowlerID)
        .input('seasonID', seasonID)
        .query(BOWLER_WRAPPED_BOWLER_SQL);
      return result.recordsets as unknown[][];
    }, [], { sql: BOWLER_WRAPPED_BOWLER_SQL, bowlerID }),
    getWrappedSeasonContext(seasonID),
  ]);
  return assembleWrapped(mergeRecordsets(bowlerSets, seasonSets));
});
