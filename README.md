# Shinyshot

A focused screenshot studio: drop or paste an image, tune its background and frame, then export a precise social-ready PNG. Built with Next.js App Router, React, TypeScript, browser Canvas and Clipboard APIs.

**Screenshots never leave the device.** The brief’s local-only storage and explicit non-goals take precedence over its generic database, account, S3 and queue requirements. There is no sign-in, backend database, upload endpoint, external provider, analytics, or background service. The browser profile is the sole ownership boundary. People sharing that profile share its saved workspace.

## Start locally

Use Node.js 22.12+ (24 LTS recommended), npm, and a current browser.

```sh
npm ci
npm run dev
```

Open <http://localhost:3000>. No environment variables or external services are required; `.env.example` lists optional port and test-browser overrides. DM Sans is bundled locally; fonts make no third-party requests.

The first visit opens a fictional example screenshot. Drop a PNG, JPEG or WebP, use **Add screenshot**, or paste an image with Cmd/Ctrl+V. Pick a background, move the sliders and choose a frame. The bottom bar selects landscape (1600×900), square (1080×1080) or portrait (1080×1350), at 1× or 2×. Export PNG downloads exactly the displayed pixel dimensions. Copy image uses the same renderer. Save preset → name it → save; on the next screenshot, My presets → choose a look applies it in two clicks. Rename/delete live beside each saved preset.

On phones, the canvas comes first, Style/Frame/Presets tabs keep controls usable, and export controls remain at the bottom of the viewport. Reset style is the reset icon on desktop; on mobile it is in the help menu. Remove screenshot keeps the current style. Clear local data in Help deletes the entire local workspace after confirmation.

## Tests and fixtures

```sh
npx playwright install chromium
npm test
```

`npm test` type-checks, runs Vitest domain/adapter tests, then runs the real interface in isolated Playwright Chromium contexts. It starts the dev server automatically or reuses localhost:3000 outside CI. CI starts its own server; keep port 3000 free. To use an existing Chromium binary, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

Coverage includes the three journeys, exact exported PNG dimensions and padding/background pixels, real promise-backed ClipboardItem encoding with a deterministic clipboard boundary fake, denied/unavailable/timed-out adapters, atomic storage/quota/conflict handling, corrupt and future schemas, terminal job transitions, pending-job recovery, a generated 4K drop under one second, rejected/forged image preservation, image loading races, refresh persistence, and a 390×844 mobile viewport. Adapter fakes use injected factories and timers; there is no fake production service. OS clipboard permission remains browser controlled.

```sh
npm run test:unit
npm run test:e2e
npm run build
npm run seed
```

Seed regenerates the checked-in `public/example.png`, a rejected-file fixture, and `tests/fixtures/recovery-state.json`. The latter contains an empty canvas, a representative saved preset, and an interrupted clipboard job. To demonstrate recovery, paste that JSON as a string into the browser’s Application → Local Storage value for `shinyshot:store`, then reload. It reports the interrupted export and converts it to a failed terminal result. No users or server database need seeding.

## Architecture and migrations

See [the technical plan](docs/architecture.md) for screens, schema constraints, lifecycle, transactions and scope decisions, and [the core contract](docs/core-contract.md) for adapter interfaces.

- `app/page.tsx` and `app/layout.tsx`: server-rendered route and shell; `components/editor.tsx` enhances the workflow that requires browser state.
- `app/privacy/page.tsx`: server-rendered privacy and retention explanation.
- `app/api/health/route.ts`: read-only diagnostic with a correlation ID.
- `lib/domain.ts`: normalization, dimensions and style choices.
- `lib/storage.ts`: validated repository for Composition, StylePreset and ExportJob. One atomic localStorage envelope; 24 presets and 20 export results maximum.
- `lib/migrations/`: ordered versioned migrations. Migration 001 initializes version 1. Startup applies upgrades in memory; a validated single write commits. Unknown/future/corrupt documents remain untouched. There are no SQL migrations because storage is explicitly browser local.
- `lib/image-format.ts`, `lib/browser.ts`, `lib/canvas.ts`: bounded raster input, normalized errors, timed image decoding/PNG/Clipboard adapters, and one renderer for preview and export.

