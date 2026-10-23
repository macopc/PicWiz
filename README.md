# PicWiz

A browser-local screenshot studio. Reuse style presets, add arrows, rectangles and text, choose a social composition size, and export a PNG or batch ZIP. Built with Next.js App Router, React, TypeScript and browser Canvas.

**Your screenshots stay in your browser.** Images, annotations, preset files and ZIP contents are not uploaded. There are no accounts, database, object storage, analytics or remote workers. The browser profile owns its workspace; people sharing a profile share its data. Local-only requirements take precedence over generic PostgreSQL/auth/S3 requirements. See [architecture](docs/architecture.md) and [data model](docs/data-model.md).

## Run locally

Use Node.js **24 LTS**, npm and a current browser. No environment file or service credentials are required.

```sh
npm ci
npm run dev
```

Open <http://localhost:3000>. Choose **Use example**, drop or paste a PNG/JPEG/WebP, or use **Add screenshot**. Fonts and the fictional example are bundled locally. [.env.example](.env.example) documents optional process variables; supply Playwright variables to the test process, not just a Next.js env file.

## Create and export

- **Style presets:** Studio, Paper, Midnight, Mint, Sunset and Ocean apply appearance while preserving the screenshot, annotations, output size and scale. Save up to 24 personal looks; update with confirmation, rename, delete, or import/export appearance-only JSON. Preset files contain no image or annotations, are limited to 100 KiB/24 entries, and import atomically. Re-importing the same names and looks skips duplicates.
- **Annotations:** add arrows, rectangles or plain text, select layers, drag or edit percentage coordinates, and change color/weight/text size. Arrow keys move 1%; Shift+arrow moves 5%; Delete removes a selected annotation. Undo/redo retains 50 annotation edits in this session. Up to 30 annotations stay anchored to the screenshot across output sizes. Text is limited to 140 characters and three rendered lines, clipped at its box. Annotations are not a redaction tool.
- **Sizes:** landscape 1600×900, square 1080×1080, portrait 1080×1350, story 1080×1920, LinkedIn 1200×627 and Pinterest 1000×1500, all at 1× or 2×. PNG download, clipboard and batch use one renderer with exact dimensions and aspect-fit images. Clipboard support depends on HTTPS/localhost, browser and OS permission; PNG download is the fallback.
- **Batch export:** include the current screenshot with its annotations and/or add files, choose 1–3 sizes, then **Prepare ZIP** and explicitly download it. Other files do not inherit the current annotations. Results have unique numbered paths, such as `01-dashboard/landscape-1600x900.png`, plus `picwiz-manifest.json` with dimensions, attempt/status and error metadata.

Batch limits are **10 sources, 150 MiB original-file input, 30 PNGs, 64 MiB retained PNGs across retries and a 65 MiB ZIP**. Individual files remain limited to 25 MiB, 40 megapixels and 16,384 pixels per edge. The PNG budget is not a total browser-memory guarantee. Reduce source count, size count or scale after a resource-limit error.

Partial failures retain successful PNGs; retryable failures use the original snapshot without re-encoding successes. Invalid files require replacement or a new batch. ZIP packaging failure offers **Prepare ZIP again** using existing PNGs. Cancel stops new work and automatic download; after settling, **Download completed results** can explicitly package successes. Native PNG encoding cannot be forcibly interrupted: a 15-second application timeout/cancel leaves the encoder locked until its callback finishes; reload if it never responds. Closing the batch dialog releases its files/results; reopening or refreshing requires adding batch files again.

## Tests and reproducible fixtures

```sh
npm ci
npx playwright install --with-deps chromium firefox webkit
npm test
```

`npm test` runs typecheck → Vitest unit/adapter tests → Playwright browser tests. Chromium runs the complete suite; Firefox and WebKit run the `@critical` flows. Each test gets isolated browser storage. Local tests start/reuse the development server on port 3000; leave that port free unless intentionally testing an existing app. A custom Chromium binary can use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; it does not replace Firefox/WebKit.

```sh
npm run typecheck
npm run test:unit
npm run test:e2e
npm run seed
npm run build
```

Seed regenerates only fictional content: `/example.png`, the existing V1 fixtures at `tests/fixtures/{recovery-state.json,not-an-image.txt}`, and [V2 demo fixtures](public/fixtures/README.md) with three source PNGs, happy/empty/failed/interrupted stores, a legacy migration store and an importable preset file. It does not alter browser storage. Existing browser tests keep using the V1 recovery fixture and generate other images in memory; public V2 documents are manual demo inputs, not claimed test coverage.

The [CI workflow](.github/workflows/ci.yml) installs all three engines, regenerates fixtures, builds, starts production, checks health/headers, and runs the same `npm test` command with `PLAYWRIGHT_BASE_URL`. For an equivalent local production run:

```sh
npm run build
npm start
# In a second terminal:
CI=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npm test
```

Tests cover PNG dimensions/pixels, presets, annotations, ZIP contents, migration/recovery, errors/races, keyboard/mobile viewport and accessibility. Adapter fakes do not establish OS clipboard interoperability. See [the validation record](docs/v2/validation.md) for actual runs, reviewed fixes and per-engine scope. Physical Safari/iOS/Android and low-memory devices remain separate checks.

