# V2 browser test handoff

Ownership: only `tests/e2e/**`, `playwright.config.ts`, and this note were edited. No app, library, package, CI, or unit-test files were changed by the browser test implementer. No commits or subagents were created.

Read before implementation: root `AGENTS.md`, the installed Next.js `node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md`, and `docs/v2/{spec,core-contract,review,product-design}.md`, including authoritative R1–R5.

## Coverage

- Preserve V1 exact-padding PNG pixels, frame/appearance/shadow preview changes, saved preset lifecycle, mobile layout, 4K import and slider timings, invalid drop preservation, clipboard rejection recovery, paste, interrupted jobs, and three delayed-import/restore/clear races. Update the active key to `picwiz:store`, export filename to `picwiz-*`, and preset application to preserve the current size/scale.
- All six fixed starter looks preserve the image, annotations, size and scale. User presets save, explicitly confirm update, retain their ID/creation instant, rename, export appearance-only JSON, delete, re-import, and skip the same file idempotently. A mixed valid/invalid import must not partially commit.
- Arrow, rectangle and plain text: add/select, property editing, arrow flips, keyboard movement, Delete, button and keyboard undo/redo, refresh persistence, and successful/failed screenshot replacement. Actual PNG ink is checked for all three types. Rectangle bounds are checked against independent source-fit geometry across landscape/story/LinkedIn and 1×/2× output. A DPR 2 drag checks CSS/backing coordinate mapping, one-step history, no writes during pointermove, and pointercancel rollback.
- Six sizes × two scales decode twelve actual PNG downloads with independently fixed expected dimensions.
- Three sources × two formats: independently unzip with dev-only `fflate`, assert six unique deterministic paths, every PNG's dimensions/background, source-only annotation pixels, and a version-2 manifest. Prepare does not download automatically. Observe requests to reject uploads.
- Batch bad-image partial success and nonretryable classification; transient native encoding failure retries only one failed pair and preserves the earlier job; cancel during a held native callback retains the first success, starts no later pairs, and requires separate explicit packaging/download. Native callback fault injection intercepts only the browser boundary; successful PNGs use the real encoder.
- Real schema-1 legacy document migrates to schema 2 with source, old bounded IDs, preset timestamps, scaled geometry, interrupted job counters, and unchanged raw legacy backup. A corrupt authoritative new key does not fall back to valid legacy data. Backup downloads both exact raw strings; session-only annotation/export works; confirmed clear removes both workspace keys while preserving unrelated data.
- 390×844 touch-enabled browser viewport: keyboard annotation editing/movement/delete/undo, formats, two-format ZIP download, no horizontal overflow, reachable actions, dialog close focus. This is browser viewport coverage, not real phone evidence.
- Axe scans the actual empty workspace, selected annotation editor, preset library and batch dialog. Serious/critical violations fail with node targets; all violations are attached. No global rule disables, fabricated product fixture, or CSS exclusions.

## Running and browser scope

`npm test` uses the parent's existing typecheck → unit → browser script. Chromium runs the complete browser suite. Firefox and WebKit each run eight `@critical` flows covering PNG pixels, preview/ClipboardItem behavior, both preset flows, annotation editing/PNG ink, batch ZIP, and migration. Every Playwright test gets a fresh context/storage scope.

Locally, the config can start/reuse the development server. For the parent's separately started CI/production server, set `PLAYWRIGHT_BASE_URL` to its URL; this disables Playwright's own `webServer`. The installed Next guide recommends production-server E2E runs. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` remains supported for Chromium only.

One worker and serial files bound concurrent canvas/ZIP memory and timing interference. Default per-case timeout is 45 seconds; the twelve-export case allows 60 seconds; existing race cases allow 15 seconds. Screenshots and traces are retained only for failures. The desktop Chromium 4K/slider benchmark explicitly disables tracing and asserts <1000 ms/<100 ms respectively; do not report those numbers as phone performance.

Clipboard encoding tests feature-detect native `ClipboardItem`, native write support and PNG support. They stub the OS clipboard write/read boundary only when that capability exists, verify real native items and real PNG bytes, and exercise download fallback otherwise. A separate negative test deliberately removes ClipboardItem. OS clipboard interoperability and physical Safari/iOS/Android behavior remain untested.

## Actual validation in this implementation task

- `npx playwright test --list`: passed; 46 cases in 11 files (30 Chromium, 8 Firefox, 8 WebKit).
- `git diff --check -- tests/e2e playwright.config.ts`: passed.
- `npm run typecheck`: latest run exited 2 with no diagnostics in browser tests/config. The remaining diagnostic was `components/batch-export.tsx:97` duplicate `name` (TS2783). That file belongs to the UI implementer and was not edited here.
- No browser tests, accessibility scans, timing benchmarks, app server, production build, or browser installation were run by this implementer. Per the brief, full execution belongs to the parent after the app is ready. Discovery/configuration is not browser pass evidence.

## Parent integration checks

Static inspection found an actionable result-identity mismatch: `retryBatchPlan` and `packageBatchResult` look results up by object identity, but the current `BatchExport` clones `result` before calling them (`{ ...result, archive: null }`). Preserve the original API result when retrying/repackaging; manage the UI archive reference separately. The new retry/cancel tests cover these paths. This is a static finding, not a reported browser failure.

The tests follow the public accessible names in `core-contract.md`, including `My presets`, `Update {name}`, `Move {type} annotation {n}` (the emitted SVG button), all annotation property labels, and batch actions. The UI must restore focus after annotation deletion/undo and batch dialog close, keep global annotation shortcuts out of text inputs, show recovery backup/session controls, and expose retry only for retryable item errors. Inspect real snapshots and adjust a test only when the emitted semantics satisfy the contract; do not suppress axe rules or relax PNG/ZIP assertions to obtain green runs.

After app readiness, run the complete `npm test` command against the intended server and record each engine's actual results in the parent's validation record. Browser binaries are being installed by the parent; no engine availability or pass status is inferred here.
