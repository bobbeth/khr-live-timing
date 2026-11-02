# Front-page race schedule

`schedule.json` supplies Up Next. Tracks and weekly round dates come from the existing Fall Fest configuration; update explicit dates for postponements or venue changes. Completed series/rounds are removed from Up Next using the published race indexes.

The owner confirmed these broadcast starts on 2 November 2026:

| Hobart race day | US Eastern start | Current Hobart start |
| --- | --- | --- |
| Monday, Bomber Stocks | Sunday 7:30 pm EST | Monday 11:30 am AEDT |
| Monday, Cushion Kings | Sunday 8:45 pm EST | Monday 12:45 pm AEDT |
| Tuesday, Mini Menaces | Monday 7:30 pm EST | Tuesday 11:30 am AEDT |
| Tuesday, Yota Outlawz | Monday 8:35 pm EST | Tuesday 12:35 pm AEDT |
| Wednesday, Wide Open Revival | Tuesday 7:45 pm EST | Wednesday 11:45 am AEDT |

Upcoming starts in this season are saved as ISO timestamps with the confirmed EST offset (-05:00). The website formats each instant using `America/New_York` and `Australia/Hobart`, displaying both calendar dates and timezone abbreviations. Historical races before the confirmation date have no invented start time. Check daylight-saving offsets when adding a future season.

The countdown uses the first remaining start. A date-only entry shows no countdown. The channel button opens the established BobbethTV stream list; no upcoming YouTube video ID is assumed. Front-page broadcast dates are race dates, not inferred upload dates.

Other front-page sections read the existing article, broadcast, race, standings and driver-profile data. The spotlight rotates daily among supplied profiles with photos. The last-round summary uses the highest published round, while the closest championship gap uses current provisional standings.

Checks: `node news/scripts/check-newsroom.mjs` and `node news/scripts/check-stats.mjs`.