The only durable browser key is `shinyshot:store`. Instants use UTC ISO-8601. There are no local schedules or timezone-specific calculations. Exports record pending → succeeded/failed; reloading interrupts unfinished attempts. Terminal records cannot be rewritten; explicit retries create new unique IDs. No automatic retry repeats download or clipboard side effects. Other-tab changes block stale writes and ask for a reload. Updates are atomic within a tab; localStorage cannot provide a distributed multi-tab transaction.

## Production and diagnostics

```sh
npm ci
npm run build
npm start
```

Deploy to a Node-compatible Next.js host. Use HTTPS for Clipboard support. Keep one stable origin: localStorage is scoped to scheme, hostname and port, so a domain/port change creates a different local workspace. No database provisioning, bucket, worker, OAuth callback, webhook or provider credential is needed.

`GET /api/health` returns `{ status, app, storage, requestId }`. Its structured server log contains only the random request ID and status. There are no screenshot, filename, preset, clipboard or request-body logs. Standard hosting access logs may still exist. Local export errors use bounded codes in job metadata and actionable UI messages; pending and success are announced to assistive technology.

Security headers restrict framing, MIME sniffing, network targets, objects, referrers and unnecessary permissions. Production CSP allows Next’s inline scripts/styles, but no third-party script or network hosts. Untrusted names render as escaped text; no markup, redirect, remote URL, upload, OAuth, email, webhook, CSV, attachment URL or user-owned server query exists. Server-side authorization, CSRF, token encryption and provider signature checks are inapplicable without those surfaces. Browser checks are enforced in the domain/repository and adapters, rather than relying on controls being disabled.

## Backup, deletion and recovery

Local retention lasts until explicit deletion, browser eviction, or profile cleanup; private windows commonly clear it at session end. The current screenshot is a normalized raster. Presets hold styles and neutral thumbnails, never screenshot content. Export files are not retained by the app; downloads and clipboard contents remain under the user’s control.

Before a migration or deployment, back up the browser profile, or copy the complete `shinyshot:store` value from browser developer tools to a private local file. It contains the image: do not commit it or send it to a server. Restore into the **same origin’s** localStorage and reload. Back up the current value before restoring. A bad/future schema is preserved and reported; use a matching app version or the confirmed clear-local-data action. Storage failures leave the last successfully written document intact and offer Retry saving. You can continue editing/exporting for the current session when storage is unavailable.

Migration rollback means restoring both the previous app release and that release’s local browser document. Do not run a destructive downgrade against newer data. Current version 1 needs no down migration. Reset style changes style only; Clear local data removes the composition, presets and job history. Deleting a preset leaves the composition intact. Removing an image releases its local data; there are no dependent remote files or cleanup jobs.

## Limits

Input is PNG/JPEG/WebP, up to 25 MiB, 40 megapixels and 16,384 pixels per edge. It is normalized to at most 4096 pixels per edge and a 2.5-million-character raster URL to fit storage; complex images may be compressed/resized further. Export is crisp at its exact dimensions, but upscaling cannot restore source detail. Preview resolution is capped and device-pixel-ratio aware to keep controls responsive. Performance depends on the browser/device; the acceptance benchmark runs against a generated 4K screenshot in Chromium.

Clipboard image support varies by browser, secure context and OS permission; denial offers PNG download. JavaScript and Canvas are required for editing, while server HTML includes the workflow, labels and a noscript explanation. No cloud sync, account recovery, undo history, arbitrary canvas sizes, marketplace, teams, video or offline service worker is included. Clearing browser data permanently removes the local workspace unless you backed it up.

Reference APIs: [Next.js server/client components](https://nextjs.org/docs/app/getting-started/server-and-client-components), [Clipboard write](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/write), [promise-backed ClipboardItem](https://developer.mozilla.org/en-US/docs/Web/API/ClipboardItem/ClipboardItem).
