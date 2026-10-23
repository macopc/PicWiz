# Contributing to PicWiz

Bug fixes, tests, documentation and focused improvements are welcome. Follow the [code of conduct](CODE_OF_CONDUCT.md), search [existing issues](https://github.com/macopc/PicWiz/issues), and discuss substantial changes before implementation. Send suspected vulnerabilities through [private security reporting](SECURITY.md).

## Scope and source of truth

- The implemented app is V2: a browser-local screenshot editor. Preserve its local-only data boundary unless a reviewed scope change explicitly updates it.
- [V2 spec, including R1–R5](docs/v2/spec.md), defines current behavior. [Architecture](docs/architecture.md), [data model](docs/data-model.md) and the [V2 integration contract](docs/v2/core-contract.md) describe implementation details. The root `docs/core-contract.md` is historical V1 material.
- [V3 spec](docs/v3/spec.md) and its linked specifications describe the next stage, not shipped functionality. Gallery, accounts, 3D and video are not implemented. For that work, the V3 shared rules take precedence over its domain specifications; older proposals in `docs/future/` do not override the selected plan.
- Resolve conflicting requirements in the relevant spec before coding. Update documentation and validation evidence when behavior changes.

Read [AGENTS.md](AGENTS.md) before changing Next.js code. After installing dependencies, read the relevant guide in `node_modules/next/dist/docs/`; this repository's installed Next.js version can differ from familiar APIs and conventions. Keep the generated AGENTS guidance.

## Setup and verification

Use Node.js 24 LTS and npm. No service credentials or environment file are required for V2.

```sh
npm ci
npx playwright install --with-deps chromium firefox webkit
```

The complete test command is:

```sh
npm test
```

It runs TypeScript checks, Vitest unit/adapter tests and Playwright browser tests. Chromium runs the full browser suite; Firefox and WebKit run `@critical` cases. Local Playwright starts or reuses the development server on port 3000; leave it free unless deliberately testing an existing app. See [README testing instructions](README.md#develop-and-test) for the development guide and environment overrides.

For targeted feedback, use `npm run typecheck`, `npm run test:unit` or `npm run test:e2e`. Run `npm run build` for application changes. State the commands you actually ran and any skipped checks; documentation-only changes can be checked for accuracy, links and formatting without starting the app.

For documentation changes, run `npm run docs:check`. It checks local file links and image references in Markdown and HTML; review heading fragments and external links separately.

## Changes and pull requests

1. Work on a branch and keep the change focused. Link the issue or relevant spec and describe the user-visible result.
2. Add or update meaningful tests for changed behavior, particularly storage migration, recovery, rendering and asynchronous interactions. Use fictional fixtures; `npm run seed` regenerates the repository's demo fixtures.
3. For UI changes, include before/after screenshots at desktop and narrow mobile widths, including affected error or empty states. Explain keyboard/accessibility behavior when it changes.
4. Describe effects on storage, backups, exports, dependencies and network requests. Do not silently add uploads, telemetry or external services.

Never attach real private screenshots, raw local-storage dumps, recovery backups, clipboard contents, secrets or identifying filenames to issues, pull requests, logs or test artifacts. Use the bundled example or synthetic images. Annotations are not a redaction tool; replace sensitive source material before capturing evidence.

Contributions are provided under the project's [MIT license](LICENSE). Only contribute code and assets you have the right to share.
