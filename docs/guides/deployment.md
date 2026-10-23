# Deploying and diagnosing PicWiz

[Documentation](../README.md) · [Development](development.md) · [Local data and recovery](local-data.md)

## Run production

Use a Node-compatible Next.js host with **Node.js 24 LTS** and HTTPS. V2 needs no environment file, runtime secret, database, object storage, auth callback, webhook, or worker. Install development dependencies for the build, seed, and tests.

```sh
npm ci
npm run build
PORT=3001 npm start
```

`npm start` runs the production Next.js server on port 3000 by default, listening on `0.0.0.0`; this guide explicitly selects port 3001 to distinguish the production instance from a local development server. See [`.env.example`](../../.env.example) for process-level overrides. Stop any development server or previous production instance using this checkout before building: do not run dev and build concurrently against the same `.next` directory. Put the server behind your host's HTTPS termination and verify its proxy preserves the response headers. A static export is not configured.

Keep a stable origin for users who want the same browser workspace. A hostname, port, or scheme change creates a different localStorage scope; a deployment does not migrate browser data between origins. Before release changes or rollback, follow the [private backup and restore guide](local-data.md). A healthy server cannot restore evicted client data.

## Check health and headers

```sh
curl --fail --show-error -i http://127.0.0.1:3001/api/health
curl -I http://127.0.0.1:3001/
```

`GET /api/health` returns HTTP 200 with:

```json
{
  "status": "ok",
  "app": "picwiz",
  "version": 2,
  "storage": "browser-local",
  "requestId": "<random UUID>"
}
```

The response sets `Cache-Control: no-store` and `X-Request-ID` matching the JSON. The route checks server liveness; it does not test browser localStorage, clipboard permission, image codecs, or device memory. Unsupported POST requests return 405.

[`next.config.ts`](../../next.config.ts) configures these headers for application routes:

- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: no-referrer`.
- `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'`.
- A Permissions-Policy disabling camera, microphone, and geolocation, with clipboard writes restricted to self.
- A Content-Security-Policy keeping scripts, styles, fonts, connections, and assets same-origin, with local `data:`/`blob:` image sources. Objects are blocked; base URI and form actions are same-origin. Production permits Next.js inline scripts/styles. Development additionally permits framework eval and WebSocket connections.

Verify headers at the public HTTPS URL after deployment, not only on the local server. Host/proxy configuration can change them. No third-party scripts, remote fonts, or analytics are included in V2. There is no offline service worker; JavaScript and Canvas are required for editing.

## Validate a release

The [CI workflow](../../.github/workflows/ci.yml) installs the locked dependencies, checks local documentation links, installs all three browser engines, regenerates and checks synthetic fixtures, builds production, verifies health/security headers and rejected POST, then runs `npm test` against that server. To reproduce locally, install browsers as shown in the [development guide](development.md) and run the production commands above in terminal 1. In terminal 2, wait for startup and run the tests only after a successful health response identifies PicWiz V2:

```sh
curl --fail --show-error http://127.0.0.1:3001/api/health
CI=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 npm test
```

`PLAYWRIGHT_BASE_URL` completely disables Playwright's server startup and readiness wait; you are responsible for checking the intended server, and its URL must match the port above. This runs typecheck, unit/adapter tests, the full Chromium suite, and critical Firefox/WebKit journeys. The [V2 validation record](../v2/validation.md) records previous actual results; CI configuration alone does not establish a passed remote run. Physical Safari/iOS/Android, OS clipboard interoperability, and low-memory devices require separate checks.

## Diagnose problems without collecting images

Check `/api/health` first, then the browser's recovery message and export error code. Useful cases are:

- **`storage_quota` / `storage_unavailable`:** make a private local backup when readable, free storage or enable it, then retry; session-only editing and PNG export remain possible.
- **`storage_conflict`:** another tab changed the workspace; reload before saving.
- **Corrupt / future schema:** preserve both raw storage keys, then use a compatible release or explicitly clear. Do not replace the new key with legacy data automatically.
- **`interrupted`:** a persisted pending job was found after reload; start a new export. Job history cannot recover PNGs, ZIPs, or batch inputs.
- **`clipboard_unavailable` / `clipboard_denied`:** check HTTPS/localhost and browser permissions, then use **Export PNG** as the fallback.
- **`png_busy` / `png_timeout`:** wait for the native encoder callback. Application timeout or cancellation does not forcibly terminate native encoding; reload if it never settles.
- **Batch resource limit:** reduce sources, sizes, or scale. The retained-PNG budget is not a total memory guarantee.
- **`zip_failed`:** keep the batch panel open and choose **Prepare ZIP again** to package already completed PNGs.

The health log contains only its event, random request ID, and status. Hosting access logs may still exist. Do not add screenshots, filenames, annotation text, preset contents, clipboard data, or raw local backups to server logs or public issue reports. Follow [SECURITY.md](../../SECURITY.md) for vulnerability reports.

V2 has no Sanity, Clerk, 3D, video, or cloud-sync runtime to deploy. Those capabilities are described only in the [V3 specification](../v3/spec.md); their proposed providers and resources are not prerequisites for this release.
