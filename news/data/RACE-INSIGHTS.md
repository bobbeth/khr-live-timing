# Driver comparisons and season records

`#compare` and `#records` use the published results already loaded by the shared driver statistics service. Newly published races appear on the next page load. No points reconciliation, drop rules, scheduled jobs or Bridge changes are involved.

Comparisons default to shared final features, matched by subsession ID. Selecting All appearances changes the side-by-side statistics, but the finished-ahead score always uses shared final features only. DNS entries are excluded. A driver appearing in the same round number in a different meeting is not a shared race. Equal finishes are counted separately as ties.

Feature starts, wins, podiums, top-five finishes, average finish and net position gains use the final feature only. Opening twins do not add extra final-feature wins or starts. Average starts and position gains show their known-data coverage. Missing values are not filled with zero. The record book requires at least three final-feature starts for best average finish; comparisons do not impose that threshold because their sample counts are visible.

Heat wins use available heat classifications, deduplicated by session and driver. A driver can have heat wins without a final-feature start. Quickest-feature-lap records count features in which the driver's recorded best lap equals the lowest available positive lap time; ties count for both drivers. These are counts, not comparisons of raw lap times at different tracks. Laps-led totals are partial when the archive lacks figures, and each driver's coverage is shown.

Largest climbs preserve the archive's recorded position-gain values. Track winners link each final-feature winner to the corresponding race report, using the archive's track names. Leaderboards show ten places plus any tied entries at the cutoff, with equal values sharing a rank. Displayed averages are rounded; ranking uses the underlying averages.

Run `node news/scripts/check-race-insights.mjs` for calculation edge cases and `node news/scripts/check-stats.mjs` for integration with all published races and profiles.
