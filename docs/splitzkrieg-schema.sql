-- ============================================================================
-- Splitzkrieg Bowling League — Database Schema
-- Target: Azure SQL Database (General Purpose - Serverless)
-- Version: 2.0 — Updated March 2026 (post-migration, post-cleanup)
-- ============================================================================

-- ============================================================================
-- CORE REFERENCE TABLES
-- ============================================================================

-- Seasons: one row per league season (35 seasons since 2007)
CREATE TABLE seasons (
    seasonID        INT IDENTITY(1,1) PRIMARY KEY,
    romanNumeral    VARCHAR(10) NOT NULL UNIQUE,     -- 'I', 'II', ... 'XXXV'
    displayName     VARCHAR(50),                      -- 'Fall 2025', 'Spring 2019'
    period          VARCHAR(10) NOT NULL,              -- 'Spring' or 'Fall'
    year            INT NOT NULL,
    seasonNumber    INT NOT NULL,                      -- 1=Spring, 2=Fall
    teamCount       INT,                               -- 10, 18, or 20
    divisionCount   INT DEFAULT 2,                     -- 1 or 2
    weekCount       INT,                               -- 9, 10, 17, etc.
    notes           VARCHAR(255),                      -- 'DNF' for COVID, 'League founding', etc.
    isCurrentSeason BIT DEFAULT 0
);

-- Bowlers: one row per unique person ever to bowl in the league
CREATE TABLE bowlers (
    bowlerID        INT IDENTITY(1,1) PRIMARY KEY,
    bowlerName      VARCHAR(100) NOT NULL,             -- Canonical/current name
    slug            VARCHAR(100) NOT NULL UNIQUE,      -- URL-friendly: 'russ-smith'
    gender          CHAR(1),                            -- M, F, X
    isActive        BIT DEFAULT 1,                      -- Bowled in last 3 seasons
    isPublic        BIT DEFAULT 1,                      -- Privacy opt-out (default: visible)
    notes           VARCHAR(255),
    establishedAvg  DECIMAL(5,1)                        -- Pre-populated average for returning bowlers
);

-- Map all historical name variants to a single bowlerID
CREATE TABLE bowlerNameHistory (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    bowlerID        INT NOT NULL REFERENCES bowlers(bowlerID),
    alternateName   VARCHAR(100) NOT NULL,
    CONSTRAINT UQ_AlternateName UNIQUE(alternateName)
);

-- Teams: one row per unique team identity (franchise)
CREATE TABLE teams (
    teamID          INT IDENTITY(1,1) PRIMARY KEY,
    teamName        VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE        -- URL-friendly: 'gutter-ballers'
);

-- Map all historical team name variants to a single teamID
CREATE TABLE teamNameHistory (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    teamID          INT NOT NULL REFERENCES teams(teamID),
    alternateName   VARCHAR(100) NOT NULL,
    CONSTRAINT UQ_TeamAlternateName UNIQUE(alternateName)
);

-- ============================================================================
-- SEASON STRUCTURE TABLES
-- ============================================================================

-- Which division each team is in for each season
CREATE TABLE seasonDivisions (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    seasonID        INT NOT NULL REFERENCES seasons(seasonID),
    teamID          INT NOT NULL REFERENCES teams(teamID),
    divisionName    VARCHAR(50) NOT NULL,
    CONSTRAINT UQ_SeasonTeamDivision UNIQUE(seasonID, teamID)
);

-- Which bowlers are on which teams each season
CREATE TABLE teamRosters (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    teamID          INT NOT NULL REFERENCES teams(teamID),
    bowlerID        INT NOT NULL REFERENCES bowlers(bowlerID),
    seasonID        INT NOT NULL REFERENCES seasons(seasonID),
    gamesWithTeam   INT DEFAULT 0
);

-- Weekly schedule / matchups
CREATE TABLE schedule (
    scheduleID      INT IDENTITY(1,1) PRIMARY KEY,
    seasonID        INT NOT NULL REFERENCES seasons(seasonID),
    week            INT NOT NULL,
    matchNumber     INT,
    team1ID         INT REFERENCES teams(teamID),
    team2ID         INT REFERENCES teams(teamID),
    division        VARCHAR(50),
    matchDate       DATE
);

-- ============================================================================
-- SCORING DATA — THE CORE FACT TABLE
-- ============================================================================

