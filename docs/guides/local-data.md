# Local data, backups, and recovery

[Documentation](../README.md) · [Usage](usage.md) · [Deployment](deployment.md)

## Ownership and retention

PicWiz V2 uses browser localStorage, with no server database or image upload. The ownership boundary is the **browser profile plus origin** (scheme, host, and port). People sharing a profile share its saved workspace. Changing `http` to `https`, a hostname, or a port opens a different storage area; it does not migrate the existing one.

Two keys matter:

- **`picwiz:store`** holds the active schema-2 workspace: one current normalized screenshot, style, annotations, up to 24 personal presets, and the last 20 export-job records.
- **`shinyshot:store`** may retain the original V1 workspace as an unchanged migration/rollback backup. It can contain an older screenshot even after the current V2 screenshot is removed.

Only the current image persists in the active workspace. Undo/redo history, extra batch files, decoded images, PNG blobs, and ZIPs are session-only. Export-job records contain metadata, not files you can download again. Pending exports found after reload become failed with `interrupted`; a reload cannot recover batch inputs or results.

Data remains until confirmed deletion, browser eviction, or profile cleanup. Private windows commonly discard it on close. There is no retention timer, cloud backup, account recovery, or full-workspace import screen. Keep originals and important downloads separately.

## Understand deletion controls

**Reset style to defaults** restores default appearance and output settings (Landscape, 1×). It retains the current screenshot, annotations, presets, and export history.

**Remove screenshot** asks for confirmation, removes the current V2 source and annotations, and clears annotation undo history. It retains the style, presets, history, and `shinyshot:store` backup.

**Clear local data**, available under **Help and privacy** or the saving-error notice, asks for confirmation. It removes `shinyshot:store` first, then `picwiz:store`, and verifies that both are absent. Unrelated site keys are left alone. The UI may subsequently save a fresh empty workspace. If clearing only partly succeeds, it reports an error and blocks saving until a successful clear or reload; do not assume deletion completed.

None of these controls deletes original files, downloaded images/archives, or clipboard contents. Without a backup, browser deletion cannot be undone.

## How V1 migration is protected

The ordered `001` → `002` migrations validate frozen V1 data before creating schema 2. The loader adopts `shinyshot:store` only if `picwiz:store` is absent. It preserves the old raw legacy value and writes a fully validated new envelope. If the new key exists but is corrupt or from a future schema, PicWiz blocks saving rather than silently falling back to the old workspace.

Migration preserves the source, compatible IDs, preset names, and timestamps. V1 padding and radius are converted to output pixels with rounding, so geometry can differ slightly. V2 presets apply appearance only, retaining the current size and scale. Startup adoption/migration and pending-job recovery may write once; an empty new workspace stays in memory until saved.

Both raw keys participate in conflict detection. A change from another tab requires **Reload** before saving; localStorage does not provide a cross-tab transaction guarantee. Close other editor tabs before restore, demo fixture installation, or release rollback.

## Respond to a saving error

**Local saving needs attention** offers **Backup local data**, **Session-only editing**, **Retry saving** or **Reload**, and confirmed **Clear local data**.

- For `storage_quota` or unavailable storage, save a private backup if possible, free site space or enable storage, then retry. **Session-only editing** allows editing/PNG export without durable changes.
- For `storage_conflict`, reload to load the other tab's workspace before saving again.
- For corrupt or future-version data, preserve the raw backup before choosing a compatible release or clearing.
- After a partial clear failure, retry clearing or reload; saving stays blocked until recovery.

Exporting an image does not require a successful local save. Session-only changes disappear on reload. An unreadable storage area cannot be backed up through the app.

## Make a private backup

In recovery, choose **Backup local data** to download `picwiz-local-backup.json`. It wraps both persisted raw values without parsing them, so even damaged JSON is preserved. It does not capture unsaved session edits:

```json
{
  "app": "picwiz",
  "type": "local-data-backup",
  "version": 1,
  "createdAt": "<UTC timestamp>",
  "keys": {
    "picwiz:store": "<exact raw workspace string>",
    "shinyshot:store": null
  }
}
```

The placeholders above describe the format, with the legacy key absent in this example. Either value can be an exact raw string or JSON `null` for an absent key, never the string `"null"`. Backups can include your screenshot, names, annotations, and damaged browser data. Keep them private; do not attach real backups to public issues.

Outside recovery, copy both exact raw values from developer tools → Application/Storage → Local Storage, recording an absent key as `null`, or back up the browser profile before changing releases. **Export presets** is useful for moving looks, but it excludes images, annotations, and history and is not a full backup.

## Restore manually on the same origin

There is no backup import screen. Restoration replaces data rather than merging it:

1. Close other PicWiz tabs and privately back up both current values.
2. Open PicWiz on the original scheme, host, and port. In developer tools, select that origin's Local Storage.
3. Read the backup wrapper as JSON. For each entry in `keys`, set that storage key to its corresponding **raw string value**, or remove the key if its value is `null`. Preserve the string's decoded contents; do not include the surrounding JSON quotes or escape sequences.
4. Reload PicWiz. Use a compatible release for newer/unknown schemas. If validation reports an error, retain the backup and inspect compatibility before clearing anything.

Do not paste the entire backup wrapper into `picwiz:store`, import it as presets, or change a schema version number to force acceptance. A corrupt new key continues to take precedence over a valid legacy key until you explicitly reconcile the snapshots.

## Roll back carefully

Rolling back to V1 needs both previous code (baseline `09179ae`) **and compatible V1 data**. There is no schema-2 down migration. Preserve both raw keys before changing releases; the retained `shinyshot:store` document contains no later V2 edits.

After editing in V1, returning to V2 still gives an existing `picwiz:store` precedence. Back up both snapshots and explicitly decide which to retain before removing either key. Removing the new key allows legacy adoption again, replacing the active V2 workspace with that older snapshot; it does not merge the two.

This guide describes the implemented V2 two-key store. The additional schema, keys, and cloud records described in [V3](../v3/spec.md) are specifications only and are not part of current recovery behavior. See the [data model](../data-model.md) and [architecture](../architecture.md) for the validation and concurrency contracts.
