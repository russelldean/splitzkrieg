#!/bin/bash
# One-time prebuild: clear cached queries for bowlers affected by avg corrections.
# Affected bowler IDs: 485 460 195 309 468 51 563 611 238
# Affected season IDs: 13 17
# Remove this script and revert the build command after the first successful deploy.

CACHE_DIR=".next/cache/sql"
if [ ! -d "$CACHE_DIR" ]; then
  echo "prebuild-clear-avg-cache: no cache dir, skipping"
  exit 0
fi

echo "prebuild-clear-avg-cache: clearing affected bowler/season cache files..."
count=0

# Bowler-level queries (keyed by bowlerID)
for id in 485 460 195 309 468 51 563 611 238; do
  for f in "$CACHE_DIR"/v1/*-${id}_*.json "$CACHE_DIR"/stable/*-${id}_*.json; do
    [ -f "$f" ] && rm -v "$f" && count=$((count + 1))
  done
done

# Season-level queries for affected seasons (13 = Spring 2014, 17 = Spring 2016)
for id in 13 17; do
  for f in "$CACHE_DIR"/v1/*-${id}_*.json "$CACHE_DIR"/stable/*-${id}_*.json; do
    [ -f "$f" ] && rm -v "$f" && count=$((count + 1))
  done
done

# Cross-season queries (leaderboard snapshots, weekly highlights, BOTW, directory)
for pattern in LeaderboardSnapshot WeeklyHighlights BowlerOfTheWeek AllBowlersDirectory; do
  for f in "$CACHE_DIR"/v1/*${pattern}*.json "$CACHE_DIR"/stable/*${pattern}*.json; do
    [ -f "$f" ] && rm -v "$f" && count=$((count + 1))
  done
done

echo "prebuild-clear-avg-cache: cleared $count files"