-- One row per bowler per week — the atomic unit of league data
-- 6 computed columns handle all derived scoring calculations
CREATE TABLE scores (
    scoreID         INT IDENTITY(1,1) PRIMARY KEY,
    bowlerID        INT NOT NULL REFERENCES bowlers(bowlerID),
    seasonID        INT NOT NULL REFERENCES seasons(seasonID),
    teamID          INT REFERENCES teams(teamID),
    week            INT NOT NULL,
    game1           INT,
    game2           INT,
    game3           INT,
    incomingAvg     DECIMAL(5,1),
    turkeys         INT DEFAULT 0,
    isPenalty       BIT NOT NULL DEFAULT 0,             -- Flag for penalty/forfeit rows

    -- COMPUTED COLUMNS (not stored, calculated on read)

    -- Scratch series: simple sum of three games
    scratchSeries   AS ([game1] + [game2] + [game3]),

    -- Incoming handicap: FLOOR((225 - avg) * 0.95), NULL when no average
    incomingHcp     AS (CASE
                        WHEN incomingAvg IS NULL THEN NULL
                        ELSE FLOOR((225 - incomingAvg) * 0.95)
                       END),

    -- Handicap game scores: penalty=199, no avg=219, NULL game=199, else game+hcp
    hcpGame1        AS (CASE
                        WHEN isPenalty = 1 THEN 199
                        WHEN incomingAvg IS NULL THEN 219
                        WHEN game1 IS NULL THEN 199
                        ELSE game1 + FLOOR((225 - incomingAvg) * 0.95)
                       END),

    hcpGame2        AS (CASE
                        WHEN isPenalty = 1 THEN 199
                        WHEN incomingAvg IS NULL THEN 219
                        WHEN game2 IS NULL THEN 199
                        ELSE game2 + FLOOR((225 - incomingAvg) * 0.95)
                       END),

    hcpGame3        AS (CASE
                        WHEN isPenalty = 1 THEN 199
                        WHEN incomingAvg IS NULL THEN 219
                        WHEN game3 IS NULL THEN 199
                        ELSE game3 + FLOOR((225 - incomingAvg) * 0.95)
                       END),

    -- Handicap series: sum of the three hcpGame values (repeated CASE logic required by SQL Server)
    handSeries      AS (
                        (CASE WHEN isPenalty = 1 THEN 199
                              WHEN incomingAvg IS NULL THEN 219
                              WHEN game1 IS NULL THEN 199
                              ELSE game1 + FLOOR((225 - incomingAvg) * 0.95) END)
                      + (CASE WHEN isPenalty = 1 THEN 199
                              WHEN incomingAvg IS NULL THEN 219
                              WHEN game2 IS NULL THEN 199
                              ELSE game2 + FLOOR((225 - incomingAvg) * 0.95) END)
                      + (CASE WHEN isPenalty = 1 THEN 199
                              WHEN incomingAvg IS NULL THEN 219
                              WHEN game3 IS NULL THEN 199
                              ELSE game3 + FLOOR((225 - incomingAvg) * 0.95) END)
                       )

    -- NOTE: No unique constraint on bowlerID/seasonID/week — legitimate duplicates exist
    --       (subs bowling for two teams, double-headers, Tino McCullough S2W15)
    -- Non-unique index IX_WeeklyScores_BowlerSeasonWeek provides query performance
);

-- ============================================================================
-- DATA QUALITY TRACKING
-- ============================================================================

-- Logs corrections made to historical data during migration/cleanup
CREATE TABLE correctionLog (
    seasonID        INT NOT NULL,
    week            INT NOT NULL,
    bowlerID        INT NOT NULL,
    originalSeries  INT,
    correctedSeries INT
);

-- ============================================================================
-- MATCH RESULTS & STANDINGS
-- ============================================================================

-- Team vs team results per match per week
CREATE TABLE matchResults (
    resultID        INT IDENTITY(1,1) PRIMARY KEY,
    scheduleID      INT NOT NULL REFERENCES schedule(scheduleID),
    -- Team handicap totals per game
    team1Game1      INT,
    team1Game2      INT,
    team1Game3      INT,
    team1Series     INT,
    team2Game1      INT,
    team2Game2      INT,
    team2Game3      INT,
    team2Series     INT,
    -- Points: game-by-game W/L (2 per win, 1 tie, 0 loss) max 6 from games
    team1GamePts    INT,
    team2GamePts    INT,
    -- Bonus points from weekly series ranking (3/2/1/0 by tier of 5)
    team1BonusPts   INT,
    team2BonusPts   INT
);

-- ============================================================================
-- PLAYOFFS & CHAMPIONSHIPS
-- ============================================================================

-- Playoff match results (team and individual brackets)
CREATE TABLE playoffResults (
    playoffID       INT IDENTITY(1,1) PRIMARY KEY,
    seasonID        INT NOT NULL REFERENCES seasons(seasonID),
    playoffType     VARCHAR(30) NOT NULL,               -- 'Team', 'MaleScratch', 'FemaleScratch', 'Handicap'
    round           VARCHAR(20),                         -- 'Semifinal', 'Final'
    -- For team playoffs
    team1ID         INT REFERENCES teams(teamID),
    team2ID         INT REFERENCES teams(teamID),
    winnerTeamID    INT REFERENCES teams(teamID),
    -- For individual playoffs
    bowler1ID       INT REFERENCES bowlers(bowlerID),
    bowler2ID       INT REFERENCES bowlers(bowlerID),
    winnerBowlerID  INT REFERENCES bowlers(bowlerID),
    notes           VARCHAR(255)
);

