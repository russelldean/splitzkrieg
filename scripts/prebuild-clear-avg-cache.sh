#!/bin/bash
# One-time prebuild: clear ALL cached SQL queries after 110 avg blip fixes.
# 86 bowlers, 26 seasons, match results recalculated -- too many to be surgical.
# Remove this script and revert the build command after the first successful deploy.

CACHE_DIR=".next/cache/sql"
if [ ! -d "$CACHE_DIR" ]; then
  echo "prebuild-clear-avg-cache: no cache dir, skipping"
  exit 0
fi

echo "prebuild-clear-avg-cache: clearing entire SQL cache (110 avg fixes, 26 seasons)..."
count=$(find "$CACHE_DIR" -name "*.json" | wc -l | tr -d ' ')
rm -rf "$CACHE_DIR"/*
echo "prebuild-clear-avg-cache: cleared $count cached query files"
