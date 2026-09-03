# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Thurgh — a drum-sheet viewer/editor for a drum group ("Thurgh"). It's a static, no-build, no-dependency web app: plain HTML/CSS/vanilla JS loaded directly via `<script>` tags in [index.html](index.html), deployed as a GitHub Pages site (custom domain in [CNAME](CNAME)). There is no `package.json`, no bundler, no test runner, and no build step.

## Running / developing

Open [index.html](index.html) directly in a browser, or serve the folder statically, e.g.:

```bash
python -m http.server 8000
```

There is no lint, build, or test command — verify changes by loading the page in a browser and exercising the relevant screen.

## Data model — Firebase Realtime Database is the source of truth

`songs` (the in-memory array, [js/state.js](js/state.js)) is loaded from and written to a Firebase Realtime Database at path `songs/`, keyed by a sanitized version of each song's `name` ([js/firebase.js](js/firebase.js) `fbLoadSongs`/`fbSaveSong`/`fbSaveSongs`/`fbDeleteSong`, `songKey()`). `localStorage` (via [js/storage.js](js/storage.js)) is only an instant-load cache shown while a fresh Firebase fetch happens in the background ([js/init.js](js/init.js)) — it is never the source of truth and can be discarded/rebuilt at will (bump `CACHE_VER` if the `songs`/item shape changes, since `loadStore()` discards incompatible cached data).

All songs — whether imported from CSV or created/edited in the app — are stored and treated identically; there is no `created`/origin flag anywhere in the data model or UI.

