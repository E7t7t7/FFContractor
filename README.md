## v0.6.0 — Launcher visibility / lazy dashboard startup

- FF sword button mounts as a plain, direct child of the Torn document body before dashboard initialization.
- On iOS it is placed **above** TornPDA's bottom toolbar instead of at the bottom edge, where it could be obscured.
- The dashboard initializes only when the button is tapped; an API or storage problem should not prevent the launcher from being created.
- If dashboard startup fails, the tab shows an exclamation mark and tapping it can display an error.
- JavaScript syntax and basic launcher startup tested with a simulated DOM. Live iOS TornPDA behavior is not yet verified.

### If the button is still missing

In TornPDA's Dev Tools → Scripts, verify the **FFScouter Loss Desk** entry shows **v0.6.0** as running, rather than just an update being available. Screenshot the entry, including any script errors. Disable the separate yellow Injection Test script when no longer needed.

## v0.5.0 — Loss X-change-style bottom tab (2026-11-03)

- Rebuilt launcher after examining the **public** Loss X-change integration design. The other project has a no-redistribution license, so FFContractor uses independent code.
- The launcher is now a direct child of the Torn page body, fixed to the bottom edge, **not injected into Torn's React chat-bar DOM**.
- When Torn's chat controls exist, FFContractor positions next to them using measured coordinates; otherwise it docks at the bottom-right edge just like the reference implementation.
- Dashboard opens as a chat-style dark flyout above the tab, with no page-changing navigation.
- Existing claims, payout ledger and GitHub updater are retained.
- If you still see no FF tab after installing v0.5.0 and reloading Torn, capture **TornPDA → Dev Tools → Scripts** and any visible FFContractor console error. The experimental injection test can be disabled.

**Status:** Source validated with JavaScript parsing and launcher bootstrapping in a minimal DOM test. On-device TornPDA rendering and live FFScouter claims are not yet verified.

## v0.4.2: visible chat tab fallback

Previous versions required `#chatRoot` and could silently skip the launcher on some TornPDA views. v0.4.2 looks for Torn chat buttons globally, and provides a bottom-left chat-tab fallback whenever they cannot be found. The dashboard stays in a centered modal. Update your existing remote installation; disable the standalone diagnostic script after confirming it works.

# FFContractor — FFScouter Loss Desk for TornPDA

Mobile FFScouter loss-contract dashboard inside TornPDA, including an eight-tile earnings overview, claim controls, payout tracking, and GitHub updates.

## One-time TornPDA install

In TornPDA open **Settings → Advanced Browser Settings → Manage Scripts** and choose **Add from URL / Remote**. Paste:

```text
https://raw.githubusercontent.com/E7t7t7/FFContractor/main/FFContractor.user.js
```

Install from this **remote URL**, not by copying code or importing a local file. TornPDA can then track GitHub updates and prompt you to install new versions.

## In-app update button

Tap the **⚔ FF** chat tab beside Torn's chat controls (similar to LossXchange). The ⇧ icon at the top of the pop-up—or **Settings → GitHub Updates → Check for Updates**—compares the currently installed version against the file in this repository. When a newer one exists, **Install Update** opens that file in TornPDA, where you can approve its normal install/update dialog. TornPDA controls the actual replacement; a userscript cannot silently change itself.

To release a new version, update **FFContractor.user.js** on `main` and increment both the userscript `@version` and internal `SCRIPT_VERSION`.

## Use

Open Torn in TornPDA. Tap the **⚔ FF** floating button, enter your FFScouter-registered API key, and select **Load contracts**. Contract browsing, claiming, and payment tracking happen in the overlay. Attack targets open the normal Torn attack screen for manual losses.

## Storage and privacy

- API keys are not present in the source repository.
- The key is sent to FFScouter's API and optionally to Torn's official API for the mail-reference scan.
- Saved keys and local claim ledgers use TornPDA's per-script storage; **Copy ledger JSON** under Settings can help back up totals.
- FFScouter's recent claims API covers only recent history. Ledger totals begin when the script records claims and may not represent lifetime earnings.
- No automatic attacks, healing, or gameplay decisions.

Version 0.3.1 fixes launcher injection/visibility issues and passed simulated mobile-browser, iframe and re-mount tests; real iPhone installation and FFScouter claims have not been verified.

## ⚔ FF button missing in TornPDA?

1. Open **Settings → Advanced Browser Settings** and ensure **Enable custom user scripts** is ON.
2. Open **Manage Scripts**, verify FFContractor is listed and enabled, and set **Injection Time: END**.
3. If upgrading from v0.3.0, use the script's **Remote URL** to fetch/load v0.3.1 from GitHub. The missing-button version cannot update itself through the in-panel button.
4. Open a Torn page inside TornPDA and reload it. Look on the **left side above the bottom toolbar**, not inside TornPDA's native sword icon.
5. For a fresh installation, choose **+ → Configure → Remote URL → Fetch → Load/Add**, using the raw URL above. Avoid deleting the previous install before backing up your local payout ledger.
6. If it is still missing, use TornPDA's **Dev Tools → Scripts** on the open Torn page to see whether FFContractor was injected; a screenshot of that view helps identify the problem.



## v0.4.1: chat-tab interface

The FFContractor launcher is independent of Torn's chat-control DOM and docks beside the bottom controls, matching the chat-tab presentation. Tapping it opens a centered dark modal above a dimmed Torn page. Close it using ✕, the backdrop, or Escape. The existing contract, claim, payout-ledger and GitHub-update functions remain in the modal.

If you previously installed the **FFContractor Injection Test** script, disable it now. It was a diagnostic only, not part of the loss desk. TornPDA's normal script updater will detect v0.4.1 from the original GitHub URL.

This integration is syntax-checked, but actual rendering inside iOS TornPDA still requires on-device verification. If no chat tab appears, inspect the chat bar's DOM in TornPDA Dev Tools; the diagnostic proved generic script execution but not chat-bar availability.
