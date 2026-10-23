# PicWiz V2 local data model

There is no SQL database. `lib/storage.ts` validates a single schema-2 JSON envelope in `picwiz:store`; `shinyshot:store` remains an optional unmodified V1 backup. [Spec R1–R5](v2/spec.md) and the current library APIs are authoritative. All timestamps are canonical UTC ISO-8601 instants. Bounded arrays need no database indexes.

## Workspace envelope — version 2

Root fields are exactly `version`, `composition`, `presets`, `jobs`. Unknown fields and noncanonical styles are rejected rather than repaired when loading/saving. One `setItem` commits a complete validated envelope; storage can fail or be evicted.

**Composition** is the singleton `id:current`, with `createdAt`, `updatedAt`, `status:empty|ready`, `source`, `style`, `annotations`. Empty requires `source:null` and `annotations:[]`. Ready requires a bounded normalized raster source `{dataUrl,name,width,height}`; the name is at most 120 characters. Only this current image persists. Bad imports leave it intact; successful replacement/removal clears annotations and session history.

**Style** contains `background,padding,radius,shadow,frame,appearance,size,scale`. Background/frame/appearance/size use allowlists; integer padding is 0–200, radius 0–48, shadow 0–100, scale 1 or 2. Sizes are landscape 1600×900, square 1080×1080, portrait 1080×1350, story 1080×1920, linkedin 1200×627 and pinterest 1000×1500. V2 padding/radius use 1× output pixels. A **Look** omits `size` and `scale`; applying/updating a preset copies only its look.

**Annotations** are at most 30 ordered records with exactly `id,type,x,y,width,height,color,stroke,text,fontSize,flipX,flipY`. IDs are unique bounded strings; type is arrow/rectangle/text. Coordinates are finite fractions inside the screenshot, width/height ≥0.02, and the whole box must fit [0,1]. Six allowlisted colors, stroke 2/4/8 and font size 0.022/0.03/0.045 are supported. Flip fields are booleans. Text is plain, ≤140 characters/three input lines, with at most three rendered lines and clipping. Non-text records have empty text and default font size 0.03. No HTML or redaction guarantee. Undo/redo is session-only, bounded to 50 edits.

**StylePreset** has `id,name,style,createdAt,updatedAt`; at most 24 personal presets. New IDs are UUIDs; compatible V1 bounded IDs survive migration. Names use NFKC, trimmed/collapsed whitespace, 1–40 characters and case-insensitive uniqueness. Updating preserves ID/creation time/stored output format. Deleting a preset does not mutate the composition. Six built-in looks are code-defined, not copied into this array. Neutral thumbnails are rendered on demand and store no user screenshot.

**ExportJob** has `id,compositionId,kind,status,createdAt,completedAt,width,height,error,formats,scale,total,completed,failed`. `compositionId` is always `current`; IDs are unique idempotency keys. Kind is download/clipboard/batch; status is pending/succeeded/failed/cancelled. `formats` is 1–3 unique supported sizes, scale 1/2, total 1–30; single exports require one format and total 1. Width/height describe the first submitted format at its scale. Counts are nonnegative integers with completed+failed ≤total; noncancelled terminal results require equality. Succeeded requires failed=0/error=null. A ZIP failure may have completed=total, failed=0 and error=zip_failed.

Pending has no completion instant/error. Submission fields are immutable; pending counts cannot decrease; terminal records cannot be rewritten. A retry creates a new job ID. Only appending new attempts can trim the oldest records to 20; confirmed clear removes history. Reload marks pending as failed/interrupted with failed=total−completed and commits recovery once. Job counts cover this attempt, not every result merged into a retry ZIP. No source bytes or PNG/ZIP blobs live in jobs.

## Versioned migration and deletion

Migration 001 uses frozen V1 defaults; 002 strictly validates V1, adds annotations/job fields, infers old size/scale from exact dimensions, and rounds padding/radius × old base width/1600. Source, preset IDs/names and timestamps remain; geometry may differ slightly. New initialization follows both migrations. Load adopts legacy only if the new key is absent, fully validates and writes the new key atomically; legacy remains unchanged. An existing corrupt/future new document blocks fallback and stays available for backup.

Both raw values participate in conflict detection, including legacy changes after adoption. LocalStorage offers no distributed transaction across tabs. Clear removes legacy first, then current, verifies both absent and blocks saving after partial failure. `clearStore` itself writes no empty document. Remove screenshot only removes the current V2 source/annotations; reset style restores default appearance and output settings (landscape, 1×) while retaining image/annotations. Original files, downloads and clipboard contents are not deleted.

## Portable files and transient batch data

Preset JSON is **version 1**: `{app:'picwiz',type:'style-presets',version:1,presets:[{name,style:Look}]}`. It excludes image, annotations, output size/scale, IDs and timestamps. Limit 100 KiB and 1–24 entries; strict validation and capacity checks precede a single commit. Same candidate name/look skips; differing looks receive deterministic truncated ` (2)` suffixes. Re-importing a file is idempotent. Zero saved presets cannot export a file.

Raw local backup is independently **version 1**: `{app:'picwiz',type:'local-data-backup',version:1,createdAt,keys:{'picwiz:store':rawOrNull,'shinyshot:store':rawOrNull}}`. Strings are not parsed, so corrupt data survives. This can contain private images. There is no full-backup importer: restore individual raw values manually at the same origin, removing null keys. No down migration exists. Retained V1 data lacks subsequent V2 edits; see [rollback instructions](../README.md#local-retention-backup-and-recovery).

Batch plans, File references, stable `(sourceIndex,size)` pairs, attempt rows and successful Blob results are memory-only. Plans freeze source metadata/current annotations, style, scale and format order. Other sources have no inherited annotations. Limits are 10 sources/3 sizes/30 pairs, 150 MiB original input, cumulative 64 MiB accepted PNGs and 65 MiB ZIP. Closing/reloading loses this data. Cancellation can preserve accepted results until explicit packaging or session disposal; retry reuses successful blobs and the same cumulative budget.

ZIP manifest is **version 2**, named `picwiz-manifest.json`: app, createdAt, planId, scale, attempts and entries. Entries record stable pair ID, source index, sanitized path, size/dimensions/status/error/attempt ID. PNG paths look like `01-source-name/landscape-1600x900.png`; source stems are ASCII and bounded to 60 characters. The manifest excludes data URLs, input bytes and annotations; PNG pixels contain rendered annotations and sanitized paths may reveal filenames. Keep exported archives private as appropriate.

Browser/profile cleanup or eviction can remove all local records. No retention timer, cloud backup, server audit trail, account recovery or resumable remote export exists. [Synthetic fixtures](../public/fixtures/README.md) exercise these document shapes without real user content.
