# Driver-supplied information

`DriverProfiles.ps1` reads the same public profile database used by SDK Gaming's Driver Info web app: `https://profiles.sdk-gaming.co.uk/profiles`. Profiles are joined only by iRacing customer ID through `news/data/driver-identities.json`. Names in that identity map come from saved event results, owner-confirmed aliases and the read-only replay roster. Do not guess IDs from car numbers or similar names.

The manual publisher refreshes `news/data/driver-profiles.json` during interactive publication or when `-CheckDriverProfiles` / `-CheckBroadcasts` is supplied. `-SkipDriverProfiles` disables refresh. Existing noninteractive scheduled invocations retain their previous behavior. Nothing changes or restarts the Bridge, SDK Gaming or simulator.

Use the existing manual publishing command, or explicitly request profiles:

```powershell
& 'C:\Users\natha\Documents\KHR Broadcast\Website Publisher\MMTV-AutoPublish.ps1' -Publish -CheckDriverProfiles
```

The website displays all currently exposed driver-authored profile fields: first/last/suffix display name, country, hometown, team, header, information, bio, latest news, photo and website/YouTube/Twitter/Twitch/Facebook links. Source creation and update timestamps remain in the JSON; the update date is shown on the page. Missing fields stay absent. URLs are restricted to HTTP(S), and driver text is escaped. The source API currently does not expose birth dates; these are not inferred or extracted from unrelated sources.

The same website driver pages and JSON can be used for commentator research. SDK Gaming's native Driver Info web app also reads these profiles independently. This implementation does not change overlay layouts or replace the Bridge's live feed.

Initial audit: replay 89009401 contained 13 listed people, including the spectator BobbethTV. Eleven had SDK profiles; Wayne Bridges and Travis Mcdonald did not appear in the retrieved profile database. Across the website roster, 25 customer IDs are verified and 17 have supplied profiles. Spectator BobbethTV is excluded from the website roster. A driver with no verified ID is left unmatched.

Raw replay/profile audit files are kept outside the Git repository. Only the website roster's identified profiles are published. Add a verified ID to `driver-identities.json` when another driver appears, then refresh; no need to replay old races for a driver's profile updates.
