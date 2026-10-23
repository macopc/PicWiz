# Shinyshot technical plan

Written before implementation. The explicit browser-only requirements and non-goals override the generic requests for accounts, PostgreSQL/Drizzle, S3, server mutations, and a remote job system. Adding those would create unnecessary data collection and contradict localStorage-only persistence. Next.js App Router and TypeScript provide the server-rendered shell; Canvas, drag/drop, local persistence and Clipboard require one client editor.

## Routes and boundaries

- `/`: editor, canvas, style inspector, export bar, presets dialog. Primary action: export PNG; input: drop/paste/choose a screenshot, or use the local example.
- `/privacy`: privacy, retention, deletion and browser limitations, server rendered.
- `/api/health`: GET-only deployment diagnostic; no user data, request correlation ID, no sensitive logs.
- No Server Actions, mutation APIs, upload endpoints, remote attachments, auth, cookies, searches, webhooks, emails, scheduled jobs, or secrets. The only role is the person using this browser profile. Same-origin browser storage is the boundary; no guessed URL can retrieve a composition. Shared profiles share data. Other scripts on this origin are trusted, so no third-party scripts are installed.

## Local relational schema (one versioned localStorage document)

Migrations are ordered pure functions. Missing data initializes schema version 1; unsupported future versions and corrupt data are preserved and reported, not silently overwritten. UTC ISO-8601 instants everywhere; no local schedules or timezone-dependent dates.

`Composition`: singleton primary key `current`; createdAt, updatedAt; status `empty | ready`; normalized style (background ID, padding, radius, shadow, frame, appearance, size, scale); optional source data URL, bounded filename and source dimensions. The source is a normalized browser-generated raster, never arbitrary markup or a URL. This stores the current screenshot across reloads, within the browser quota. No original file is retained externally.

`StylePreset`: UUID primary key; unique normalized case-insensitive name (1–40 characters); createdAt, updatedAt; active until deleted (no redundant status field); normalized style. Thumbnails are style-only UI previews so screenshots cannot leak through saved presets. Maximum 24. Saved independently of a source screenshot. Creation ordering supports the presets view; bounded arrays need no separate index at this size.

`ExportJob`: UUID primary key/idempotency key; compositionId foreign key to `current`; createdAt, completedAt; status `pending | succeeded | failed`; kind `download | clipboard`; exact width, height and normalized error code. Maximum 20 retained by creation order. A job captures output dimensions when submitted; completed metadata is immutable. No PNG blob or clipboard content is retained. Pending jobs found at reload become failed (`interrupted`); retry creates a new job ID.

Checks: allowlisted colors/backgrounds/frames/sizes; integer padding/radius/shadow within explicit ranges; scale 1 or 2; finite positive dimensions within allocation limits; trusted raster data URL only; all foreign keys valid; unique IDs and preset names. These are repository/domain invariants, not disabled-button checks. One `setItem` atomically commits each full validated envelope. A failed quota/write leaves the previous stored document unchanged and exposes a retryable UI message. Last-write-wins across tabs, with change detection before writes; no claim of cross-tab distributed transactions.

## Lifecycles, retention, idempotency

- Composition empty → validating (ephemeral) → ready. Failure retains prior composition. Replacing is reversible only by selecting another file; clear returns to empty with confirmation. Style changes are immediately visible and persisted after a short debounce; export flushes current state.
- Presets create → active → renamed/applied → deleted. Delete requires a scoped confirmation and does not change the current composition. Applying copies style values; no live foreign key, so deleting a preset cannot break a composition. Duplicate normalized names are rejected; repeated apply is idempotent.
- Export pending → succeeded or failed (terminal). Retry explicitly creates a fresh attempt. The same pending job ID cannot be submitted twice; terminal metadata cannot be rewritten. No background service: drawing is local, encoding is bounded by timeout, and clipboard requires a user gesture. Pending/failed/success are visible and announced. No remote audit trail or regulated audit requirement; local terminal job metadata remains unchanged until oldest-record retention or reset deletes it.
- Local data persists until explicit clear/reset, browser eviction, or clearing site data. Reset-to-defaults changes style only. A separate confirmed clear-local-data action removes all three tables and source data. No archives, external files, dependent cloud resources, or backups exist. Browser-profile backup is user controlled; shared device users should clear local data. Downloaded files remain under the user's control.

## Adapters and validation

Canvas/image adapter: accept only PNG, JPEG and WebP with matching magic bytes, bounded bytes and dimensions, decode with timeout, normalize oversized images, persist a bounded raster, revoke object URLs, and release replaced image resources. Rejection never mutates current state. Render preview at a capped device-pixel-ratio-aware resolution, render export into an independent canvas at exactly selected size × scale. Aspect-fit preserves the whole screenshot. Browser/device frames use the same renderer for preview and export.

Clipboard adapter: feature detect secure-context ClipboardItem/image support, begin write from the user's gesture using a PNG promise, normalize rejection and timeout, and offer PNG download as recovery. No automatic retries for clipboard/download side effects. Image decoding and encoding can be retried explicitly. Deterministic fake clipboard and storage adapters support tests; the bundled screenshot is a deterministic development input. No provider credentials, signatures, webhooks, notifications, encryption keys or environment variables are required.

## Interaction and validation plan

Quiet gray workspace, white inspector, ink text, purple primary action. Tokens: ink #23212b, muted #85828f, border #e9e7ef, workspace #f6f5f8, violet #7756df, white #ffffff. System sans typography with compact utility labels and tabular dimensions. Signature: a vivid, tactile gradient canvas containing a crisp product screenshot, surrounded by restrained editing controls. Desktop: top brand/navigation, central canvas and right inspector, bottom export bar. Phone: canvas first, horizontally accessible size/export controls and segmented inspector sections; no squeezed desktop sidebar.

Server HTML includes meaningful headings, import instructions, labels and loading guidance before hydration; a noscript notice explains browser JavaScript is required for editing. Semantic dialogs, keyboard focus, labelled sliders, focus rings, reduced motion, scoped delete confirmation, live status and errors. Empty: upload target and example action. Pending: decoding/export labels. Success: saved/export/copy announcements. Failures: source untouched on bad import, download recovery on denied clipboard, storage warning and retry on quota denial.

## Verification and operations

Unit tests: normalization, validation, transitions, terminal immutability, preset uniqueness, migrations and bounded history. Adapter integration tests: storage quota/corruption, image rejection, clipboard unavailable/denied/timeout/success. Playwright: all three real-interface journeys, source persistence after reload, exact PNG pixel dimensions and pixels, invalid drop preservation, 4K decode and slider responsiveness, and mobile. Single `npm test` command runs isolated unit and browser tests. Production build and type check required.

Deployment serves Next.js and static bundled assets over HTTPS; screenshots stay on-device. Security headers constrain requests and framing. No request payload logging; health logs only correlation ID and status. Versioned migrations preserve source documents on failure; downgrade by restoring the previous versioned storage document from a browser-profile backup, or clear with explicit confirmation. No database, storage bucket, seed users, or remote cleanup. Built-in example screenshot and three recommended looks exercise the happy path; tests seed interrupted/failed jobs and empty state.