## Local retention, backup and recovery

Schema **2** lives under `picwiz:store`: current normalized screenshot, style, annotations, up to 24 presets and the last 20 export-job records. Only the current image is durable. Annotation undo, batch files, decoded images, PNG blobs and ZIPs are session-only. Preset thumbnails render a neutral example. Export records contain metadata, not downloadable files. Downloads, originals and clipboard contents remain under your control.

On upgrade, versioned migrations `001` → `002` validate frozen V1 data and adopt `shinyshot:store` only when the new key is absent. The old raw key stays as a rollback backup until confirmed clear. Source, IDs, names and timestamps survive; padding/radius are converted to output pixels with rounding, so frame/shadow geometry can vary slightly. Presets now apply appearance only. A corrupt/future **new** key blocks saving instead of falling back to legacy data. Startup migration and pending-job recovery may write once; a fresh empty store remains in memory until saved.

Retention ends at confirmed deletion, browser eviction or profile cleanup; private windows commonly discard data on close. **Reset style** restores default appearance and output settings (landscape, 1×), retaining the image, annotations, presets and history. **Remove screenshot** removes the current V2 source/annotations and keeps presets/history/style; it does not erase the legacy backup. Confirmed **Clear local data** deletes legacy then current, verifies both keys, and leaves unrelated site keys alone. The UI may then save a fresh empty workspace. Partial clear failure reports an error and blocks saving until successful clear or reload; it must not claim deletion succeeded.

Quota/unavailability, corrupt/future schemas and tab conflicts expose recovery: download a local backup, continue session-only, retry saving/reload, or confirm clear. Editing and PNG export remain possible without a successful save. Pending exports found after reload become failed/`interrupted`; batch files cannot be recovered from history. Other-tab changes require reload before saving; localStorage has no cross-tab transaction guarantee.

**Keep local backups private: they can contain your screenshot.** Recovery downloads `{app:"picwiz",type:"local-data-backup",version:1,createdAt,keys:{"picwiz:store":rawOrNull,"shinyshot:store":rawOrNull}}`. Both raw strings are preserved verbatim, including damaged JSON. Unreadable storage cannot be backed up through the app. Outside recovery, copy both raw values from developer tools or back up the browser profile before changing releases.

There is no full-backup import screen. To restore, close other editor tabs, back up current values, then use developer tools on the **same origin** (scheme/host/port) to set each key to its corresponding raw string, removing a key represented by `null`; reload afterward. Do not paste the wrapper as a store value or import it as presets. Use a compatible release for newer/unknown schemas. Restore replaces data rather than merging; no backup means browser deletion cannot be undone.

Rollback requires previous code (V1 baseline `09179ae`) **and** compatible V1 data; no down migration converts schema 2. The retained legacy document does **not** contain later V2 edits. Preserve both keys before rollback. Returning to V2 after editing in V1 still gives an existing `picwiz:store` precedence; reconcile which snapshot to keep manually before removing either key.

## Production and diagnosis

```sh
npm ci
npm run build
npm start
```

Deploy to a Node-compatible Next.js host with Node 24 and HTTPS. Install development dependencies for build/tests/seed; no runtime secret, database, bucket, auth callback, webhook or worker is needed. Keep a stable origin for the same browser workspace. A static export is not configured.

`GET /api/health` returns `{status:"ok",app:"picwiz",version:2,storage:"browser-local",requestId}` with `Cache-Control: no-store` and `X-Request-ID`. It checks the route, not a browser's storage/clipboard. Its log contains event, random request ID and status; hosting access logs may still exist. Do not log screenshots, filenames, annotations, preset contents or clipboard data.

For diagnosis, check health, then the browser recovery message and job error code. `storage_quota` needs site space/session-only editing; `storage_conflict` needs reload; corrupt/future data needs private backup plus a compatible release or clear; `interrupted` needs an explicit new export; `png_busy` needs encoder settlement or reload. A healthy server cannot restore evicted browser data.

`next.config.ts` sends CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY` and a restrictive Permissions-Policy. Production permits Next.js inline scripts/styles; network/fonts stay same-origin, images also allow local data/blob URLs, objects/framing are blocked. Configure HTTPS at the host and verify headers survive its proxy. Editing needs JavaScript/Canvas; no offline service worker, cloud sync or account recovery is included.

Authoritative behavior and accepted risks are in [spec.md](docs/v2/spec.md), including R1–R5; [review.md](docs/v2/review.md) separates spec review from implementation evidence. Gallery, 3D, video and account work follows V2 completion and is outside this implementation.

## Next-stage decisions

V2 is complete at `0704446`; see [actual validation](docs/v2/validation.md). Gallery, 3D, video and accounts have [product designs](docs/future/product-design.md), [technical comparisons](docs/future/decisions.md), [independent reviews](docs/future/review.md) and an archived [local decision brief](docs/future/decision-brief.html). The user selected D1B / D2A / D3A / D4C; the [next-stage implementation specification](docs/v3/spec.md) and [spec reviews](docs/v3/review.md) record that scope with a READY WITH RISKS verdict. This is specification work only; no future feature, dependency, migration or provider resource has been implemented.
