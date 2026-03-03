# Data Backfill Tasks

## Historical Team Names Per Season
- Add `teamNameOverride` column to `teamRosters` table (the name the team used that season)
- Backfill from franchise map data (17 lineages, ~29 alternate names)
- Update season stats query to use `teamRosters.teamNameOverride` when available, falling back to `teams.teamName`
- Lets bowlers see the team name as it was known when they played (e.g., "Hamboners" instead of "Smoke-a-Bowl")

## High Game / High Series Dates on Profile
- Once matchDate data is backfilled, show the date of career high game and high series in Personal Records
- Requires joining scores → schedule to find when the high was set
- Display as small subtext under the value (e.g., "267" with "Mar 12, 2019" below)

## Schedule and Date Data
- Backfill missing schedule/matchDate data for older seasons
- Currently only Seasons XXVI-XXXV have schedule data loaded
- Needed for: firstMatchDate accuracy on bowler profiles, future season pages (Phase 4)
