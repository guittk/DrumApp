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

## Data model — CSV is the source of truth

The core data quirk to understand before touching parsing/serialization code: **musicas.csv is a wide-format spreadsheet where each column is one song**, not each row. Rows are the lines of the drum sheet (annotations and lyrics), shared positionally across all songs' columns. [js/csv.js](js/csv.js) parses this into `songs` (array of `{name, col, items, dom, sections, bpm, ...}`), and `serializeCSV` writes it back preserving the original row/column layout (`csvRows`, `csvNameRow`, `csvBaseLen` module state captured at parse time).

Each song's `items` array is a flat list of line objects:
- `{type:'ann', text:'[TYPE] (rhythm)', bg, tx}` — a section/instrument header line (bracketed type, optional parenthesized rhythm)
- `{type:'lyric', text, accent}` — a lyric line under the current header
- `{type:'empty'}` — a blank separator row (used by the serializer to preserve spacing, stripped from trailing ends)

[js/song.js](js/song.js) `renderSong()` regroups `items` into "sections" (one `ann` + the `lyric` lines that follow it) for display as `.sheet-section` cards. A section with an `ann` but **no lyric lines under it merges into the previous card** rather than rendering as its own — this is intentional (see the `blocks` merging logic in `renderSong`), not a bug to "fix" by giving empty sections their own background/border.

Songs can come from two places, distinguished by `song.created`:
- **CSV-sourced** songs (`created` falsy) — read-only source is the CSV; edited via [js/editor.js](js/editor.js) `songToEdBlocks()` which reconstructs editable blocks from `items` on demand.
- **App-created/edited** songs (`created: true`) — carry `edBlocks` (the editor's own block model: `{insts, rhythm, lyrics, pattern, bars}`) and are serialized back to `items` in `saveEditorSong()`. These always win over a same-named CSV entry on reload ([js/fileLoading.js](js/fileLoading.js) `processCSV`/`tryAutoLoad` filter CSV rows whose name matches an already-created song).

## Tags drive coloring and parsing both ways

[js/tags.js](js/tags.js) tags (`{k, label, bg, tx, keyword}`, user-configurable, persisted in `localStorage['thurgh_tags']`) are the single source for:
- matching free-text annotation strings to an instrument/color via regex (`getCol`/`getAllCols`, used when **parsing** CSV `ann` lines and when **rendering** section headers)
- building the instrument picker buttons in the block editor

Changing tag matching logic affects both CSV import and the live sheet view — check both call sites.

## Screen/state architecture

Single-page app with named `<div id="screen-*">` blocks toggled by [js/navigation.js](js/navigation.js) `show()`. Global mutable state lives in [js/state.js](js/state.js) (`songs`, `cur`, `favs`, `fs`, etc.) and is persisted via [js/storage.js](js/storage.js) `saveAll()`/`loadStore()` to `localStorage` (versioned by `CACHE_VER` — bump it if the `songs`/item shape changes, since `loadStore()` discards incompatible cached data).

Rough module map:
- [js/csv.js](js/csv.js) — parse/serialize the wide-format CSV
- [js/csvWrite.js](js/csvWrite.js) — write the CSV back via File System Access API (with download fallback for unsupported browsers)
- [js/song.js](js/song.js) — sheet rendering (grouping items into section cards) + font-size control
- [js/editor.js](js/editor.js) — block-based song editor (the `edBlocks` model), converts to/from `items`
- [js/drum.js](js/drum.js) + [js/synth.js](js/synth.js) — step-sequencer UI and Web Audio drum synthesis, feeds a rhythm block's `pattern`/notation text
- [js/playback.js](js/playback.js) — auto-scroll "playback" of the sheet (scrolls `#song-body` over a target duration, either manual or BPM-derived)
- [js/list.js](js/list.js) — song list screen, favorites, search
- [js/tags.js](js/tags.js) — instrument/annotation tag config (colors + keyword matching)
- [js/firebase.js](js/firebase.js) + [js/openai.js](js/openai.js) — Firebase Realtime DB used only to store a shared OpenAI API key; OpenAI is called client-side to auto-fill BPM/duration for a song by name
- [js/fileLoading.js](js/fileLoading.js) — CSV upload / drag-drop / auto-load from well-known filenames
- [js/navigation.js](js/navigation.js), [js/state.js](js/state.js), [js/storage.js](js/storage.js), [js/textUtils.js](js/textUtils.js) — plumbing (screen switching, globals, persistence, HTML escaping/bold-marker formatting)

All UI is server-less and in Portuguese (pt-BR) — keep user-facing strings consistent with that.