-- Denormalized season champions for quick lookups
CREATE TABLE seasonChampions (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    seasonID        INT NOT NULL REFERENCES seasons(seasonID),
    championshipType VARCHAR(30) NOT NULL,              -- 'Team', 'MaleScratch', 'FemaleScratch', 'Handicap'
    winnerTeamID    INT REFERENCES teams(teamID),
    winnerBowlerID  INT REFERENCES bowlers(bowlerID)
);

-- ============================================================================
-- CONTENT & BLOG
-- ============================================================================

-- Blog posts for weekly recaps and announcements
CREATE TABLE blogPosts (
    postID          INT IDENTITY(1,1) PRIMARY KEY,
    seasonID        INT REFERENCES seasons(seasonID),
    week            INT,
    title           VARCHAR(255) NOT NULL,
    slug            VARCHAR(255) NOT NULL UNIQUE,
    content         NVARCHAR(MAX),
    publishedDate   DATETIME2,
    isPublished     BIT DEFAULT 0,
    createdDate     DATETIME2 DEFAULT GETUTCDATE(),
    modifiedDate    DATETIME2 DEFAULT GETUTCDATE()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- scores: most queried table by far
CREATE INDEX IX_WeeklyScores_BowlerID ON scores(bowlerID);
CREATE INDEX IX_WeeklyScores_SeasonID ON scores(seasonID);
CREATE INDEX IX_WeeklyScores_TeamID ON scores(teamID);
CREATE INDEX IX_WeeklyScores_SeasonWeek ON scores(seasonID, week);
CREATE INDEX IX_WeeklyScores_BowlerSeasonWeek ON scores(bowlerID, seasonID, week);

-- Bowler lookups
CREATE INDEX IX_Bowlers_IsActive ON bowlers(isActive);
CREATE INDEX IX_Bowlers_Slug ON bowlers(slug);
CREATE INDEX IX_BowlerNameHistory_BowlerID ON bowlerNameHistory(bowlerID);

-- Team lookups
CREATE INDEX IX_Teams_Slug ON teams(slug);
CREATE INDEX IX_TeamRosters_SeasonID ON teamRosters(seasonID);
CREATE INDEX IX_TeamRosters_BowlerID ON teamRosters(bowlerID);
CREATE INDEX IX_TeamRosters_TeamID ON teamRosters(teamID);

-- Schedule lookups
CREATE INDEX IX_Schedule_SeasonID ON schedule(seasonID);
CREATE INDEX IX_Schedule_SeasonWeek ON schedule(seasonID, week);

-- Season lookups
CREATE INDEX IX_Seasons_RomanNumeral ON seasons(romanNumeral);

-- Blog lookups
CREATE INDEX IX_BlogPosts_SeasonWeek ON blogPosts(seasonID, week);
CREATE INDEX IX_BlogPosts_Published ON blogPosts(isPublished, publishedDate);

-- ============================================================================
-- VIEWS
-- ============================================================================
GO

-- Bowler career summary: the data behind the bowler profile page header
CREATE VIEW vw_BowlerCareerSummary AS
SELECT
    b.bowlerID,
    b.bowlerName,
    b.slug,
    b.gender,
    b.isActive,
    COUNT(s.scoreID)                                    AS totalGamesNights,
    COUNT(s.scoreID) * 3                                AS totalGamesBowled,
    SUM(s.scratchSeries)                                AS totalPins,
    CAST(SUM(s.scratchSeries) * 1.0 /
         NULLIF(COUNT(s.scoreID) * 3, 0) AS DECIMAL(5,1)) AS careerAverage,
    MAX(CASE WHEN s.game1 >= s.game2 AND s.game1 >= s.game3 THEN s.game1
             WHEN s.game2 >= s.game3 THEN s.game2
             ELSE s.game3 END)                          AS highGame,
    MAX(s.scratchSeries)                                AS highSeries,
    SUM(CASE WHEN s.game1 >= 200 THEN 1 ELSE 0 END +
        CASE WHEN s.game2 >= 200 THEN 1 ELSE 0 END +
        CASE WHEN s.game3 >= 200 THEN 1 ELSE 0 END)    AS games200Plus,
    SUM(CASE WHEN s.scratchSeries >= 600 THEN 1 ELSE 0 END) AS series600Plus,
    SUM(ISNULL(s.turkeys, 0))                           AS totalTurkeys,
    MIN(sn.year)                                        AS firstYear,
    MAX(sn.year)                                        AS lastYear,
    COUNT(DISTINCT s.seasonID)                          AS seasonsPlayed
FROM bowlers b
LEFT JOIN scores s ON b.bowlerID = s.bowlerID
LEFT JOIN seasons sn ON s.seasonID = sn.seasonID
GROUP BY b.bowlerID, b.bowlerName, b.slug, b.gender, b.isActive;
GO

-- Season averages per bowler: the season-by-season table on the profile page
CREATE VIEW vw_BowlerSeasonStats AS
SELECT
    sc.bowlerID,
    sc.seasonID,
    sn.romanNumeral,
    sn.displayName,
    sn.year,
    sn.period,
    t.teamName,
    COUNT(sc.scoreID)                                    AS nightsBowled,
    COUNT(sc.scoreID) * 3                                AS gamesBowled,
    SUM(sc.scratchSeries)                                AS totalPins,
    CAST(SUM(sc.scratchSeries) * 1.0 /
         NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1)) AS seasonAverage,
    MAX(CASE WHEN sc.game1 >= sc.game2 AND sc.game1 >= sc.game3 THEN sc.game1
             WHEN sc.game2 >= sc.game3 THEN sc.game2
             ELSE sc.game3 END)                          AS highGame,
    MAX(sc.scratchSeries)                                AS highSeries,
    SUM(CASE WHEN sc.game1 >= 200 THEN 1 ELSE 0 END +
        CASE WHEN sc.game2 >= 200 THEN 1 ELSE 0 END +
        CASE WHEN sc.game3 >= 200 THEN 1 ELSE 0 END)    AS games200Plus,
    SUM(CASE WHEN sc.scratchSeries >= 600 THEN 1 ELSE 0 END) AS series600Plus,
    SUM(ISNULL(sc.turkeys, 0))                           AS turkeys
