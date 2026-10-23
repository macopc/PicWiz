# Data/render integration notes

Public APIs in `core-contract.md` are retained. Extra helpers: `Look`, `lookOf(style)`, `validateStore(value)`, `addAnnotation(list,item)`, `replaceAnnotation(list,item)`.

- `AnnotationHistory` is `{past: Annotation[][], present: Annotation[], future: Annotation[][]}`. `createHistory` accepts an optional initial list; every mutation returns independent validated annotation records. No-op history pushes keep the same object. The undo stack contains at most 50 edits.
- `loadStore` atomically adopts validated V1/legacy data into `picwiz:store` and preserves `shinyshot:store`. It also commits pending-job interruption recovery once. These writes can throw quota/unavailable/conflict errors; show the recovery UI and allow session-only editing. Empty initialization stays in memory until save.
- Both raw keys are snapshotted, including legacy changes after adoption. The UI must react to either key **and key=null** storage events, and guard async import/save/export generations across clear/import. `clearStore` deletes legacy first, then new, verifies both, never writes a new document itself, and blocks saves after a partial failure until successful clear or page reload.
- `backupLocalData` returns JSON `{app:'picwiz',type:'local-data-backup',version:1,createdAt,keys:{'picwiz:store':rawOrNull,'shinyshot:store':rawOrNull}}`; raw strings are preserved verbatim, even if corrupt. Reading either key can throw.
- `applyLook` also accepts `Look` in addition to full `Style`; output size and scale always come from the current composition. `updatePreset` updates only look fields and preserves stored format, ID, and creation time. Export with zero user presets throws `preset_empty` (the UI export action should be disabled).
- `layoutAnnotationText(context,text,width)` returns up to three wrapped text lines; renderer separately clips the annotation rectangle and screenshot rectangle. Font metrics use the context's current font.
- `downloadFile(blob,name,adapter?)` accepts PNG, JSON and ZIP and appends the correct extension; `downloadPng` retains the injectable adapter signature. Encoder busy failures use `png_busy`; cancellation uses `cancelled`. The lock subscription reports transitions, and must be paired with `isPngEncoderBusy()` for initial state.

## Data/render handoff validation

- Owned unit files (`domain`, `annotations`, `canvas`, `image-format`, `storage`, `storage-v2`, `migrations`, `browser`): **72 tests pass**. The browser file contains adapter unit tests; no browser/E2E suite was run by the data implementer.
- Scoped strict TypeScript check of owned modules and unit files: pass. `git diff --check`: pass.
- Last repository-wide `npm run typecheck` reports an unrelated concurrent UI error: `components/batch-export.tsx(97,67): TS2783: 'name' is specified more than once, so this usage will be overwritten.` Parent owns that file.
- Expected native limitation: if `toBlob` never invokes its callback, the global lock remains held until reload. Timeout/abort discard results and do not claim hard interruption.
- No production dependencies added; changes left uncommitted.
