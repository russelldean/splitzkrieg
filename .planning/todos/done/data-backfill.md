# Data Backfill Tasks

## Schedule and Date Data
- Backfill missing schedule/matchDate data for older seasons (I-XXV)
- Currently only Seasons XXVI-XXXV have schedule data loaded
- Needed for: weekly results pages, date display on records

## Division Data
- `seasonDivisions` table needs population (schema supports it, standings code handles it)
- Enables division-grouped standings display

## Historical Team Names
- `teamNameHistory` already populated (652 rows, 41 franchises)
- May need updates as older season data is reviewed
