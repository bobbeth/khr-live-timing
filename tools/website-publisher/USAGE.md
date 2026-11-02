# Mud Mules TV manual publisher

After a broadcast ends, run in PowerShell:

```powershell
& 'C:\Users\natha\Documents\KHR Broadcast\Website Publisher\MMTV-AutoPublish.ps1' -Publish -CheckBroadcasts
```

Omit `-Publish` for a dry run. The log prints the isolated staging repository so you can inspect its staged changes. `-Status` only reports race captures; it does not check YouTube.

Interactive runs check YouTube by default. `-CheckBroadcasts` explicitly enables it in any invocation. Existing `-NonInteractive` background invocations do not check YouTube unless given this switch. `-SkipBroadcasts` disables lookup. No task scheduler changes are required or made.

Keep `BroadcastLinks.ps1` next to `MMTV-AutoPublish.ps1`. The installed `yt-dlp` must be available on PATH. Lookup reads metadata only, checking the 12 latest channel entries and full metadata for up to three recent completed streams. `post_live` means the broadcast has ended but YouTube is still processing it; the eventual recording may take time to play.

Matching requires the BobbethTV channel ID, completed stream status, Fall Fest 2026 league title, actual release timestamp converted to Australia/Hobart, Monday/Tuesday/Wednesday coverage, series names in the title or description, and an unambiguous published subsession for that series/date. Round and subsession IDs come from website race data. Missing metadata, unrelated streams, multiple candidate recordings or multiple same-series subsessions leave the link unset. Update the YouTube description with the covered series if necessary, then rerun. A YouTube lookup failure is logged and does not prevent completed race publication.

Existing mappings, including existing offsets, are never replaced. New mappings omit `start_seconds`; the website opens the full recording. No race start times are guessed. Broadcast matching runs even when there are no new race captures.

The Round 6 source is https://www.youtube.com/watch?v=IyXQ4OjSR3Y. Source metadata reports channel UCdp4gP29AQWrMdoubvgekyA, status post_live, release timestamp 1793579439 (2026-11-02 00:30:39 UTC / 11:30:39 Hobart), and a description naming BOMMBER STOCKS and CUSHION KINGS. Both website subsessions 89810317 and 89812470 are dated 2026-11-02. This is a metadata and schedule match, not independently viewed race content.

Tests: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Test-BroadcastLinks.ps1` from the delivered workspace. Tests use the saved YouTube response and website data; they do not publish.
