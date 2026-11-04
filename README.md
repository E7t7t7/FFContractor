# FFContractor — FFScouter Loss Desk for TornPDA

A personal-use FFScouter loss-contract dashboard that runs inside the TornPDA browser, with contracts, claiming, payout reconciliation, and a GitHub update check.

## Current release: v0.7.0

The installer URL remains the same:

```text
https://raw.githubusercontent.com/E7t7t7/FFContractor/main/FFContractor.user.js
```

The source remains a remote `.user.js` file with matching `@downloadURL` and `@updateURL` metadata so TornPDA can detect version updates. You do **not** need to manually reinstall if TornPDA already detects and offers v0.7.0.

## Why v0.7.0 replaces the old launcher

Versions 0.3–0.6 accumulated custom positioning, MutationObserver, and Shadow DOM code, without a successful iPhone test. v0.7.0 rebuilds a much smaller interface from scratch (~25 KB), using a plain HTML button inserted into the page body before any HTTP/storage calls, similar to the diagnostic script that was proven to run in TornPDA. The launcher is above the bottom toolbar and remounts if Torn removes it. The dashboard opens as a dark mobile chat flyout, without switching pages.

### Included

- Eight dashboard boxes: Total Paid, Outstanding, Total Earned, Losses Completed, Contracts Finished, Available Contracts, Active Claims, Payments Pending.
- FFScouter contracts (GET), claims (GET), claim selected/max (POST), mark complete (POST).
- Active-claim target link to Torn's normal manual attack screen.
- Local per-key payout ledger, receipt matching and optional scan of visible Torn message subjects/events.
- Settings and a manual GitHub update check.
- Existing storage keys retained from previous versions.

FFScouter payout status, not message text alone, determines confirmed paid totals. Personal ledgers cover only claims observed by the script and may not represent lifetime earnings.

## Install or update

1. In **TornPDA → Settings → Advanced Browser Settings → Manage Scripts**, find **FFScouter Loss Desk - Torn PDA**.
2. Update the existing remote installation to v0.7.0 through TornPDA's updater. Keep the existing installation unless you specifically want a fresh import.
3. Set injection to **END** if the UI offers the option, then reopen the Torn page.
4. Look for the blue **⚔ FF** tab above the bottom-left portion of the browser toolbar. Tap it to open Overview, Contracts, Payouts or Settings.

If the launcher is still absent after updating, use **Dev Tools → Scripts** to confirm that v0.7.0 executes on that exact Torn page. TornPDA detecting a remote update does not establish that the script has executed.

## Validation and limitations

Validated with JavaScript syntax check and simulated mobile Chromium tests: mounting, opening/closing, eight stat boxes, remounting after forced removal, re-injection after reload, contract rendering, and sample FFScouter claim/payout data. **Not yet verified on a live iPhone/TornPDA or authenticated against a real FFScouter account.** It never automates attacks.

The FFScouter API key is not embedded in the repository. Storage for the key is optional.
