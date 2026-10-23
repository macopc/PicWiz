# Interface screenshots

[Documentation](../README.md) · [Usage](usage.md)

The README images are actual V2 interface captures with the bundled, fictional Orbit dashboard. They are not generated mockups and do not show planned V3 features.

| Image | Captured state | Viewport |
| --- | --- | --- |
| [Desktop editor](../v2/screenshots/editor-desktop.png) | Default example, styling and export controls | 1440 × 900 |
| [Preset library](../v2/screenshots/presets.png) | Built-in looks and personal-preset controls | 1440 × 900 |
| [Batch dialog](../v2/screenshots/batch.png) | Current screenshot selected, format choices, Prepare ZIP | 1440 × 900 |
| [Phone layout](../v2/screenshots/editor-phone.png) | Responsive editor | 390 × 844 viewport |

These images were recorded during the V2 validation represented by commit `0704446`. A phone viewport capture is not evidence of physical-device testing. The [validation record](../v2/validation.md) states the browser and accessibility evidence limits.

## Update after an interface change

1. Build and start the app using the [development guide](development.md). Use a fresh browser context so private workspace data cannot appear.
2. Let the bundled example load automatically on first visit, or choose **Use example** on an empty canvas. Wait until the screenshot and local font have rendered and the status shows a settled workspace.
3. Capture the editor at 1440 × 900 and 390 × 844. Open **My presets** and **Batch export** for the corresponding desktop captures. Keep controls readable and avoid a focused tooltip obscuring them.
4. Replace the relevant PNGs in `docs/v2/screenshots/` only if they still describe V2. For a later implemented version, use a new versioned folder and update the README references.
5. Check every image at its displayed README size, update descriptive alt text and this provenance record, then run `npm run docs:check`.

Use fictional screenshots and names. Never commit browser profiles, local-data backups, real customer images, credentials, or traces from a private workspace. Keep screenshots representative of shipped behavior and avoid adding unimplemented controls through image editing.
