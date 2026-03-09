-- Create the patches catalog and bowlerPatches tables
-- Run once against Azure SQL to set up the schema

-- Catalog of all possible patch types
CREATE TABLE patches (
  patchID     INT IDENTITY(1,1) PRIMARY KEY,
  code        VARCHAR(20) NOT NULL UNIQUE,    -- 'botw', 'highGame', etc.
  name        NVARCHAR(50) NOT NULL,
  description NVARCHAR(200) NULL
);

-- Which bowlers earned which patches, and when
CREATE TABLE bowlerPatches (
  bowlerPatchID INT IDENTITY(1,1) PRIMARY KEY,
  bowlerID      INT NOT NULL,
  patchID       INT NOT NULL,
  seasonID      INT NULL,       -- NULL for career-level patches
  week          INT NULL,       -- NULL for season/career-level patches
  CONSTRAINT FK_bowlerPatches_bowler FOREIGN KEY (bowlerID) REFERENCES bowlers(bowlerID),
  CONSTRAINT FK_bowlerPatches_patch  FOREIGN KEY (patchID)  REFERENCES patches(patchID),
  CONSTRAINT UQ_bowlerPatches UNIQUE (bowlerID, patchID, seasonID, week)
);

-- Index for fast per-bowler lookups at build time
CREATE NONCLUSTERED INDEX IX_bowlerPatches_bowlerID ON bowlerPatches (bowlerID)
  INCLUDE (patchID, seasonID, week);

-- Seed the patch catalog
INSERT INTO patches (code, name, description) VALUES
  ('botw',           'Bowler of the Week',         'Highest handicap series that week'),
  ('highGame',       'Weekly High Game',            'Highest single game that week'),
  ('highSeries',     'Weekly High Series',          'Highest scratch series that week'),
  ('threeOfAKind',   'Three of a Kind',             'All 3 games identical'),
  ('playoff',        'Team Playoff',                'Team made the playoffs'),
  ('champion',       'Champion',                    'Team won the championship'),
  ('scratchPlayoff', 'Scratch Playoff',             'Top 8 men/women by scratch avg (18+ games)'),
  ('hcpPlayoff',     'Handicap Playoff',            'Top 8 by handicap avg (18+ games, excl. scratch qualifiers)'),
  ('scratchChampion','Scratch Champion',             'Won the scratch playoff'),
  ('hcpChampion',    'Handicap Champion',            'Won the handicap playoff'),
  ('captain',        'Team Captain',                 'Current team captain');
