# Canonical website intelligence

The existing publisher now runs `Write-MMTVIntelligence` after its race/broadcast/profile updates and before staging Git changes. Both existing schedules use this same entry point. No Bridge rebuild, new scheduled publisher or browser connection to the Bridge is required.

`Export-Intelligence.ps1` reads functions from the installed, checksum-checked 131DC adapter without executing the Bridge. It validates published event coverage, settling time and source hashes, then feeds a derived in-memory payload to `build-intelligence.mjs` using the existing Node runtime. It never writes canonical or live-staging data. Pending unpublished records cannot inflate public totals; invalid published records block publication.

Static outputs: `news/data/intelligence/{index,drivers,races,venues,championships}.json`. Keys are serialized deterministically; unchanged output retains its generation timestamp and produces no Git change. The manifest includes file hashes, IDs, source coverage and the adapter hash. The browser checks the manifest and falls back to existing published results if the export is unavailable or inconsistent.

Final-Feature classifications and verified IDs come from the canonical adapter. One subsession counts once in final-Feature metrics. Bomber opening twins, including native sessions labelled CONSOLATION, remain separate sessions and points breakdowns. Qualifying/heat/consolation rows are included only when present in official results or valid native completed classifications. Native snapshot starts, lap-led counters, best laps and points are not promoted to verified values.

Six existing events have no canonical series/round metadata. Their already-published metadata is joined by exact subsession ID, with source fields and hashes recorded. The existing website competition policy, venue resolver and scoring function are reused. No car-type/date guess is used to identify a championship. Canonical files are not backfilled.

Starts mean classified final-Feature appearances; explicit DNS is excluded. Missing appearances are never added. Appearance streaks concern recorded starts, not a claim that the driver won a round they missed. Source coverage accompanies incomplete statistics. Saved per-session points and rule-derived provisional points remain separate; drops, penalties and scoring rules are unchanged. Championship totals stay provisional before drops.

Venue lap records and personal bests require a known configuration and a single compatible vehicle group; other records remain unknown. The existing explicit venue aliases are retained. Driver profiles/roster default to a named competition; cross-season summaries require selecting All recorded seasons. Shared-event comparisons use the same final-Feature event key and shared calculation module as the export.

Run `node news/scripts/check-canonical-intelligence.mjs` with the existing website regression scripts. Local test repositories can be selected with the publisher's `-RepositoryUrl`; they use an isolated mutex. Production retains the original mutex, URL and schedule switches. Public exports contain derived whitelisted fields only, never local paths, credentials, raw SDK captures or driver biographies/photos copied from telemetry.

## Validated field recovery (2026-11-03)

The publisher entry point and its allowlist are unchanged. Export-Intelligence.ps1 still reads only adapter functions; the staged build calls recover-session-fields.mjs read-only against canonical-linked, SHA256-verified live-staging captures. Original event/meeting JSON and official classifications remain untouched. All 29 existing events receive a derived overlay; the same exporter runs automatically for future completed races.

Each supplemented field carries its exact driver ID/car, subsession/session, source, certainty, capture checksum(s) and checks. Reject wrong league/session/car/identity, retained data, explicit replay contexts, mismatched current native clocks/state, unstable or changed native classifications. Native final completion must match the completed session. Earlier sessions require their own current-session evidence; later Feature telemetry is never borrowed for a heat or qualifying. Bounded sampling examines recent 32 and 40 evenly spaced references per session; absence of accepted evidence remains unknown, not proof that no evidence ever existed.

Two independent matching observations are preferred. One matched SDK snapshot is accepted only after its native classification is unchanged for 30 seconds and at least five observations, and is labelled completed_telemetry_single_snapshot (not official). Undetermined live/replay context remains explicitly disclosed; clocks alone are not claimed to prove live capture. Best laps require completed native/SDK lap counts and matching raw best. Starts require a unique complete grid, no SDK override and an EOL exemption, or the existing exact-ID confirmed post-EOL published grid. Confirmed EOL starts take precedence. Gains are calculated from verified starts and native finishes.

Laps led require the active integrity guard, exact native race distance and legal per-driver and whole-field totals. Raw cumulative counters are never promoted. Supplied incidents/points require genuine native result fields; offTracks are not incidents. Existing calculated scoring remains provisional before drops. No qualifying value is inferred from a Feature driver qualifyingLap.

The UI fills null values only, keeps classifications and driver links, marks additions with a dagger, and exposes field-level source details. Existing non-null published values remain visible without being promoted into trusted season statistics merely because they were published. Unknowns display as —.
