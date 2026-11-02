# KHR visitor analytics

GA4 web stream: **G-WLVRGFTMM1**. The earlier ID G-94XKB3L2W9 belongs to the old website and is not installed.

Analytics is installed on the newsroom and the root live-timing page. The Google script is not requested until the visitor allows analytics. Analytics preferences are stored locally; the tag is blocked for local previews, browser DNT/GPC signals and browsers marked excluded. Advertising consent remains denied, Google Signals and ad personalization are disabled, and this integration does not call `identify` or assign a visitor account ID.

## Google property setting

The owner confirmed that **Data streams → KHR stream → Enhanced measurement gear → Page views → Show advanced settings → Page changes based on browser history events** is switched off. Keep this off. The tag config uses `send_page_view:false`; `analytics.js` sends one manual pageview on initial opt-in and one per subsequent hash-route change. Background fetches, race-feed polling and the app's repeated rendering do not send pageviews.

Page titles identify sections and numeric race/video/verified driver content IDs. Page locations are sanitized, with query strings omitted. Driver IDs refer to public race participants, not visitors. Initial external referrers are reduced to their origin; internal virtual referrers use the previous sanitized page. Unknown driver slugs are not sent. Standard GA4 page-path reports may group hash routes; use **Page title and screen name**, **Page location**, or **Content group** to distinguish sections and content.

Events: `page_view`, `youtube_click`, `outbound_click`. Click events send destination domain and current section, not full target URLs or link text. Clicks do not establish that a video was watched. Enhanced Measurement may independently provide Google-standard events such as `click`; do not add those totals to the custom click events as if they represented separate actions.

## Viewing traffic

Select the KHR property at analytics.google.com. Use **Reports → Realtime** to check current activity. Open the website and allow analytics in a non-excluded browser to create a test visit. Allow time for Google to process it. Standard reports are not instant. Analytics blockers, declines and privacy preferences mean totals will not represent every visitor.

Use **Reports → Engagement → Pages and screens** with **Page title and screen name** for popular content. Referrer acquisition reports show referring domains. No traffic history before installation can be recovered from this client-side integration. Do not publish private Analytics account links, credentials or API secrets in this repository. The measurement ID is intentionally public.

## Exclude the owner's browser

Open `/news/privacy.html` and choose **Exclude this browser from statistics** before allowing analytics. Repeat in each browser/device used for testing. To reverse it, choose **Stop excluding this browser**, then Allow analytics if desired. Exclusion is browser-local and clearing browser storage removes it. Withdrawal deletes the site's `mmtv_` prefixed analytics cookies and disables this property; it does not delete previously collected server-side data.

The preference lasts up to 180 days; analytics cookies are set for 90 days with Google's normal refresh behavior. See the public privacy page for the visitor-facing explanation. External video players and profile images remain separate services.

## Verification

Run `node news/scripts/check-analytics.mjs` for consent gating, withdrawal, owner exclusion, privacy signals, sanitized URLs/referrers, pageview deduplication and outbound-event checks. These tests do not load Google or send traffic. Google Realtime/DebugView confirmation requires access to the KHR Analytics property; repository/browser checks alone cannot prove that Google has accepted and processed the events.

References: https://developers.google.com/tag-platform/security/guides/consent and https://developers.google.com/analytics/devguides/collection/ga4/views
