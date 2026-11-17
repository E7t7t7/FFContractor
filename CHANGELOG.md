# v0.9.5 — 2026-11-17
- Add phone-native Mobile Session with Start, Pause, Resume, Stop and account/claim ownership checks.
- Port the shared Commander browser worker and add a phone-side FFScouter/Torn API host.
- Add explicit medical consent, fixed non-drug item allowlist, minimum-cooldown combination planning, reported bonuses, single-use verification and hospital-race recovery.
- Retain provisional loss receipts across navigation/restarts and same-claim restarts; reject wrong accounts, invalid/expired claims and replayed receipts.
- Pause when hidden or interrupted; no promise of iOS background execution. No PC or remote access is required.
- Preserve existing mobile launcher/history and userscript update URL; add deterministic ES2019 generation.
- Tests: TornPDA preprocessing, lifecycle/claim/payout fixtures, medical core, host lifecycle, complete shared browser-worker replay and real Edge phone-sized UI.
- Unverified: actual TornPDA/iPhone runtime and live fights/items. No live resources consumed.
- Automatic game actions do not comply with Torn scripting rules. Phone/PC duplicate execution is not prevented by a shared cloud lock; users must stop desktop execution before starting mobile.
