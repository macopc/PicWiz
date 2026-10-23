# Changelog

This log records repository milestones. Entries below do not imply that a GitHub release or version tag has been published.

## Unreleased

### Repository guidance

- Added an MIT license, third-party notices, bilingual README, real interface screenshots and usage/development/recovery/deployment guides.
- Added a documentation/specification index separating implemented V2 behavior from reviewed V3 plans.
- Added contribution, security, support and conduct guidelines, issue forms and a pull request template.
- Configured weekly Dependabot update proposals for npm packages and GitHub Actions. Updates require review; no automatic merge is configured here.
- Pinned CI actions to verified commits and added local documentation-target and platform-independent fixture-drift checks.

### Next stage — specification only

- [V3 specifications](docs/v3/spec.md) define a CMS-backed template gallery, explicit appearance-only account synchronization, and separate 3D and browser-video proofs of concept.
- These capabilities, dependencies, migrations and provider resources are not implemented. Earlier [research and proposals](docs/future/decisions.md) are background; the selected V3 specifications define the planned scope.

## V2 implementation milestone — 2026-10-23

Implemented in commit [`0704446`](https://github.com/macopc/PicWiz/commit/0704446), with [validation evidence](docs/v2/validation.md):

- Browser-local PicWiz editor with six starter looks, reusable personal style presets and appearance-only preset import/export.
- Arrows, rectangles and text annotations with session undo/redo; six output sizes at 1× and 2×.
- PNG download and clipboard support with a download fallback, plus bounded batch ZIP export, cancellation and partial-result recovery.
- Schema-2 local storage, legacy migration, private recovery backups and confirmed clearing of both current and legacy keys.
- Unit/adapter and cross-browser tests, accessibility checks and production health/security-header checks. Recorded runs and their limits are linked above; they do not establish physical-device or OS clipboard interoperability.
