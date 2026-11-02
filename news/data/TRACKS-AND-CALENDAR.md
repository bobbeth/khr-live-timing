# Track directory and season calendar

Routes: `#calendar`, `#tracks`, `#track/<venue-id>` and the alternate `#track-name/<encoded archive name>` used by race-report links. Up Next links to both the full calendar and the scheduled venue. Calendar and track pages link back to race reports and the existing broadcast library.

`tracks.json` contains explicit aliases for venue names used in published races and the schedule. No fuzzy matching is used. Unknown archived names get a separate fallback page rather than being merged speculatively. Kern Dirt remains separate from Kevin Harvick's Kern Raceway. Venue pages may cover different configurations, surfaces or cars; individual meeting labels are retained and raw lap times are not pooled into venue records.

The calendar joins `schedule.json` to race indexes by competition, series and round. A published report establishes completion; a passed date alone does not. Unpublished past starts are marked Awaiting results. Additional published meetings absent from the schedule are retained. When the published track differs from the scheduled track, the actual result's venue is used and the calendar explains the original listing. Report dates and Hobart season dates are kept distinct where they differ.

Current audit: 55 calendar meetings, 27 published results and 28 venues. Yota Outlawz Round 3 was scheduled at USA International in the existing configuration but the published result places it at Concord. The original schedule remains available in the row; no historical result is rewritten.

Upcoming starts use the previously owner-confirmed US Eastern times and display both Eastern and Hobart dates/times. Historical starts without timestamps remain unknown. The calendar export includes only future scheduled entries with a known start, uses UTC `DTSTART`, and supplies no invented `DTEND` or duration. The export follows the selected season, series, round and search filters.

Update explicit schedule dates/tracks for league changes and keep each `track_id` aligned with `tracks.json` so Up Next links correctly. Changes to aliases do not rewrite raw result files. Winning-driver counts use final-feature results, respecting existing driver aliases and excluding DNS. Shared broadcasts are listed once per track, even if they cover two series.

Checks: `node news/scripts/check-venues.mjs` and `node news/scripts/check-stats.mjs`.
