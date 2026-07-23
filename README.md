# TypeConverter

## The Problem

Every online file converter follows the same pattern: upload your files to someone else's server, wait, download the result. Your personal documents, photos, financial spreadsheets, and private data pass through infrastructure you don't control.

TypeConverter exists because file conversion shouldn't require trust. It runs entirely in the browser — no uploads, no server processing, no data ever leaves your device. Privacy isn't a policy here. It's an architectural guarantee.

## Architecture

### Pipeline Flow

```
Files → Type Detection → Pipeline Router → Conversion Engine → ZIP Download
```

Every file enters the same flow. The type detector examines file extension and MIME type to classify the input. The router selects the correct conversion pipeline. The pipeline handles the actual transformation using browser APIs or WebAssembly. Multiple files are processed as a batch and bundled into a single ZIP download via JSZip.

### The 8 Pipelines

| Pipeline | Input Formats | Output Formats | Engine |
|---|---|---|---|
| **Image** | JPEG, PNG, WEBP, GIF, BMP, TIFF, SVG, ICO, HEIC | JPEG, PNG, WEBP, GIF, BMP, TIFF | Canvas API, heic2any, UTIF.js |
| **Audio** | MP3, WAV, FLAC, OGG, AAC, M4A | MP3, WAV, OGG, FLAC, AAC, M4A | FFmpeg.wasm |
| **Video** | MP4, MOV, AVI, MKV, WEBM | MP4, WEBM, GIF | FFmpeg.wasm (planned) |
| **Document** | PDF, DOC, DOCX, RTF, ODT, EPUB | PDF, TXT, HTML | (planned) |
| **Spreadsheet** | CSV, XLS, XLSX, TSV | CSV, JSON, XLSX | SheetJS |
| **Presentation** | PPT, PPTX, ODP | PDF | (de-scoped from v1) |
| **Code / Text** | HTML, MD, JSON, YAML, XML, TXT | HTML, MD, JSON, YAML, XML, TXT | marked, Turndown, js-yaml |
| **Archive** | ZIP, RAR, 7Z, TAR, GZ | ZIP, TAR, GZ | JSZip |

Each pipeline is a self-contained ES module. The registry detects file types and routes to the correct pipeline. The converter orchestrates the batch — iterating files, delegating to pipelines, collecting results. UI modules handle rendering and interaction without knowing conversion internals.

### The Big Decision: Server → Client

The first version of TypeConverter was a traditional Node.js application — Express.js server, EJS templates, Multer for file uploads, Sharp for image processing. Files went up to the server, got converted, came back down.

I scrapped it.

Privacy wasn't a property of that architecture — it was a promise. "We delete your files after an hour." But the conversion still happened on my server. The user had to trust me.

The rewrite moved everything into the browser:

- **Sharp** (server-side image processing) → **Canvas API** + **UTIF.js** + **heic2any**
- **Server-side FFmpeg** → **FFmpeg.wasm** (WebAssembly, runs in the browser tab)
- **Server-side file I/O** → **SheetJS** for spreadsheets, **JSZip** for archives
- **Express.js + EJS** → Static HTML, zero server

Privacy became an architectural guarantee, not a policy.

## Project Structure

```
TypeConverter/
├── index.html                  → UI shell (single page, all sections)
├── styles.css                  → Neumorphic responsive UI, 3 themes
├── vercel.json                 → Static site deployment config
├── package.json
│
└── src/
    ├── app.js                  → Entry point — init, event wiring, refresh cycle
    ├── state.js                → Application state, constants, DOM element refs
    ├── utils.js                → Shared helpers (escaping, MIME types, formatting)
    ├── converter.js            → Batch conversion orchestrator
    │
    ├── pipelines/
    │   ├── registry.js         → Pipeline definitions, type detection, routing
    │   ├── image.js            → Canvas API, HEIC/TIFF/BMP codec support
    │   ├── audio.js            → FFmpeg WASM lazy-loading + audio transcoding
    │   ├── code.js             → Text format transforms (MD↔HTML, JSON↔YAML↔XML)
    │   ├── spreadsheet.js      → SheetJS integration (CSV, XLSX, JSON)
    │   └── archive.js          → JSZip compression and extraction
    │
    └── ui/
        ├── dropzone.js         → Drag-and-drop file ingestion
        ├── filelist.js         → File list, validation, per-file format selection
        ├── format.js           → Global format selection, compression controls
        ├── batch.js            → Batch confirmation panel, convert button state
        ├── results.js          → Conversion results, individual + ZIP download
        ├── history.js          → localStorage conversion history
        ├── progress.js         → Progress bar during batch processing
        └── theme.js            → Light / Dark / Secret Grey theme toggle
```