**CSV and XLSX are only import/export interchange formats**, not a live file the app keeps open:
- **Import** ([js/fileLoading.js](js/fileLoading.js) `readFile` → `startCsvImport`/`startXlsxImport` → shared `startImport`): parses the file, diffs each parsed song against the current DB-backed song of the same name (`songsDiffer`, comparing `items`/`bpm`/`duration`). Songs only in the file are added automatically. Songs identical in both are left alone. Songs present in both but differing go to a review screen (`#screen-csv-diff`) where the user picks "Usar CSV"/"Usar XLSX" or "Usar Database" per song (`diffLines` does an LCS-based line diff for the preview); confirming pushes only the changed/new songs to Firebase.
- **Export** (`exportCsv()` in [js/csvWrite.js](js/csvWrite.js)): calls `serializeCSV(songs)` and downloads/save-as's the result. There is no XLSX export — XLSX is import-only, for bringing in the exact cell colors of an existing spreadsheet.
- [js/csv.js](js/csv.js) `parseCSV`/`serializeCSV`: **musicas.csv is a wide-format spreadsheet where each column is one song**, not each row — rows are the lines of the drum sheet (annotations and lyrics), shared positionally across all songs' columns. `serializeCSV` always regenerates a fresh canonical layout (10 blank rows, a name row, a blank separator, then item rows) numbering columns by the current `songs` array order — it does **not** try to preserve column positions across separate imports/sessions. (An earlier version stored a stable `col` per song and reused it across imports; that caused column collisions once songs could come from multiple independently-imported CSVs, so `col` was dropped entirely — don't reintroduce cross-session column identity without solving that.)
- [js/xlsx.js](js/xlsx.js) `parseXLSX`: reads a `.xlsx` natively (it's just a zip of XML — no library), same wide-format layout as the CSV, but pulls the **real fill color of each cell** instead of guessing it from tag keywords. CSV carries no color at all (`ann` color always comes from `getCol()` matching the bracketed text against a tag), so a CSV-only round trip can never be pixel-identical to a source spreadsheet; XLSX import is what makes that possible. Scans every visible sheet in the workbook (skipping ones marked `state="hidden"`) and keeps any sheet whose grid contains a `[Tag]`-style cell — it does not assume a fixed sheet name or position. Cell fills that are plain `rgb` resolve directly; theme-based fills (`theme="N" tint="…"`) go through the same HSL-luminance tint math Excel itself uses (`applyTint`/`rgbToHls`/`hlsToRgb`) — do not "simplify" this to per-channel RGB scaling, it produces visibly wrong colors for tinted theme fills.

Each song's `items` array is a flat list of line objects:
- `{type:'ann', text:'[TYPE] (rhythm)', bg, tx, exact}` — a section/instrument header line (bracketed type, optional parenthesized rhythm). `exact:true` (only ever set by the xlsx importer) means `bg`/`tx` came from the real cell fill and must win over tag-based color in `renderSong`; CSV-imported and editor-created items never set it, so they keep following whatever the matching tag's color is right now (tags can be renamed/recolored later and already-imported songs pick that up live).
- `{type:'lyric', text, accent}` — a lyric line under the current header
- `{type:'empty'}` — a blank separator row (used by the serializer to preserve spacing, stripped from trailing ends)

[js/song.js](js/song.js) `renderSong()` regroups `items` into "sections" (one `ann` + the `lyric` lines that follow it) and renders **every section as its own `.sheet-block`**, colored flat edge-to-edge — deliberately matching the source spreadsheet look (a print of it is the reference), including consecutive same-tag or lyric-less sections each keeping their own box. There is no more "merge a lyric-less header into the previous card" special case (an earlier version did this to avoid empty-looking boxes); don't reintroduce it without checking against that reference look first.

Songs opened from the editor always get `edBlocks` (the editor's own block model: `{insts, rhythm, lyrics, pattern, bars}`), either loaded from a previous save or reconstructed on demand from `items` via `songToEdBlocks()` for songs that don't have it yet (e.g. freshly imported from CSV/XLSX).

## Tags drive coloring and parsing both ways

[js/tags.js](js/tags.js) tags (`{k, label, bg, tx, keyword}`, user-configurable, persisted in `localStorage['thurgh_tags']`) are the single source for:
- matching free-text annotation strings to an instrument/color via regex (`getCol`/`getAllCols`, used when **parsing** CSV `ann` lines and when **rendering** section headers)
- building the instrument picker buttons in the block editor

Changing tag matching logic affects the live sheet view, CSV import, and xlsx import's fallback path (when a cell has no fill) — check all three call sites.

Tag colors are picked only from the predefined color palette (`localStorage['thurgh_palette']`, managed in the "Cores predefinidas" tab of the tags screen), not freely chosen — see `tagColorSwatches()`/`getPalette()`. When an annotation matches multiple tags, only the first matching tag's color is used (`cols[0]`); colors are never blended across tags anymore.

## Screen/state architecture

Single-page app with named `<div id="screen-*">` blocks toggled by [js/navigation.js](js/navigation.js) `show()`. Global mutable state lives in [js/state.js](js/state.js) (`songs`, `cur`, `favs`, `fs`, etc.) and is persisted via [js/storage.js](js/storage.js) `saveAll()`/`loadStore()` to `localStorage` (versioned by `CACHE_VER` — bump it if the `songs`/item shape changes, since `loadStore()` discards incompatible cached data).

Rough module map:
- [js/csv.js](js/csv.js) — parse/serialize the wide-format CSV (import/export interchange format only, see above)
- [js/xlsx.js](js/xlsx.js) — parse the wide-format XLSX (import only, see above): a from-scratch zip reader + just enough OOXML (sharedStrings/styles/theme/worksheet XML) to read cell text and real fill color, no library
- [js/csvWrite.js](js/csvWrite.js) — `exportCsv()`: Database → downloaded/save-as'd `.csv` file
- [js/fileLoading.js](js/fileLoading.js) — CSV/XLSX import: diffing parsed songs against the DB-backed `songs`, rendering `#screen-csv-diff`, and applying the user's per-song choices
- [js/song.js](js/song.js) — sheet rendering (grouping items into flat colored `.sheet-block` cards) + font-size control + the BPM/Tempo timeline (`computeTimeline`) that splits the chosen total duration across blocks
- [js/editor.js](js/editor.js) — block-based song editor (the `edBlocks` model), converts to/from `items`
- [js/drum.js](js/drum.js) + [js/synth.js](js/synth.js) — step-sequencer UI and Web Audio drum synthesis, feeds a rhythm block's `pattern`/notation text
- [js/playback.js](js/playback.js) — playback keeps the current block **centered** in `#song-body` (not a continuous scroll): `buildBlockMap()` measures each block's on-screen center, `findBlockIdx()`/`scrollToBlock()` jump-and-smooth-scroll to whichever block owns the current instant in the timeline from `computeTimeline()`
- [js/list.js](js/list.js) — song list screen, favorites, search
- [js/tags.js](js/tags.js) — instrument/annotation tag config (colors + keyword matching), plus the user-configurable color palette (`localStorage['thurgh_palette']`) that tag colors are picked from
- [js/firebase.js](js/firebase.js) — Firebase Realtime DB: song storage (`fbLoadSongs`/`fbSaveSong`/`fbSaveSongs`/`fbDeleteSong`) plus the pre-existing generic config helpers (`fbGetConfig`/`fbSetConfig`) used to store a shared OpenAI API key
- [js/openai.js](js/openai.js) — OpenAI called client-side to auto-fill BPM/duration for a song by name
- [js/navigation.js](js/navigation.js), [js/state.js](js/state.js), [js/storage.js](js/storage.js), [js/textUtils.js](js/textUtils.js) — plumbing (screen switching, globals, persistence, HTML escaping/bold-marker formatting)

All UI is server-less and in Portuguese (pt-BR) — keep user-facing strings consistent with that.
