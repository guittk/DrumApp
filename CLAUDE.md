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

**CSV is now only an import/export interchange format**, not a live file the app keeps open:
- **Import** ([js/fileLoading.js](js/fileLoading.js) `startCsvImport`): parses the file, diffs each CSV song against the current DB-backed song of the same name (`songsDiffer`, comparing `items`/`bpm`/`duration`). Songs only in the CSV are added automatically. Songs identical in both are left alone. Songs present in both but differing go to a review screen (`#screen-csv-diff`) where the user picks "Usar CSV" or "Usar Database" per song (`diffLines` does an LCS-based line diff for the preview); confirming pushes only the changed/new songs to Firebase.
- **Export** (`exportCsv()` in [js/csvWrite.js](js/csvWrite.js)): calls `serializeCSV(songs)` and downloads/save-as's the result.
- [js/csv.js](js/csv.js) `parseCSV`/`serializeCSV`: **musicas.csv is a wide-format spreadsheet where each column is one song**, not each row — rows are the lines of the drum sheet (annotations and lyrics), shared positionally across all songs' columns. `serializeCSV` always regenerates a fresh canonical layout (10 blank rows, a name row, a blank separator, then item rows) numbering columns by the current `songs` array order — it does **not** try to preserve column positions across separate imports/sessions. (An earlier version stored a stable `col` per song and reused it across imports; that caused column collisions once songs could come from multiple independently-imported CSVs, so `col` was dropped entirely — don't reintroduce cross-session column identity without solving that.)

Each song's `items` array is a flat list of line objects:
- `{type:'ann', text:'[TYPE] (rhythm)', bg, tx}` — a section/instrument header line (bracketed type, optional parenthesized rhythm)
- `{type:'lyric', text, accent}` — a lyric line under the current header
- `{type:'empty'}` — a blank separator row (used by the serializer to preserve spacing, stripped from trailing ends)

[js/song.js](js/song.js) `renderSong()` regroups `items` into "sections" (one `ann` + the `lyric` lines that follow it) for display as `.sheet-section` cards. A section with an `ann` but **no lyric lines under it merges into the previous card** rather than rendering as its own — this is intentional (see the `blocks` merging logic in `renderSong`), not a bug to "fix" by giving empty sections their own background/border.

Songs opened from the editor always get `edBlocks` (the editor's own block model: `{insts, rhythm, lyrics, pattern, bars}`), either loaded from a previous save or reconstructed on demand from `items` via `songToEdBlocks()` for songs that don't have it yet (e.g. freshly imported from CSV).

## Tags drive coloring and parsing both ways

[js/tags.js](js/tags.js) tags (`{k, label, bg, tx, keyword}`, user-configurable, persisted in `localStorage['thurgh_tags']`) are the single source for:
- matching free-text annotation strings to an instrument/color via regex (`getCol`/`getAllCols`, used when **parsing** CSV `ann` lines and when **rendering** section headers)
- building the instrument picker buttons in the block editor

Changing tag matching logic affects both CSV import and the live sheet view — check both call sites.

Tag colors are picked only from the predefined color palette (`localStorage['thurgh_palette']`, managed in the "Cores predefinidas" tab of the tags screen), not freely chosen — see `tagColorSwatches()`/`getPalette()`. When an annotation matches multiple tags, only the first matching tag's color is used (`cols[0]`); colors are never blended across tags anymore.

## Screen/state architecture

Single-page app with named `<div id="screen-*">` blocks toggled by [js/navigation.js](js/navigation.js) `show()`. Global mutable state lives in [js/state.js](js/state.js) (`songs`, `cur`, `favs`, `fs`, etc.) and is persisted via [js/storage.js](js/storage.js) `saveAll()`/`loadStore()` to `localStorage` (versioned by `CACHE_VER` — bump it if the `songs`/item shape changes, since `loadStore()` discards incompatible cached data).

Rough module map:
- [js/csv.js](js/csv.js) — parse/serialize the wide-format CSV (import/export interchange format only, see above)
- [js/csvWrite.js](js/csvWrite.js) — `exportCsv()`: Database → downloaded/save-as'd `.csv` file
- [js/fileLoading.js](js/fileLoading.js) — CSV import: diffing parsed songs against the DB-backed `songs`, rendering `#screen-csv-diff`, and applying the user's per-song choices
- [js/song.js](js/song.js) — sheet rendering (grouping items into section cards) + font-size control
- [js/editor.js](js/editor.js) — block-based song editor (the `edBlocks` model), converts to/from `items`
- [js/drum.js](js/drum.js) + [js/synth.js](js/synth.js) — step-sequencer UI and Web Audio drum synthesis, feeds a rhythm block's `pattern`/notation text
- [js/playback.js](js/playback.js) — auto-scroll "playback" of the sheet (scrolls `#song-body` over a target duration, either manual or BPM-derived)
- [js/list.js](js/list.js) — song list screen, favorites, search
- [js/tags.js](js/tags.js) — instrument/annotation tag config (colors + keyword matching), plus the user-configurable color palette (`localStorage['thurgh_palette']`) that tag colors are picked from
- [js/firebase.js](js/firebase.js) — Firebase Realtime DB: song storage (`fbLoadSongs`/`fbSaveSong`/`fbSaveSongs`/`fbDeleteSong`) plus the pre-existing generic config helpers (`fbGetConfig`/`fbSetConfig`) used to store a shared OpenAI API key
- [js/openai.js](js/openai.js) — OpenAI called client-side to auto-fill BPM/duration for a song by name
- [js/navigation.js](js/navigation.js), [js/state.js](js/state.js), [js/storage.js](js/storage.js), [js/textUtils.js](js/textUtils.js) — plumbing (screen switching, globals, persistence, HTML escaping/bold-marker formatting)

All UI is server-less and in Portuguese (pt-BR) — keep user-facing strings consistent with that.
