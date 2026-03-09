# SQL Hash Cache Migration Prompt

Give this to Claude after clearing context:

---

Migrate all `cachedQuery()` calls to use the new SQL hash auto-invalidation pattern.

## What was done
In `src/lib/db.ts`, `cachedQuery()` now accepts `options.sql` — it hashes the SQL string and includes it in the cache key. This way, when a query's SQL changes, it auto-invalidates (cache miss) without needing to bump `DB_CACHE_VERSION`. See `getBowlerSeasonStats` in `src/lib/queries/bowlers.ts` for the completed pattern.

## The pattern
Before:
```ts
export async function getSomething(id: number) {
  return cachedQuery(`getSomething-${id}`, async () => {
    const db = await getDb();
    const result = await db.request().input('id', id).query(`SELECT ... FROM ...`);
    return result.recordset;
  }, []);
}
```

After:
```ts
const GET_SOMETHING_SQL = `SELECT ... FROM ...`;

export async function getSomething(id: number) {
  return cachedQuery(`getSomething-${id}`, async () => {
    const db = await getDb();
    const result = await db.request().input('id', id).query(GET_SOMETHING_SQL);
    return result.recordset;
  }, [], { sql: GET_SOMETHING_SQL });
}
```

## Files to migrate
All query files in `src/lib/queries/`:
- `bowlers.ts` (partially done — `getBowlerSeasonStats` is done, others need migration)
- `seasons.ts`
- `teams.ts`
- `home.ts`
- Any other files in that directory

## Rules
- Extract inline SQL template literals into named constants above the function
- Pass the SQL const to both `.query()` and `cachedQuery()` options
- Keep the `stable` option where it already exists (some queries use `{ stable: true }`)
- Don't change any SQL logic, just move it to a const
- Type-check with `npx tsc --noEmit` when done
- Commit and push when complete
