# Standings and driver profiles

The standings and roster are generated in the browser from the archive index, live index, meeting sessions and final feature results. New races added by the manual publisher appear automatically on the next page load. There is no new scheduled job or Bridge dependency.

Current policy, confirmed by the owner: add points as they stand; no drops before the end of Round 8. The website does not currently apply drops, penalties, manual championship adjustments or league tie-breaks. Tables remain provisional until reconciled with league leaderboards. Equal totals share a position.

For each scoring session, use its saved `champ_points` when present (including zero). Otherwise calculate points from the existing scoring functions in the 131DB championship deployment. Calculated totals carry an asterisk, and profiles expose each race's session breakdown. Practice and warmup do not score. Bomber opening twins score as a feature; other consolation races use the standard consolation table. Do not add a second copy of final-feature points from the event record when a final-feature session is already present.

Fallback scoring:

| Session | Bomber Stocks | Other four series |
| --- | --- | --- |
| Qualifying | P1–10: 10 down to 1 | P1–6: 6 down to 1; P7–10: 1 |
| Heat | P1–8: 8 down to 1; P9–20: 1 | P1–5: 8 down to 4; P6–10: 2; P11–20: 1 |
| Consi / opening twin | P1–20: 20 down to 1; P21–30: 1 | P1–10: 11 down to 2; P11–15: 1 |
| Final feature | P1–20: 20 down to 1; P21–30: 1 | P1–43: 43 down to 1 |

All other positive positions score zero. Invalid/missing positions remain unknown. Missing files and explicitly unavailable sessions are flagged rather than presented as complete standings.

Wins, podiums, starts and average finish use the final feature only. They exclude DNS and do not count heat or opening-twin wins as final-feature victories. Drivers with only preliminary results can appear in the roster with zero final-feature starts.

Names use whitespace/case normalization and a small explicit alias list in `assets/stats.js`. Numeric iRacing suffixes are not stripped globally. Confirm ambiguous identities before adding an alias, then rerun the checks. No personal biographies, photos, nationality or teams are invented.

Run `node news/scripts/check-stats.mjs` from the repository root to verify scoring boundaries, saved points, aliases, all profiles and races, search, links and fetch failures.
