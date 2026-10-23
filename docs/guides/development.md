# Development and validation

[Documentation](../README.md) · [Usage](usage.md) · [Deployment](deployment.md)

## Set up locally

Use **Node.js 24 LTS**, npm, and a current browser. V2 needs no `.env` file, API key, database, authentication provider, bucket, or worker. Fonts and the fictional example are bundled assets.

```sh
git clone https://github.com/macopc/PicWiz.git
cd PicWiz
npm ci
npm run dev
```

Open <http://localhost:3000>. Optional process variables are documented in [`.env.example`](../../.env.example). Playwright reads its variables from the test process; putting them only in a Next.js environment file does not configure the test runner.

Read [CONTRIBUTING.md](../../CONTRIBUTING.md) and the repository's [AGENTS.md](../../AGENTS.md) before changing code. This project uses Next.js 16.4.2; the installed `node_modules/next/dist/docs/` guides are the reference for its current APIs and conventions.

## Find the implementation

- `app/`: App Router shell, editor route, privacy page, and `GET /api/health`.
- `components/editor.tsx`: current composition, imports, persistence/recovery, and single-image export.
- `components/preset-library.tsx`, `annotation-layer.tsx`, `social-sizes.tsx`, and `batch-export.tsx`: the corresponding editor surfaces.
- `lib/domain.ts`, `annotations.ts`, and `canvas.ts`: styles, dimensions, annotation rules/history, and the shared preview/export renderer.
- `lib/browser.ts` and `image-format.ts`: bounded raster import, native PNG encoding, clipboard, and downloads.
- `lib/storage.ts` and `lib/migrations/`: validated schema-2 localStorage, versioned migration, preset files, conflict handling, and job metadata.
- `lib/batch.ts` and `zip.ts`: bounded serial batch execution and the ZIP32 writer. `fflate` is a development dependency used for independent ZIP verification, not a production ZIP dependency.
- `tests/unit/` and `tests/e2e/`: unit/adapter tests and browser journeys.

Read [architecture](../architecture.md), [data model](../data-model.md), and the [V2 specification](../v2/spec.md), including R1–R5, before modifying behavior. [V2 core contracts](../v2/core-contract.md) describe the implemented integration APIs; `docs/core-contract.md` is the older V1 reference. The [V3 specification](../v3/spec.md) is future work, not an implemented dependency or schema.

## Run checks

```sh
npm ci
npx playwright install --with-deps chromium firefox webkit
npm test
```

`npm test` runs strict typecheck → Vitest unit/adapter tests → Playwright browser tests. Individual commands are:

```sh
npm run typecheck
npm run test:unit
npm run test:e2e
npm run docs:check
npm run build
```

`npm run docs:check` uses a dependency-free Node script to check Markdown/HTML local file links and image references. It does not check remote URLs or heading fragments. CI runs it as a separate step; it is not part of `npm test`.

Locally, Playwright starts or reuses the development server at port 3000. Keep the port free unless you intentionally want to test an existing app. Each test has an isolated browser context and local storage; one worker bounds concurrent rendering and timing interference.

Chromium runs the complete suite. Firefox and WebKit run the `@critical` journeys. A custom Chromium binary can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; this does not install or replace Firefox/WebKit. Failure screenshots and retained traces are written under `test-results/`.

Do not run `next dev` and `next build` concurrently in the same checkout: both use `.next`. To test production, stop that checkout's development server and any older production instance first. In terminal 1:

```sh
npm run build
PORT=3001 npm start
```

In terminal 2, wait for the server to be ready and verify its health response. Run the tests only after the health request succeeds and identifies PicWiz V2:

```sh
curl --fail --show-error http://127.0.0.1:3001/api/health
CI=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 npm test
```

Setting `PLAYWRIGHT_BASE_URL` disables Playwright's own server startup **and readiness wait** entirely. You must start and check the intended server; the matching port and URL above help avoid testing an old process on port 3000. `CI=1` enables the configured CI retry policy; report retries when recording results.

The [CI workflow](../../.github/workflows/ci.yml) installs Node 24, runs the documentation check, installs all three browser engines, regenerates and checks synthetic fixtures, builds the app, starts production, verifies health/security headers and rejected POST, then runs the same `npm test` command. Workflow configuration is not proof that a remote GitHub run has passed.

## Regenerate fictional fixtures

```sh
npm run seed
```

Seed uses `sharp` locally and writes only synthetic repository assets. It does not install data in the browser, call a remote service, or use personal screenshots. Keep development dependencies installed to run seed, tests, and builds.

Raster generation uses the host's Arial/Helvetica/sans-serif fonts. PNG bytes and workspace fixtures embedding those PNGs can differ between operating systems. CI checks byte consistency only for the platform-independent V1 fixtures, empty V2 store and appearance-only preset file; it does not require Ubuntu to reproduce macOS raster bytes. Avoid committing incidental regenerated-image changes with an unrelated patch.

It regenerates:

- `public/example.png`, the bundled **Use example** image.
- The preserved V1 files `tests/fixtures/recovery-state.json` and `tests/fixtures/not-an-image.txt`.
- The three PNG sources and invalid-file fixture under `public/fixtures/`.
- V2 happy, empty, failed, and interrupted workspace JSON, a V1 legacy workspace, and appearance-only `style-presets.json` under `public/fixtures/`.

See the [fixture instructions](../../public/fixtures/README.md) for manual demos. A quick batch example uses `dashboard.png`, `release-notes.png`, and `analytics.png` with Landscape and Square at 1×: expect six PNGs in the ZIP. Workspace fixture JSON replaces local data when manually installed; use a separate profile and follow the [backup guide](local-data.md) first. Store JSON is neither a preset import file nor Playwright `storageState`.

Existing E2E tests use the V1 recovery fixture and generated in-memory images. Public V2 demo documents are manual inputs; their existence does not imply automated coverage.

## Record evidence accurately

The [V2 validation record](../v2/validation.md) documents the completed baseline, including its actual production build, 110 unit/adapter tests, and 57 browser cases. Consult that record for the tested revision, engine scope, review outcomes, and limitations; rerun the relevant checks for new changes.

Tests verify real PNG dimensions/pixels, all twelve size/scale combinations, appearance presets, annotation ink/geometry, independently extracted ZIPs, migration/recovery, races, keyboard behavior, a mobile browser viewport, and axe accessibility scans. Keep the following boundaries explicit:

- Clipboard adapter tests stub the OS write boundary; they do not prove real OS clipboard or trusted paste interoperability.
- A 390 × 844 browser viewport is not a physical Safari/iOS/Android device test.
- Axe is not a full manual screen-reader audit.
- Desktop synthetic 4K/timing runs are not phone performance or peak-memory guarantees. The 64 MiB retained-PNG budget is not a browser RSS bound.

There is no offline service worker, server image-processing path, or resumable remote job. Do not add an upload, provider credential, or account requirement to the local V2 workflow based solely on future specifications.
