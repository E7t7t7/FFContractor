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

Version 0.3.0 is an initial integration tested in a simulated mobile browser; real FFScouter claims have not been executed by the developer.
