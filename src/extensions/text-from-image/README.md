# Text from Image

Reads the text out of a screenshot, photo or scan and converts it to **plain
text, JSON, CSV, an Excel workbook or a PDF**. Recognition runs entirely
on-device, through whatever OCR the operating system already ships; nothing is
uploaded anywhere.

Storage: `<userData>/extensions/text-from-image.json` — 100 unpinned
recognitions (oldest dropped), 20 pins (never dropped). Only the thumbnail and
the recognized text are kept, never the source image's full bytes.

## Engines

| Platform | Engine                              | Confidence | Notes                                                                  |
| -------- | ----------------------------------- | ---------- | ---------------------------------------------------------------------- |
| Windows  | `Windows.Media.Ocr` (`@magibar/win`) | not reported | Needs a language pack with its **Optical character recognition** feature |
| macOS    | Vision `VNRecognizeTextRequest` (`@magibar/mac`) | per line   | No permission prompt; the recognizer behind Live Text                   |
| Linux    | `tesseract` binary                   | per word   | `sudo apt install tesseract-ocr`; not bundled                           |

Every engine is optional. When one is missing the screen says which one and
what to do about it, rather than failing at the moment you press Enter.

Rebuild an addon after changing its Rust: `npm run build:native:win` /
`:mac` / `:linux`, from the repo root, on that OS.

## Layout reconstruction

An engine reports words with boxes, not rows and columns, and its idea of a
"line" is not always a visual row — Windows OCR hands back one line per
*column* for a table whose columns are widely spaced. Two geometry passes in
`shared/table.ts` fix that:

- `toVisualLines` regroups **words** by vertical position into real rows. Run
  on every recognition, because the raw order is wrong as plain text before it
  is ever wrong as a table.
- `toGrid` finds the **gutters** that recur at the same x across many rows and
  splits each row on them. Prose has no recurring gutters, so it stays one
  column — which is the point.

Trade-off: a genuinely multi-column document (a two-column article) has rows
that span both columns, so its columns interleave. The result screen shows
exactly what came out, and the ⌘K **Show Lines / Reconstruct Table** toggle
switches between the two readings.

## UAT

Reference clock `Thu, Sep 17, 2026 18:00`. Needs an OCR engine installed (see
above) — without one, run §5 only.

### 1. Starting a recognition

| #   | Input / action                                       | Result                                                                    | ✓   |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------- | --- |
| 1.1 | type `read text`, `↵`                                | library screen opens; "Read text from" rows at the top                    |     |
| 1.2 | screenshot a table, then row **Clipboard Image**, `↵` | recognizes, pushes the result screen                                      |     |
| 1.3 | row **Image File…**, `↵`                             | file picker opens; launcher stays visible behind it                       |     |
| 1.4 | cancel that picker                                   | back on the library screen, no error shown                                |     |
| 1.5 | drop a `.png` onto the window                        | recognizes it; footer reads `Reading <name>…` while it runs               |     |
| 1.6 | drop a `.txt` onto the window                        | `That file isn't an image this app can read.`                             |     |
| 1.7 | empty clipboard → **Clipboard Image**                | `There's no image on the clipboard. Copy or screenshot one first.`        |     |
| 1.8 | a photo with no text                                 | `No text was found in that image.`                                        |     |
| 1.9 | type `read text from clipboard`, `↵`                 | recognizes straight away, no extra screen in between                     |     |

### 2. Library screen

| #    | Input / action                     | Result                                                     | ✓   |
| ---- | ---------------------------------- | ---------------------------------------------------------- | --- |
| 2.1  | rows below the actions             | grouped `Pinned` / `Today` / `Yesterday` / …                |     |
| 2.2  | row shows                          | thumbnail, first recognized line, `📌` when pinned          |     |
| 2.3  | no row highlighted                 | right pane shows the engine, its languages and a privacy line |     |
| 2.4  | highlight a recognition            | right pane shows image, full text, and its metadata         |     |
| 2.5  | search `clip`                      | matches the **Clipboard Image** action row                  |     |
| 2.6  | search a word from a past scan     | matches that recognition (searches its whole text)          |     |
| 2.7  | `↵` on a recognition               | opens the result screen                                     |     |
| 2.8  | `⌘C`                               | text copied, launcher closes                                |     |
| 2.9  | `⌘E`                               | export form opens                                           |     |
| 2.10 | `⌘K` → Pin / Unpin                 | moves into / out of the `Pinned` group                      |     |
| 2.11 | pin a 21st recognition             | refused; footer reads `Pin limit reached — unpin one first` |     |
| 2.12 | `⌘K` → Delete Recognition (twice)  | row removed                                                 |     |
| 2.13 | `⌘K` → Clear Library (twice)       | every unpinned recognition removed; pins stay               |     |
| 2.14 | restart the app                    | library and pins are still there                            |     |