**Dependency flow:** Pipelines import only from `state` and `utils` — never from UI. UI modules import from pipelines (for type detection and format info) but not from each other except through the `tc:refresh` event dispatched after state changes. `app.js` wires everything together. `converter.js` bridges pipelines and UI.

## UI/UX Design

The interface is built around a few principles:

- **Minimal cognitive load** — one screen, one flow: drop files → pick format → convert → download
- **Batch-first workflow** — multiple files are the default, not an afterthought
- **Progressive disclosure** — compression settings, per-file format overrides, and the file list expand only when relevant
- **Confirmation before action** — a batch summary shows exactly what will convert and what will be skipped before any processing begins
- **Privacy as visible product** — "Files never leave your device" is shown on every page load, not buried in a footer

Additional design choices:

- Per-file format overrides for mixed-type batches
- Collapsible file list with thumbnails and pipeline badges
- Image quality slider and audio bitrate selector (appear contextually)
- Size comparison on results — original vs. converted with savings percentage
- Responsive layout (mobile-first, single column on small screens)
- Three themes: Pearl White (neumorphic light), Vanta Black (dark), Secret Grey (easter egg — 5 rapid clicks on the theme toggle)

## Design Tradeoffs

| Decision | Rationale |
|---|---|
| **No server** | Privacy is the product. A server with a "we delete your files" policy is weaker than never uploading them at all. |
| **Video pipeline capped at ~200–500 MB** | Browser memory is finite. Large video transcoding crashes tabs. Desktop-only recommendation for big files. |
| **Presentation support de-scoped** | PPT/PPTX rendering in-browser is unsolved without a server-side engine. The effort-to-value ratio is terrible. Shipped without it. |
| **Dynamic batch limits (25–100 files)** | Small files get a 100-file limit; large files drop to 25. Prevents memory exhaustion without a hard global cap. |
| **Lazy-load FFmpeg WASM** | FFmpeg is ~30 MB. Only loaded when the user drops an audio/video file. First-load UX stays fast for image and text conversions. |
| **Canvas API over a WASM image library** | Browser-native Canvas handles most image formats. Only HEIC and TIFF need external decoders. Less code, smaller load. |
| **No build step** | Vanilla ES modules, CDN libraries. `npx serve .` runs it. No Webpack, no Vite, no transpilation. Keeps the project accessible and debuggable. |

## What's Intentionally Out of v1

- **Full document fidelity** — DOCX→PDF with exact layout preservation requires a rendering engine. Pragmatic text extraction only.
- **Presentation pipeline** — PPT/PPTX conversion needs LibreOffice or a full slide renderer. De-scoped entirely.
- **Cloud storage integrations** — Google Drive, Dropbox, etc. would require OAuth and server infrastructure, defeating the privacy model.
- **User accounts** — No login, no data persistence beyond localStorage history. Every session is ephemeral.
- **Video pipeline** — Registered in the type system but not yet wired. FFmpeg.wasm can handle it; the implementation is next after v1 stabilizes.

## Tech Stack

| Layer | Technology |
|---|---|
| **UI** | Vanilla HTML / CSS / JS — no framework, no build step |
| **Images** | Canvas API, [heic2any](https://github.com/nicolo-ribaudo/heic2any), [UTIF.js](https://github.com/nicolo-ribaudo/UTIF.js) |
| **Audio** | [FFmpeg.wasm](https://ffmpegwasm.netlify.app/) (WebAssembly) |
| **Spreadsheets** | [SheetJS](https://sheetjs.com/) |
| **Archives** | [JSZip](https://stuk.github.io/jszip/) |
| **Text transforms** | [marked](https://marked.js.org/), [Turndown](https://github.com/mixmark-io/turndown), [js-yaml](https://github.com/nodeca/js-yaml) |
| **Deployment** | [Vercel](https://vercel.com/) (static site, zero config) |

Zero backend. Zero build dependencies. Everything runs in the browser tab.

## Quick Start

```bash
npx serve .
```

Open `http://localhost:3000`. That's it.

## What I Learned

This project taught me how to take a messy real-world problem — file conversion across dozens of formats and media types — and reduce it into reusable abstractions (the pipeline pattern), make architecture decisions under real constraints (server vs. client, privacy vs. capability), scope honestly (what to ship vs. what to cut), and design usable workflows for non-technical users.

The story of this project is not the format count. It's:

```
Messy problem → Abstraction → Architecture decisions → Tradeoffs → Shipped product
```

## License

MIT

## Author

Koundinyas
