# Synthetic PicWiz fixtures

Run `npm run seed` from the project root to regenerate these fictional images and JSON documents. No network or user content is used, and seed does not change browser storage. `/example.png` remains the app example; do not remove it or the V1 fixtures in `tests/fixtures`.

- `dashboard.png`, `release-notes.png`, `analytics.png`: three 1440×900 sources for a 3-image × 2-size ZIP demonstration. Add them using Batch screenshots; select landscape and square to expect six PNGs. Use `not-an-image.txt` as a rejected source.
- `v2-happy-store.json`: ready screenshot, all three annotation types, one personal look and a successful download record.
- `v2-empty-store.json`: genuinely empty composition, no personal looks or history.
- `v2-failed-store.json`: ready composition with failed clipboard and partially successful batch metadata. History does not restore PNG blobs or show a previous batch-results dialog.
- `v2-interrupted-store.json`: ready composition with a pending six-output batch, two completed. Reload recovery makes it failed/interrupted with four failed; no batch inputs/results are recoverable.
- `legacy-v1-store.json`: schema-1 ready screenshot, legacy preset ID and pending clipboard job. Install under `shinyshot:store` with **no** `picwiz:store` to exercise adoption; expect the old raw value to remain unchanged and the new version to be 2.
- `style-presets.json`: appearance-only preset format, version 1. Import with Import presets; repeating the same import should skip the existing look.

Store documents are not preset files or Playwright `storageState` files. To demonstrate a state, close other editor tabs, privately back up both existing workspace values, open the app origin and use developer tools → Application/Storage → Local Storage. Set `picwiz:store` to the entire text of a V2 store fixture, then reload. For legacy adoption, remove the new key and set `shinyshot:store` to the legacy fixture text instead. Do not replace unrelated localStorage keys. This replaces your workspace; use a separate browser profile for demos.

Every store source embeds the exact PNG bytes from `dashboard.png`; the `name` is `dashboard.png`, not a remote URL. Public assets are reachable at `/fixtures/<filename>`. Only synthetic content belongs here. Existing E2E tests use `tests/fixtures/recovery-state.json` (kept at schema 1) and in-memory generated images; these new fixtures do not imply additional test execution.
