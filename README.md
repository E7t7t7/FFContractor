# FFContractor — FFScouter Loss Desk for TornPDA

Mobile FFScouter loss-contract dashboard inside TornPDA, including an eight-tile earnings overview, claim controls, payout tracking, and GitHub updates.

## One-time TornPDA install

In TornPDA open **Settings → Advanced Browser Settings → Manage Scripts** and choose **Add from URL / Remote**. Paste:

```text
https://raw.githubusercontent.com/E7t7t7/FFContractor/main/FFContractor.user.js
```

Install from this **remote URL**, not by copying code or importing a local file. TornPDA can then track GitHub updates and prompt you to install new versions.

## In-app update button

Tap the **⚔ FF** bubble in Torn. The ⇧ icon at the top of the panel—or **Settings → GitHub Updates → Check for Updates**—compares the currently installed version against the file in this repository. When a newer one exists, **Install Update** opens that file in TornPDA, where you can approve its normal install/update dialog. TornPDA controls the actual replacement; a userscript cannot silently change itself.

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

