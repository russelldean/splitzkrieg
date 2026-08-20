# Lineup Reminder Automation and Derived Pre-Night Board

**Date:** 2026-08-20
**Status:** Approved, ready for implementation planning

## Goal

Automate the captain lineup emails on a Friday and match-day schedule, and replace the
last hand-ticked checklist on `/evillair` with a derived board, in the same style as the
post-night `WeekStatusBoard` that shipped 2026-08-19.

Russ approved enabling the automation now that the split weeks are behind us: weeks 1
through 3 each had two match dates, weeks 4 through 9 have one. Week 4 is Monday
2026-08-24.

## Background: two real bugs

Both live in `src/app/api/cron/lineup-reminder/route.ts`, which has never been scheduled
(`vercel.json` has `"crons": []`).

### 1. A match-day run can never send

The route computes days to the match in floating point milliseconds and bails on
`daysUntilMatch < 0`. `matchDate` is stored at midnight, so a 10am match-day run computes
about `-0.58` and returns `"skipping"`. A Monday reminder would report success in the
Vercel log and mail nobody. This is the failure mode that motivates recording sends.

### 2. The recipient query has no week filter

The query selects from `schedule WHERE seasonID = @seasonID` with no `AND sch.week =
@week`, so it returns every team in the season minus those who submitted for the target
week. It is accidentally correct while all 20 teams bowl every week, but it would have
mailed both nights' captains during split weeks 1 through 3, and it will misfire on any
bye or playoff structure.

## Decisions

| Question | Decision |
| --- | --- |
| Schedule | Friday 10am ET first ask, match-day 10am ET last call |
| Copy | Distinct. The last call says scoresheets print this afternoon |
| Recipients | Only captains who have not submitted, both passes |
| Scope | Cron fix plus send recording plus derived pre-night board |
| Duplicate sends | Skip a pass if one was recorded for that week and pass in the last 12 hours |
| Manual override | `lineupAutomation` flag in `leagueSettings`, togglable from the admin page |

## Architecture

```
src/lib/admin/reminder-window.ts       shouldSend (pure, no I/O)
src/lib/admin/reminder-window.test.ts
src/lib/admin/lineup-reminders.ts      shared recipient query + email copy
src/lib/admin/pre-night-status.ts      derivePreNightStatus (pure, no I/O)
src/lib/admin/pre-night-status.test.ts
src/app/api/evillair/pre-night-status/route.ts
src/components/admin/PreNightStatusBoard.tsx
```

`cron/lineup-reminder/route.ts` and `evillair/remind-captains/route.ts` currently
duplicate the same recipient query and the same email HTML. Both collapse onto
`lineup-reminders.ts`. The missing week filter is fixed once, there.

Pure decision logic lives apart from I/O so it can be unit tested without a database or
an email provider, matching how `week-status.ts` is structured.

### shouldSend contract

```ts
shouldSend(input: {
  nowET: string;          // 'YYYY-MM-DD' in America/New_York
  matchDate: string;      // 'YYYY-MM-DD'
  lastSentAt: string | null;  // ISO, for THIS week and pass
  nowISO: string;         // for the 12 hour dedupe comparison
  enabled: boolean;
}): { send: boolean; pass: 'reminder' | 'lastcall'; reason: string }
```

The window is measured in **ET calendar days**, not elapsed milliseconds. This is what
fixes bug 1, and it is immune to DST because it never subtracts wall-clock times.

| daysUntil | Result |
| --- | --- |
| 5 or more | skip, too early |
| 1 to 4 | send, pass `reminder` |
| 0 | send, pass `lastcall` |
| negative | skip, match already played (guards a stale `publishedWeek`) |

`send` is also false when `enabled` is false, or when `lastSentAt` is under 12 hours old.

The pass is derived from `daysUntil`, **not** from which cron fired. The copy therefore
always matches real urgency, a holiday shift cannot produce a last call three days early,
and Vercel needs no query-string support in the cron path.

### Recording

The MERGE pattern is copied from `src/app/api/evillair/email/route.ts:195`, which already
records `emailSent-s{seasonID}-w{week}` and is read back by the post-night board.

| Key | Written by |
| --- | --- |
| `remindSent-s36-w4-reminder` | cron and manual remind route |
| `remindSent-s36-w4-lastcall` | cron and manual remind route |
| `lpPushed-s36-w4` | `evillair/lineups/push/route.ts` |
| `scoresheets-s36-w4` | `evillair/scoresheets/route.ts` |
| `lineupAutomation` | admin toggle, value `on` or `off` |