FROM scores sc
JOIN seasons sn ON sc.seasonID = sn.seasonID
LEFT JOIN teams t ON sc.teamID = t.teamID
GROUP BY sc.bowlerID, sc.seasonID, sn.romanNumeral, sn.displayName,
         sn.year, sn.period, t.teamName;
GO

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- ⚠️  NEEDS UPDATE: References old table name 'WeeklyScores' and PascalCase columns.
--     Will fail at runtime. Kept here for reference; must be rewritten to use
--     'scores' table with camelCase columns before use.

-- Current rolling average (most recent 27 games = 9 nights)
-- This is a function rather than a simple view due to the rolling window logic
CREATE FUNCTION fn_RollingAverage(@BowlerID INT)
RETURNS DECIMAL(5,1)
AS
BEGIN
    DECLARE @avg DECIMAL(5,1);

    SELECT @avg = CAST(SUM(pins) * 1.0 / NULLIF(COUNT(*), 0) AS DECIMAL(5,1))
    FROM (
        SELECT TOP 27 score AS pins
        FROM (
            SELECT s.game1 AS score, s.seasonID, s.week, 1 AS GameNum
            FROM scores s WHERE s.bowlerID = @BowlerID AND s.game1 > 0
            UNION ALL
            SELECT s.game2, s.seasonID, s.week, 2
            FROM scores s WHERE s.bowlerID = @BowlerID AND s.game2 > 0
            UNION ALL
            SELECT s.game3, s.seasonID, s.week, 3
            FROM scores s WHERE s.bowlerID = @BowlerID AND s.game3 > 0
        ) games
        JOIN seasons sn ON games.seasonID = sn.seasonID
        ORDER BY sn.year DESC,
                 CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END DESC,
                 games.week DESC,
                 games.GameNum DESC
    ) recent;

    RETURN @avg;
END;
GO

-- ============================================================================
-- COMPUTED COLUMN LOGIC REFERENCE
-- ============================================================================
-- The scores table uses computed columns for all handicap calculations.
-- This standardizes the 225 base / 95% / FLOOR formula across all 35 seasons,
-- regardless of what was used historically.
--
-- PRIORITY ORDER for hcpGame1/2/3:
--   1. isPenalty = 1          → 199 (flat penalty score)
--   2. incomingAvg IS NULL    → 219 (first-night bowler, no average yet)
--   3. game IS NULL           → 199 (injured/absent for that game, e.g. Denis Webb)
--   4. Normal                 → game + FLOOR((225 - incomingAvg) * 0.95)
--
-- SPECIAL VALUES:
--   Penalty row:      games are NULL, hcpGame1/2/3 = 199 each, handSeries = 597
--   First-nighter:    games are real, hcpGame1/2/3 = 219 each, handSeries = 657
--   Injured bowler:   NULL game(s) get 199, bowled game(s) get normal handicap calc
--
-- scratchSeries = game1 + game2 + game3 (simple sum)
-- incomingHcp = FLOOR((225 - incomingAvg) * 0.95), NULL when no average
-- handSeries = hcpGame1 + hcpGame2 + hcpGame3
-- ============================================================================
