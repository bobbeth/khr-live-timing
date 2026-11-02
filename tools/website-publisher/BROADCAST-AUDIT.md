# Older broadcast audit — 3 November 2026

All 25 previously schedule-inferred links across the 15 Round 1–5 recordings have now been checked. No video IDs or saved race-start bookmarks changed. Round 6's two existing metadata matches remain unchanged.

23 links are supported by the BobbethTV channel ID, completed-livestream status, release date in Hobart, configured championship/round date, and the championship and venue named in the source description. Some older reports use the UTC start date while others use the Hobart date; the original report dates have not been rewritten.

Two descriptions contained venue conflicts. Both were resolved by inspecting the recording's on-screen feature classification and comparing its podium to the saved race results:

| Race | Recording | Finding |
| --- | --- | --- |
| Wide Open Revival R4, 89519810 | [FPb8AQdoQsU](https://www.youtube.com/watch?v=FPb8AQdoQsU) | At 1:38:23 the overlay identifies Volusia Speedway Park and shows Chad Puterbaugh, Brian Angell and Mikey Mixter. The description incorrectly lists Weedsport. |
| Mini Menaces R5, 89668025 | [opn8pRjNeBo](https://www.youtube.com/watch?v=opn8pRjNeBo) | At 1:54:03 the overlay identifies Millbridge Speedway and shows Tom Land, Chad Puterbaugh and Kent McClain. The description incorrectly lists Kern Raceway. |

These observation times are evidence samples, not race-start bookmarks. The existing 1:16:00 Cushion Kings R1 bookmark is retained; its exact starting moment was not re-audited. No new offsets were added.

The compact source snapshots, individual match evidence, original matching provenance and footage observations are in `news/data/broadcast-audit.json`. This is metadata checking plus the two targeted footage checks, not a claim to have watched all 15 recordings end to end. The website shows the two description conflicts on their broadcast pages.

Offline checks: `news/scripts/check-broadcast-audit.mjs` and `news/scripts/check-broadcast-library.mjs`.
