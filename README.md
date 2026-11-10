## v0.9.4 — independent in-page entry and startup status
The confirmed quote-normalization parse error was fixed in v0.9.3, but the user's iPhone still shows no floating launcher. The remaining device failure is not established; no claim is made that the desktop test reproduces it.

- Adds an independent **Open FFContractor v0.9.4** bar inside the normal Torn page, separate from floating/side positioning.
- Adds Startup info containing only version, initialization stage, error type, attachment status, viewport size and bridge availability. No credentials or player data are included.
- Catches errors during main initialization so the in-page bar can report a failure rather than disappear silently.
- Preserves the current launcher, key/history storage, contracts and raw update URL.
- Tested through TornPDA preprocessing, existing offline API/lifecycle fixtures and a real headless Edge mobile-sized DOM. Real iPhone visibility remains unverified.
- After updating, reopen Torn and look at the top of the page for Open FFContractor v0.9.4. If that control is also absent, the main floating-position logic cannot explain the whole failure; the installed version and TornPDA runtime details are needed.

## v0.9.3 — reproduced TornPDA startup parse failure
**Actual failure reproduced:** TornPDA's UserscriptsProvider.adaptSource globally changes curly apostrophes to ASCII apostrophes before evaluating userscripts. FFContractor's attack-card HTML included the literal text Torn’s inside a single-quoted JavaScript string. The app rewrote it to Torn's, terminating that string early and raising SyntaxError before any launcher code ran. Raw JavaScript tests did not reproduce the app's preprocessing.

- Historical reproduction: v0.7.0 and v0.8.0 parse after PDA rewriting; v0.8.1, v0.8.2 and v0.9.2 fail with the same syntax error. This identifies v0.8.1 as the first broken release in that comparison.
- Reworded that label without the problematic apostrophe.
- Tests now compile and execute the full production script through TornPDA's wrapper and quote-rewriting transformation.
- Added a broken-string regression fixture that proves the original error, then verifies the repaired script mounts and passes existing launcher/contract tests.
- No further speculative launcher-position changes. Existing Classic/Side preferences, credentials, payout history, contract safeguards and update URLs are retained.
- Compared the locally installed Loss X-change startup and the public TornPDA loader; no Loss X-change source is redistributed.
- Reference: https://github.com/Manuito83/torn-pda/blob/master/lib/providers/userscripts_provider.dart
- Update the existing script to v0.9.3 in TornPDA and reopen Torn. The preprocessing failure is confirmed offline; the final iPhone display still needs user confirmation.

## v0.9.2 — restore the confirmed working launcher layout
Reviewed the original **Create Loss Contract Script** conversation and repository history. Injection had already been established; the launcher was visible before later updates. The precise iPhone rendering failure is still not captured.

- Restores v0.7.0's original floating-button CSS as the default, above the bottom toolbar rather than in the chat bar.
- Classic mode does not depend on saved side-tab coordinates or visual-viewport position calculations.
- Retains the current seller API, target retention, request safeguards, credentials, history and independent Commander/mobile operation.
- Draggable side tab remains optional under Settings > Launcher. Restore classic FF launcher is also available in script menus where supported.
- No need to repeat the injection test simply because the icon disappeared after an update. Update the existing script to v0.9.2 and reopen Torn. If still absent, an actual device screenshot/version or rendering diagnostic is needed; simulated tests do not prove visibility on the phone.
- Offline tests verify original launcher CSS, stale dock settings isolation, classic/side switching, reset, existing drag/viewport/lifecycle and contract regressions.

## v0.9.1 — mobile launcher recovery
- Mounts the launcher and flyout beside the page body, reducing clipping from transformed/hidden page containers.
- Repairs an orphaned same-version launcher instead of returning before click handlers exist; disposes the old lifecycle on an in-page update so stale timers cannot recreate old tabs.
- Remounts after top-level page replacements and retains viewport/position controls. Adds touch dragging for older iOS without PointerEvent.
- Removes optional-chaining syntax and Promise.allSettled dependency for older WebKit compatibility; no API keys are read during launcher startup.
- Where supported, script menus provide Open FFContractor and Reset FF tab position.
- Same install/update URL and independent phone operation. Contracts and payout behavior preserved.
- Root cause on the user's iPhone is not confirmed. Offline tests cover these recovery paths; a script cannot repair TornPDA failing to inject it.
- If no tab appears: update from the existing raw URL in TornPDA Scripts, enable the script for Torn, choose END injection, then reopen a Torn page. Run FFContractor-Diagnostic.user.js if still absent: FF TEST distinguishes injection failure from main UI failure. Do not delete your stored script data.

## v0.9.0 — coordinated Commander/mobile maintenance

