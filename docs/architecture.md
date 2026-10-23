# PicWiz V2 architecture

This describes the local implementation. [V2 spec, including R1–R5](v2/spec.md) is authoritative; [shared APIs](v2/core-contract.md), [data/render notes](v2/data-contract-notes.md) and [batch notes](v2/batch-contract-notes.md) describe integration details. The older `docs/core-contract.md` documents V1 and is not the V2 API reference.

## Runtime boundary

Next.js App Router serves the HTML shell, local assets, privacy page and health route. Browser code imports files, validates/normalizes rasters, draws previews/exports, writes the clipboard, stores the workspace and creates ZIPs. There is no server mutation or upload path. Fonts and the example are local assets.

- `app/page.tsx` / `app/layout.tsx`: route and shell; `components/editor.tsx`: current workspace, input, persistence/recovery and single export.
- `components/preset-library.tsx`, `annotation-layer.tsx`, `social-sizes.tsx`, `batch-export.tsx`: appearance library, accessible annotation editing, size selection and transient batch workflow.
- `lib/domain.ts`: style/look separation, six starter looks, six sizes and exact dimensions.
- `lib/annotations.ts`: strict records, bounded movement and 50-step session history.
- `lib/image-format.ts` / `browser.ts`: bounded raster input, decoding/encoding/clipboard/download adapters and normalized errors.
- `lib/canvas.ts`: shared layout and renderer for preview, PNG, clipboard and batch. Preview caps resolution; export uses exact size × scale.
- `lib/storage.ts` / `migrations/`: validated schema-2 repository, frozen V1 migration, two-key adoption/conflicts, preset JSON and export-job metadata.
- `lib/batch.ts` / `zip.ts`: serial bounded runner and stored ZIP32 writer. No persistence, network or download side effects inside these modules.
- `/privacy`: server-rendered local retention explanation. `GET /api/health`: non-sensitive runtime diagnostic.

PostgreSQL/Drizzle, account authorization, S3, remote queues and provider credentials are explicit non-goals for this local-only product. No OAuth/CSRF/webhook/token lifecycle exists. Browser profile plus origin is the ownership boundary, not an authenticated user ID. Other same-origin scripts are trusted; there are no third-party scripts or analytics. No gallery, 3D, video or account architecture is introduced in this release.

## Durable and transient state

The [data model](data-model.md) documents schema constraints. One atomic localStorage envelope, `picwiz:store`, holds only the current image/annotations/style, 24 personal presets and 20 job records. The original legacy key `shinyshot:store` is retained separately until confirmed clear. Thus an upgraded profile can retain an additional older screenshot.

Undo/redo, batch File references, task rows, decoded images, rendered canvases, PNG blobs and ZIPs are memory-only. No remote job can resume them. Closing batch discards its session; reloading loses batch inputs/results and converts persisted pending jobs to failed/`interrupted`. Downloads and clipboard contents are outside application deletion.

## Persistence, migrations and recovery

Initialization runs ordered migrations 001 → 002; frozen V1 definitions prevent new defaults from silently changing old validation. Migration 002 preserves IDs, timestamps and source, adds annotations/job counters and converts V1 padding/radius using `round(oldValue × baseWidth / 1600)`. It does not promise pixel-identical geometry.

Load selects the new raw key if present, otherwise legacy. Corrupt/future new data never falls back to old data. Full validation precedes a single commit to the new key; legacy remains untouched. Adoption and pending-job interruption recovery can write during load. Empty initialization stays in memory until save. Unknown/corrupt/quota-failed source documents remain available for backup.

Load/save snapshot both raw values, recheck before and after commit, and reject stale writes. The UI handles either storage key and `key=null` events, invalidating async work after clear/import. This detects conflicts without claiming a multi-tab compare-and-swap transaction.

