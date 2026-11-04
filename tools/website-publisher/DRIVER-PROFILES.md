# Driver discovery and profile refresh — staged release

This candidate is based on deployed performance commit 71dcb1baaeed81b5792fa6ff764e0e34d94abec9. It does not change the Bridge, canonical archive, EOL, race classification, scoring or task schedules.

## Existing publishing workflow

After separate release approval, the existing publisher can read two complete responses from http://127.0.0.1:8765/live, two seconds apart. It checks the installed Bridge hash, explicit non-retention, source age (45 seconds), native league 10402, subsession/session identity, replay safeguards, current SDK rows, unique customer ID/car-index/name/number and stable advancing observations. Timed-driver evidence is required. An untimed entrant waits for defensible evidence. Confirmed commentator customer IDs and explicit spectator/observer/AI/pace flags are excluded. SDK flags are not guessed to be spectator flags.

Discovery is disabled if the private settings file is missing, disabled, or lacks confirmed commentator exclusions. No new task or service is installed. When enabled after approval, the existing noninteractive publisher cadence performs discovery. -SkipDriverProfiles overrides it. Existing -CheckDriverProfiles, -CheckBroadcasts and interactive profile refresh still work.

Private settings: F:\Backup\KHR Bot\Driver Profiles\settings.json
Private registry: F:\Backup\KHR Bot\Driver Profiles\state\driver-registry.json
These paths are not created or enabled by preparing this release. Default dry-run state is isolated under the chosen WorkRoot. Physical F: storage is required.

Example settings template (intentionally disabled):
{
  "enabled": false,
  "exclusions_confirmed": false,
  "excluded_customer_ids": [],
  "periodic_seconds": 21600,
  "min_fetch_seconds": 60
}

The registry records verified identities and aliases, first/last observation, session-specific car numbers/teams, two source SHA256 values and private ID/car-index/session proofs. Repeated source ticks update private evidence without a public change. New ID/subsession requests remain queued through profile-service backoff.

## Public output and driver pages

Only news/data/driver-identities.json and news/data/driver-profiles.json are allowed driver data outputs. No raw SDK diagnostic payload, birth date, private note, license or paint data is published. Profiles use the existing documented field allowlist. The public latest_observation object is explicitly observed_only, with source, event/session, car/team, timestamp and source checksums. It never supplies race starts, points, wins or series participation.

Driver-authored profiles are labelled Driver-supplied. Session team information is separate and explicitly applies to that session. A verified newcomer can have a driver page after one series/session; no requirement to enter all five series. Roster-only cards/pages say "Observed in session; no classified result yet." Duplicate names retain separate customer-ID routes. iracing-ID routes remain usable after a driver gains classified results. Existing confirmed routes and aliases remain.

## Profile service failures and removals

The existing public SDK profile service is fetched on a new ID, new subsession, a manual request or a conservative six-hour check after fresh evidence. Timeout is 12 seconds; responses/snapshots are capped at 16 MiB, requests at 64 MiB and the public profile output at 3 MiB. Failures back off from one minute to six hours. A healthy response has unique positive IDs and a nonempty list; a sudden >10% total-count drop is rejected. Invalid responses cannot partially replace existing profiles.

Existing profiles survive outages, partial omissions, invalid/older revisions and conflicting data with the same revision. A newer authoritative updatedAt permits explicit null/empty field removals; a confirmed revision clearing all authored fields produces profile:null with the retained removal revision. New IDs without a profile remain null. Whole-profile API omission has no per-ID removal revision: it is retained pending authoritative confirmation, rather than mislabelled as a confirmed deletion. The weak global API ETag is not a per-driver deletion signal.

Manual usage after deployment:
& 'C:\Users\natha\Documents\KHR Broadcast\Website Publisher\MMTV-AutoPublish.ps1' -Publish -CheckDriverProfiles

During staging, use the supplied QA scripts and F: fixtures. Never point synthetic fixtures at production publication. There is no synthetic-input parameter on the main publisher.

## Approval and post-release proof

Do not install/enable this driver workflow until release approval and verified broadcaster customer-ID exclusions are supplied. Keep production Bridge and tasks unchanged. Deploy only the release manifest's files using the established publisher mutex and Git remote reconciliation procedure; retain the current signed publisher rollback. Verify source/target SHA256. Copy the two new .mjs dependencies beside DriverProfiles.ps1. Use the already installed, signed unchanged BroadcastLinks.ps1 and Export-Intelligence.ps1 helpers.

After approval/enabling, observe one genuinely new live native subsession and verify the actual GitHub Pages profile refresh. The historical November 3 saved snapshot is stale, contains only known IDs, and is not evidence of new live discovery.

SDK references:
- https://www.sdk-gaming.co.uk/knowledge-base/driver-information-user-manual/
- https://livetiming.sdk-gaming.co.uk/docs/driver-variables.txt
- https://livetiming.sdk-gaming.co.uk/docs/raw-data-variables.txt


## Post-broadcast admission cleanup

Two fresh SDK observations establish a provisional observation, not eligibility for a public driver profile. Unknown customer IDs remain in the private registry's pending_drivers collection. Admission requires a SHA-pinned private eligibility ledger with genuine League 10402 classified race proof, or an explicit owner-approved customer-ID list. Names and car numbers never establish eligibility. The original 25 verified profile IDs remain protected. Owner-confirmed Tye Dalman (316406) remains a genuine classified competitor.

Explicit AI source records and owner-excluded commentators are held in the private quarantine. Quarantine overrides approvals and is checked again when projecting cached registry data, including runs with discovery disabled. Existing unknown SDK-only records migrate to pending verification. Approved public newcomers use identity_source=verified_khr_competitor and identity_verification.status=verified. Weak SDK-only profile records cannot create roster cards.

The exporter uses the same admission policy to keep practice-only AI/spectator records out of the driver roster and alias catalogue. Every saved historical classification row remains available in the race tables; noncompetitor names appear as plain text rather than links to invented profiles. Canonical archives and original source files remain unchanged.

Discovery is paused during this review. Manual refresh of existing profiles and ordinary race/news publication remain available. Do not enable discovery or deploy the staged cleanup until owner approval. Install driver-admission.mjs beside the importer and intelligence builder, the changed core/CLI/builder, and the signed staged main/Export-Intelligence.ps1 together. Verify the private eligibility_path and eligibility_sha256 settings before enabling. Private audit/ledger files must never be committed or published.
