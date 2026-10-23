# Using PicWiz

[Documentation](../README.md) · [English README](../../README.md) · [中文说明](../../README.zh-CN.md)

PicWiz V2 styles and annotates screenshots locally in your browser. Start the app with the [development guide](development.md) and open the editor. A first visit automatically loads the bundled fictional example; an existing local workspace is restored instead. **Use example** appears when the canvas is empty. No account or environment file is required.

## Import a screenshot

Choose **Add screenshot** or **Choose screenshot**, drop one file onto the canvas, or paste an image with `⌘V` / `Ctrl+V`. Dropping multiple files rejects the whole drop; use batch export for multiple inputs. Use **Replace** below the canvas to select another image. Paste does not replace the canvas while a dialog, batch panel, or text input is active.

Inputs must be nonempty PNG, JPEG, or WebP files with matching file signatures and any supplied MIME type. Each file may be at most 25 MiB, 40 megapixels, and 16,384 pixels on either edge. SVG, GIF, PDF, remote image URLs, and video are not supported inputs.

The importer normalizes the image to at most 4096 pixels per edge and a raster data URL of at most 2,500,000 characters, resizing or compressing further when needed. Keep your original file: this local editing copy is not a lossless archive. Invalid imports leave the current composition intact. Successful replacement clears the previous image's annotations and annotation undo history while keeping your style.

## Choose and reuse a look

In **Style**, choose a **Background** under **Gradient** or **Solid color**, adjust **Padding**, **Corner radius**, and **Shadow**, then choose a **Frame**: **No frame**, **Browser**, or **Device**. Frame **Appearance** can be **Light** or **Dark**. On narrow screens the controls are grouped under **Style**, **Frame**, and **Annotate**.

Open **My presets** in the header or **All looks** in the style panel. The six built-in looks are Studio, Paper, Midnight, Mint, Sunset, and Ocean. Applying a built-in or saved look changes appearance only; it keeps your screenshot, annotations, output size, and scale. Library thumbnails use a neutral illustration rather than your screenshot.

To save your own look:

1. Adjust the current appearance and choose **Save preset**, or **Save current style** in the library.
2. Enter a **Preset name** and confirm **Save preset**. Names are 1–40 characters, with normalized whitespace and case-insensitive uniqueness. You can keep up to 24 personal presets.
3. Reapply the saved look from **My presets**. Use **Update** to replace its appearance with the current look, then confirm **Update preset**. **Rename** and the delete control also open confirmation dialogs. Deleting a preset leaves the canvas unchanged.

**Export presets** downloads the personal library as appearance-only JSON; it is disabled when the library is empty. **Import presets** accepts PicWiz preset JSON, up to 100 KiB and 1–24 entries. It contains no screenshot, annotations, output size, or scale. Validation and capacity checks apply to the entire import before committing. Reimporting the same names and looks skips duplicates; a conflicting name with a different look receives a numbered suffix. A workspace backup is a different format and cannot be imported here.

**Reset style to defaults** resets appearance and output settings to Landscape at 1×. It keeps your screenshot, annotations, saved looks, and history.

## Add annotations

The canvas toolbar has **Arrow**, **Rectangle**, and **Text** buttons, with accessible names **Add arrow**, **Add rectangle**, and **Add text**. Add a mark, then select it on the canvas or in the **Annotate** layer list.

Drag a selected mark to move it. The properties panel exposes **X**, **Y**, **Width**, and **Height** as percentages of the screenshot; use these fields to resize or place it precisely, with a minimum width/height of 2%. Choose **Color**, **Line weight**, or **Label size** as appropriate. Arrows also have **Flip X** and **Flip Y** controls. Marks remain anchored to the screenshot when you change the output composition.

Focus a mark on the canvas (for example, using `Tab`) to use its movement/deletion keys:

- Arrow keys move it by 1% of the screenshot; `Shift` + arrow moves it by 5%.
- `Delete` / `Backspace` removes it. You can also use **Delete annotation** in the properties panel.

Outside text/select controls and open dialogs, `⌘Z` / `Ctrl+Z` undoes an annotation edit; `⌘⇧Z` / `Ctrl+Shift+Z` redoes it. The toolbar also exposes **Undo annotation** and **Redo annotation**.