`clearStore` deletes legacy first, then current, verifies both absent and writes no replacement itself. The UI may save a new empty store afterward. Partial failure blocks writes until successful clear or reload. Removing only the current screenshot clears its source/annotations; style, presets, history and legacy backup remain. Reset style restores default appearance and output settings (landscape, 1×), retaining the image and annotations.

Recovery offers private raw backup, session-only editing, retry/reload or confirmed clear. `backupLocalData` wraps both unparsed raw strings, including damaged content; it may fail if storage cannot be read. There is no backup restore UI. [README recovery instructions](../README.md#local-retention-backup-and-recovery) cover manual same-origin restoration and rollback. No down migration exists: rollback needs compatible code and data; the retained V1 snapshot omits subsequent V2 edits.

## Rendering and batch execution

Input must match PNG/JPEG/WebP signatures and any supplied MIME, with ≤25 MiB, ≤40 MP and ≤16,384 pixels per edge. Import normalizes to ≤4096 per edge and a ≤2,500,000-character raster URL; compression/resizing may reduce detail. Invalid input preserves the current composition.

One layout function aspect-fits the complete image and places annotations in normalized screenshot coordinates. Padding/radius and frame geometry scale by output width / selected base width. Annotations clip to the image; text also clips to its own box after wrapping to at most three lines. Selection handles do not render into exports. Neutral preset thumbnails use this renderer without user source content.

Batch freezes input order, style, scale, formats and current-source annotations before work. Other files get no inherited annotations. Limits: 10 sources, 3 formats, 30 pairs, 150 MiB original-file input, 64 MiB accepted PNGs across all retries, 65 MiB archive. This bounds retained outputs, not total device memory. Sources process serially; decoded images/canvases are released between groups. Oversized output is rejected, not silently included or omitted as success.

A module submission lock prevents overlapping batches. Stable `sourceIndex:size` pairs survive retries; new attempt IDs/job IDs distinguish submissions. Transient failed pairs may retry against the same snapshot; successful blobs are reused. Invalid-input/resource-limit errors require changed inputs or a smaller batch. Job counters describe the current attempt; merged manifest rows describe all retained results. ZIP failure can retain all successful PNGs while the job fails/`zip_failed`.

Cancel prevents new work immediately; stopping is followed by cancelled after runner settlement. All PNG uses share a native encoder lock. Application timeout/abort rejects its promise but does not release the lock until the real callback; late results are discarded. A permanently missing callback needs reload. Packaging already completed PNGs needs no encoder and requires explicit action; no automatic download/retry occurs.

The ZIP writer emits PNGs and `picwiz-manifest.json` using stored ZIP32, UTF-8 filenames, fixed timestamps, CRC32 and ≤1 MiB slice reads with cancellation yields. It rejects duplicate, absolute and traversal paths and preflights the archive budget. No extraction, ZIP64, worker or production dependency is needed; dev-only `fflate` verifies interoperability independently in tests.

## Operations and evidence

Use Node 24 LTS, `npm ci`, `npm run build`, then `npm start` on a Node-compatible HTTPS host. No secrets or external services are required. Preserve a stable origin. `next.config.ts` restricts framing, network targets, MIME sniffing, referrers and browser permissions; verify host/proxy header delivery. Production CSP permits framework inline scripts/styles but no external script/font/connect hosts.

Health returns `status/app/version/storage/requestId`, sets no-store and correlation headers, and logs event/request ID/status only. It is not a browser storage, codec or clipboard probe. Diagnose local failures from recovery messages and bounded job codes without logging private content. Host access logs are outside the local editor.

[CI](../.github/workflows/ci.yml) installs Chromium/Firefox/WebKit with dependencies, regenerates synthetic fixtures, builds, starts production, waits for health and runs `npm test` through `PLAYWRIGHT_BASE_URL`. Typecheck/unit/browser commands and manual production reproduction are in README. Chromium has the full suite; the other engines run critical flows. Configuration is not execution evidence; browser tests were not run by this operations/docs task. OS clipboard, physical devices and device-memory behavior need separate evidence.