### 3. Result screen

| #   | Input / action                          | Result                                                          | ✓   |
| --- | --------------------------------------- | ---------------------------------------------------------------- | --- |
| 3.1 | a recognized receipt                    | opens in table mode; footer reads `N rows`                       |     |
| 3.2 | a recognized paragraph                  | opens in line mode; footer reads `N lines`                        |     |
| 3.3 | arrow through the rows                  | the matching text is boxed on the image in the right pane        |     |
| 3.4 | line mode row                           | line number, text, and a confidence badge (`—` on Windows)       |     |
| 3.5 | search a word                           | list narrows to matching lines / rows                            |     |
| 3.6 | `↵` on a row                            | that line (or tab-separated row) copied                          |     |
| 3.7 | `⌘K` → Copy All Text / as JSON / as CSV | clipboard matches what the same-format export writes             |     |
| 3.8 | `⌘K` → Show Lines / Reconstruct Table   | rows switch; the `Mode` row in the right pane follows            |     |
| 3.9 | `⌘E`                                    | export form opens for this recognition                           |     |

### 4. Export

| #    | Input / action                       | Result                                                             | ✓   |
| ---- | ------------------------------------ | ------------------------------------------------------------------- | --- |
| 4.1  | open Export                          | format cards; `Save to` pre-filled under Documents, named after the source |     |
| 4.2  | switch format                        | the filename's extension follows it                                 |     |
| 4.3  | **Plain Text**                       | preview is the text, paragraphs separated by a blank line           |     |
| 4.4  | **JSON**                             | preview shows lines, words, boxes and metadata                      |     |
| 4.5  | **CSV** / **Excel**                  | preview is a grid; the table switch is on and disabled              |     |
| 4.6  | **PDF**                              | table switch is free; preview follows it                            |     |
| 4.7  | Include per-line confidence          | JSON gains `confidence`; grids gain a trailing column               |     |
| 4.8  | `Save to` → pick a path              | picker opens over the launcher; path updates                        |     |
| 4.9  | `⌘↵` / **Export**                    | file written; footer reads `Saved to <path>`                        |     |
| 4.10 | **Show in Folder**                   | Explorer / Finder opens with the file selected                      |     |
| 4.11 | open the `.xlsx` in Excel            | two sheets: the table, and **Details**; header row bold and frozen  |     |
| 4.12 | a price column in Excel              | sums as numbers; `007`-style values stay text                       |     |
| 4.13 | open the `.pdf`                      | title, metadata line, the source image, then the text               |     |
| 4.14 | non-Latin text (e.g. Khmer) in a PDF | renders correctly, not as boxes                                     |     |
| 4.15 | export to a read-only folder         | `That file couldn't be written (…)` shown on the field              |     |
| 4.16 | `Esc`                                | back to where Export was opened from                                |     |

### 5. No engine installed

| #   | Input / action                     | Result                                                                 | ✓   |
| --- | ---------------------------------- | ----------------------------------------------------------------------- | --- |
| 5.1 | library screen, nothing highlighted | right pane reads `Unavailable` with the specific remedy for this OS     |     |
| 5.2 | Windows, no OCR language pack      | names Settings → Time & language → … → Optical character recognition    |     |
| 5.3 | Linux, no `tesseract`              | names `sudo apt install tesseract-ocr`                                  |     |
| 5.4 | addon missing / not rebuilt        | names `npm run build:native:win` (or `:mac`)                            |     |
| 5.5 | start a recognition anyway         | the same message, shown in the footer rather than thrown                |     |
