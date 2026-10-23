# PicWiz V2 validation

2026-10-23 · macOS · Node 24.15.0 · Next 16.4.2 · React 19 · TypeScript · Vitest 4.1.12 · Playwright installed Chromium, Firefox and WebKit.

## Completed evidence

- Production build and strict project typecheck pass. Unit/adapter suite: **110/110 pass**, 10 files. Library boundaries cover 10×3 execution, exact/+1 byte budgets, native timeout/abort/late settlement locks, subset retries, annotation geometry/clip/history, frozen V1 migration, dual-key conflicts, immutable jobs, independent ZIP headers/CRC and adapter failures.
- Production health, security headers, rejected POST, privacy route and useful pre-hydration HTML pass. No provider credentials or external services needed.
- Axe scans the actual empty workspace, selected text annotation, library with a saved user look, and batch dialog. No serious/critical violations after fixes; no disabled axe rules. Text wrapping/clipping feedback is asserted.
- Independent spec reviews: two rounds, product and engineering READY WITH RISKS after R1–R5. Independent implementation reviews and responses are in [review.md](review.md).
- Preset import races: 2/2, repeated 6/6, against development server. Both cases also pass in the final production suite.
- Visual review at 1440×900 and 390×844 covered the actual editor, annotations, library and batch panel. T3 collaborative preview snapshot timed out twice (`Preview automation snapshot timed out after 15000ms.`); repository Playwright workflow supplied visual evidence.

## Execution history and final gate

First production pass: 41/46; fixes addressed actual contrast, label/name mismatch, restored-layer focus and recovery action names. A subsequent development pass had 45/46 with a frame change during source hot reload; final gate uses a frozen production build. The next production pass had 47/48; Firefox disabled-state restoration was reproduced and fixed rather than retried blindly. Two additional interaction races found by review now have dedicated cross-engine regressions. Firefox diagnosis independently confirmed server/client disabled-state divergence before DOMContentLoaded; the attribute fix is emitted in SSR, not applied after restoration.

**Final gate: PASSED.** `npm run build`, then `PLAYWRIGHT_BASE_URL=http://localhost:3001 npm test`: strict typecheck, **110/110 unit/adapter tests** and **57/57 browser cases**, exit 0. Browser run duration 1.9 minutes, retries disabled locally.

| Engine | Actual result | Scope |
| --- | --- | --- |
| Chromium | 35 passed | Complete suite, mobile viewport, axe, 4K/slider timing, twelve output dimensions, all recovery/race cases |
| Firefox | 11 passed | Critical journeys, PNG pixels, presets, annotations, batch ZIP, legacy migration, all three interaction races |
| WebKit | 11 passed | Same critical scope as Firefox |

The final artifact also passed health/correlation/security-header checks and contains the Firefox autocomplete fix in server-rendered HTML. Seed regeneration and `git diff --check` pass. CI is configured but has not run on a remote GitHub runner.

Supplementary actual Chromium batch check: **10 generated solid 3840×2160 PNGs × 3 sizes at 1× → 30 successes, 0 failures**, 1,386ms to prepared ZIP. During that run, 83 animation frames were observed, maximum gap 16.8ms. These are compressible synthetic files and one desktop run, not a general throughput or peak-memory claim. No trustworthy total-browser peak RSS measurement was obtained.

Final bounded independent gesture review `picwiz-v2-gesture-review-r4`: **READY WITH RISKS**, no confirmed P1/P2; 22 current-source harness checks passed. The three real gesture/paste regressions subsequently passed in all engines as part of the final gate.

Chromium runs all cases, including 4K drop <1s and slider preview <100ms; Firefox/WebKit run critical PNG, Clipboard API boundary, presets, annotations, batch ZIP and migration. Every test uses isolated browser storage. All six formats at 1×/2× decode twelve real downloaded PNGs; ZIPs are independently extracted and pixel-checked.

## Limits of the evidence

Clipboard copy tests replace the OS write boundary only when the engine actually supports native ClipboardItem/PNG; they validate real PNG bytes or a download fallback. Race tests inject the payload of Firefox's constructed ClipboardEvent (which otherwise strips files), retaining real File bytes and the actual importer/renderer; this validates event isolation, not trusted OS paste interoperability. They do not establish OS clipboard interoperability. The 4K benchmark uses a generated screenshot on this desktop, not a low-memory phone. Mobile coverage is a 390×844 browser viewport with keyboard/touch behavior, not a physical-device audit. Axe is not a full manual screen-reader audit.

64MiB bounds accepted retained PNGs, not total RSS. Normalization/decode/native encoding and ZIP assembly can temporarily use more memory. A native encoder that never calls back requires reload; the app does not claim a hard 15-second cancellation. No full-workspace backup importer, offline service worker, video or cloud storage is included.