- Same standalone TornPDA launcher, draggable position and remount lifecycle retained.
- HTTP transport supports TornPDA first and Commander's optional userscript bridge second. Install URL remains unchanged.
- Claim Max sends the displayed bounded positive count, never an open-ended zero. One active claim is checked before reservation.
- Durable pending-request guards block duplicate claims/completions after interrupted responses; refresh reconciles actual remote claim/order identity.
- Message scans explicitly request a separate, unsaved Torn API key; never silently reuse the seller credential. Message matches remain references, not payment confirmation.
- Exports identify provider/schema and known owner without credentials. Desktop retrieves recent claims via the seller API; phone-local older history is not automatically synchronized.
- Commander can optionally watch NEW API/phone claims and run its owning worker when explicitly armed. Keep the PC awake, signed in and running. Avoid concurrent manual phone attacks.
- Tests are simulated; iPhone launcher/navigation and real seller reservations remain unverified.

## v0.8.2 — missing side icon recovery (November 7, 2026)

The **FF** tab remains a draggable side handle, but now calculates its position using the browser's visible viewport when available rather than just the full page/layout viewport. This helps when TornPDA zooms, changes orientation, restores a tab, or reports a larger WebView layout than the visible phone screen.

- **One-time placement reset:** switches only the tab-position preference to a new versioned key, starting at middle-right; old dock coordinates are ignored. API keys and the payout ledger are untouched.
- Places the tab using a visible-screen X coordinate (instead of `right:0`, which can be offscreen when zoomed).
- Recovers from a stale interrupted touch drag after 6.5 seconds, and from touch capture cancellation.
- Rechecks placement on tab restoration, navigation, viewport resize/scroll, focus, and the existing mount interval.
- The panel also uses visible-screen bounds so it remains next to the side handle.

**Validation:** JavaScript parses. Simulated normal, zoomed/offset and narrow viewports all mounted the FF tab visibly, and forced launcher removal recovered on the next mount check. Real iPhone behavior remains to be confirmed. If the icon is still absent after installing v0.8.2, check TornPDA's **Dev Tools → Scripts** to see whether FFContractor actually executed on the current page; a userscript cannot fix failure to inject itself.

## v0.8.1 — Attack Now link repaired (November 5, 2026)

- Active claim's **Attack now** action is a normal same-tab Torn link to `https://www.torn.com/page.php?sid=attack&user2ID=TARGET`, replacing the older unreliable `loader.php` route.
- Target ID extraction accepts several seller-contract/claim field names, nested target records, and verified torn.com profile/attack URLs; malformed/untrusted URLs are not accepted.
- Saves the target ID from the successful claim response to the existing per-account ledger, then reuses it after active-claim refreshes. This avoids losing the target when FFScouter returns a more compact claims list.
- A missing target ID now displays **Find target**, which checks the official seller order-detail API. If no usable ID is available, the UI explains the problem and provides an explicit fallback to the official FFScouter Sell Losses page. No contract claim is performed by this recovery action.
- Kept the v0.8.0 draggable edge tab, saved location, claim buttons, payout ledger and remote GitHub update metadata unchanged.
- Validation: JavaScript syntax, sample FFScouter target field variants, safe URL parsing, ledger/contract fallback, link output and missing-target UI tests passed. Real FFScouter claims and iOS navigation are not yet verified.

**If you have an active timed claim:** do not wait for a script update to finish it. Use FFScouter's official Sell Losses page to open its target link. The API claim and expiry are managed by FFScouter rather than by FFContractor.

## v0.8.0 — draggable side launcher (November 5, 2026)

The blue **FF** launcher is now a slim vertical handle that defaults to the **right edge, about midway down** the game. This avoids covering TornPDA's bottom toolbar. Tap to open the existing FFScouter panel; **touch and drag** to reposition it vertically, or drag across the screen to snap it to the other edge. The flyout automatically opens inward from whichever edge the handle uses.

The position is saved separately from API credentials and the payout ledger, using local storage with TornPDA storage backup when available. Go to **Settings → Tab position** for Left, Right, and Reset controls. Reset returns it to the middle-right. A drag is not treated as a tap. The verified v0.7.0 plain-DOM launcher and remount logic, contract workflow, payout tracking, and original GitHub auto-update metadata are retained.

**Tests:** JavaScript parsing and a simulated page test confirmed initial right-edge placement, moving the tab to the left, saving its position, and restoring that position after a simulated reload. Real TornPDA/iOS touch and visual behavior still need confirmation.

## v0.7.1 — chat-tab layout (November 5, 2026)

- Keeps the **proven v0.7.0 launcher bootstrap and remount lifecycle**.
- Changes the FF button to a narrow, bottom-docked chat-style tab, offset right of the leftmost Loss X-change-style tab.
- Positions the existing dashboard directly above the bottom tabs.
- No changes to FFScouter API calls, claim logic, local payout ledger, or GitHub/TornPDA update metadata.
- JavaScript syntax verified. Actual TornPDA placement must be confirmed on iPhone; if another chat tab overlaps FF, send a screenshot and we can adjust its horizontal offset.

# FFContractor — FFScouter Loss Desk for TornPDA

A personal-use FFScouter loss-contract dashboard that runs inside the TornPDA browser, with contracts, claiming, payout reconciliation, and a GitHub update check.

## Current release: v0.9.4

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