Longest key is 28 characters, within `leagueSettings.settingKey` at `varchar(50)`.

The manual remind button records under the same key as the cron, choosing its pass the
same way, from `daysUntil` at the moment it is pressed. That is what makes a manual send
suppress the scheduled one: a click on Friday morning writes the `reminder` key, so the
10am cron finds it under 12 hours old and stands down. It does not suppress the match-day
last call, which is a different key.

### The board

`derivePreNightStatus` returns the same `StepState` union the post-night board uses:
`done`, `pending`, `attention`, `optional`, `unknown`.

```
PRE-BOWLING NIGHT · Week 4
-----------------------------------------
Lineups in       18/20          attention
Friday reminder  sent Fri 10:00      done
Last call        not yet needed   pending
LP push          not recorded     pending
Scoresheets      not recorded     pending
```

| Row | Source | done | attention |
| --- | --- | --- | --- |
| Lineups in | `lineupSubmissions` count vs teams scheduled that week | all in | match day and any missing |
| Friday reminder | `remindSent-...-reminder` | recorded | none |
| Last call | `remindSent-...-lastcall` | recorded | match day, missing lineups, not sent |
| LP push | `lpPushed-...` | recorded | match day and not pushed |
| Scoresheets | `scoresheets-...` | recorded | match day and not generated |

Lineups in is the only genuinely derived row; it reads real submissions. The other four
are recorded by the action that performs them, never by a human tick. When
`lineupAutomation` is off, the board says so on the reminder rows rather than showing
them as merely pending.

### Deletions

Removing the pre-night ticks removes the last consumer of the tick machinery. All of this
goes:

- `PRE_NIGHT_STEPS` and the `Pipeline` component in `src/app/evillair/(dashboard)/page.tsx`
  (`Pipeline` is used at line 319 only; the other `Pipeline` matches in the codebase are
  an unrelated local in the scores page and prose on the specs page)
- `toggleStep` and the `preNightDone` state
- The `preNightDone-w{N}` read and write in `src/app/api/evillair/dashboard/route.ts`

The post-night equivalents were already deleted in `812995f`.

### Schedules

```json
"crons": [
  { "path": "/api/cron/lineup-reminder", "schedule": "0 14 * * 5" },
  { "path": "/api/cron/lineup-reminder", "schedule": "0 14 * * 1" }
]
```

Vercel Pro allows 40 crons at minute precision, so two is not a constraint.

**Known DST wrinkle:** Vercel crons are UTC only. `14:00 UTC` is 10am EDT, correct for
weeks 4 through 8. DST ends 2026-11-01 and week 9 falls on Monday 2026-11-02, so that one
send lands at 9am ET. Accepted, not worth a second schedule.

## Testing

`reminder-window.test.ts` covers the window table above, explicitly including the match-day
case that is broken today, a stale `publishedWeek` pointing at a played week, the 12 hour
dedupe boundary, and the disabled flag.

`pre-night-status.test.ts` covers each row's done, pending and attention transitions,
including the match-day escalation and the automation-off wording.

The email send itself is not unit tested. Neither is the cron route wiring, which stays
thin enough to read.

## Rollout

Ship with `lineupAutomation` set to `off`. Hit the endpoint once by hand with the cron
secret, confirm it names the right teams and the right pass, then turn it on. The first
automated mail to 20 captains should not also be the first execution of the code.

No SQL in `src/lib/queries/` changes, so no `cachedQuery` hash moves and no cache busts.

## Out of scope

- Enabling any other dormant cron
- Changing who the captains are or how `captainBowlerID` is set
- Playoff weeks. After week 9 `publishedWeek + 1` finds no schedule row and the guard
  skips, which is the correct behaviour and needs no special case.
- Rewriting the manual remind UI beyond pointing it at the shared module

## Risks

| Risk | Mitigation |
| --- | --- |
| Mails 20 real captains on a wrong week | Calendar-day window plus off-by-default rollout |
| Duplicate mail after a manual send | 12 hour dedupe on the shared recording key |
| Cron silently skips again | Every send recorded and surfaced on the board |
| Captain has no email | Already counted as `skipped`; surface the count on the board row |