There are at most 30 annotations and 50 undoable annotation edits in the current session. Undo history does not include style changes and does not survive reload. Text is plain text, limited to 140 characters and at most three rendered lines. It wraps and clips inside its box; enlarge the box if the fit feedback reports clipping. All annotation ink clips to the screenshot. Selection controls are excluded from exports.

Annotations explain an image; they are not a redaction tool. Remove sensitive content from the source before importing it.

## Choose a size and export

Use **Output size** or **Sizes** (accessible name **Browse social sizes**) and choose **Scale** (**Export scale**) at 1× or 2×. The 1× dimensions are:

- **Landscape:** 1600 × 900.
- **Square:** 1080 × 1080.
- **Portrait:** 1080 × 1350.
- **Story:** 1080 × 1920.
- **LinkedIn:** 1200 × 627.
- **Pinterest:** 1000 × 1500.

At 2× both dimensions double. These are composition options, not a guarantee of platform acceptance or cropping behavior. PicWiz aspect-fits the whole screenshot rather than cropping it to fill the canvas. Canvas zoom changes the viewing scale only.

Choose **Export PNG** to download, or **Copy image** to copy the same rendered PNG. Preview, download, clipboard, and batch share one renderer. Clipboard image support requires a secure context (HTTPS or localhost), PNG clipboard capabilities, and browser/OS permission. If copy fails, download with **Export PNG**. Automated clipboard adapter tests do not establish real OS clipboard interoperability.

## Prepare a batch ZIP

1. Set the look you want, then open **Batch export** in the header.
2. Select **Include current screenshot** to include the current image and its annotations. Use **Add screenshots** (file input: **Batch screenshots**) for other local files. Additional files share the look but get no annotations from the current image.
3. Select 1–3 sizes under **Choose your sizes**, and choose **Export scale** (**Batch scale**). The footer shows the number of sources × sizes.
4. Choose **Prepare ZIP**. PicWiz freezes the sources, look, annotations, size order, and scale for that batch and renders serially. Preparation does not start a download.
5. When ready, choose **Download ZIP**. Paths are unique and numbered, for example `01-dashboard/landscape-1600x900.png`. `picwiz-manifest.json` records dimensions, statuses, errors, and attempt metadata. Filenames may reveal source names; the PNGs include the rendered annotations.

Limits apply to the whole batch:

- 10 sources, including the current screenshot, and 150 MiB of original-file input.
- 3 sizes and 30 output PNGs; the individual import limits still apply.
- 64 MiB of accepted PNG blobs, accumulated across retries, and a 65 MiB ZIP.

The output budget bounds retained PNGs, not total browser memory. Decoding, canvases, native encoding, and ZIP assembly can temporarily use more. After a resource-limit error, choose **Start a smaller batch** and reduce sources, sizes, or scale.

Partial failures retain successful PNGs. **Retry failed** appears for retryable errors, uses the original snapshot, and reuses earlier successes. Invalid files require **Change inputs** or a new batch. If ZIP packaging fails, **Prepare ZIP again** packages the existing PNGs without rendering them again.

**Cancel export** stops new work and automatic download. After the current browser operation settles, **Download completed results** can prepare a ZIP from successful outputs; use **Download ZIP** afterward. Browser-native PNG encoding cannot be forcibly interrupted. A 15-second application timeout or cancellation leaves the encoder locked until its native callback finishes; reload if it never responds.

Closing the batch panel discards its files and results; reopening or refreshing requires adding the files again. Export history stores metadata only and cannot restore batch files or downloads.

## Saving and recovery

The save status appears beside **Ready when you are**. When local saving fails, **Local saving needs attention** offers **Backup local data**, **Session-only editing**, **Retry saving** or **Reload**, and confirmed **Clear local data**. You can continue editing and export PNGs without a successful local save, but session-only changes disappear on reload.

**Remove screenshot** clears only the current image and annotations. It retains your style, presets, history, and any legacy backup. Read the [local data guide](local-data.md) before clearing, restoring, or changing releases; it covers both localStorage keys and backups that may contain private images.

V2 has no accounts, cloud image upload, gallery templates, 3D renderer, or video export. Sanity, Clerk, and the other [V3 plans](../v3/spec.md) remain specifications.
