# ESD K9 Training Logs

A mobile-first, offline-first application for documenting the training of an
Electronic Storage Device Detection K9 (ESD K9). Built for a law-enforcement
K9 handler working primarily from an Android phone, with full support for
tablets and desktop browsers.

**Every record stays on the device.** There is no server, no account, no
telemetry, and no network requirement. Exports (PDF / XLSX / CSV / JSON) and
backups go only where the handler sends them.

## Feature summary

- **Session → Exercise → Hide** record structure with distinct outcome codes:
  found (independent), found (handler-assisted), interest without indication,
  missed, not searched — plus per-exercise **false responses** and **blank
  (negative) searches**. Outcomes are never lumped into one "finds" number.
- **Fast mobile entry**: one-tap start from recent/favorite locations,
  "repeat last setup", quick-add hides, thumb-sized outcome buttons, chips
  and segmented controls, autosave with draft recovery, dark & light themes.
- **Defensible records**: finalize with handler acknowledgment; corrections
  to finalized records require a stated reason and preserve original values
  in a permanent revision history; records can be locked read-only.
- **Reports**: three professional PDF report types (detailed session,
  condensed chronological log, date-range summary with statistics) and a
  genuine multi-worksheet XLSX workbook (Sessions / Exercises / Hides /
  Outcomes / Summary / Data Dictionary) with real dates, frozen filterable
  headers, and linked record IDs. CSV and JSON exports for portability.
- **History & analysis**: search, filters, calendar view, dashboard,
  statistics by search type and blindness level, staleness warnings for
  under-practiced search types, follow-up training items.
- **Backup & restore**: single-file JSON backup of everything (attachments
  included), with merge or replace restore, verified by automated tests.
- **Security options**: app PIN (stored as salted SHA-256 hash), optional
  auto-lock, identity withholding in exports. See `docs/SECURITY.md`.

## Technology

| Layer | Choice | Why |
| --- | --- | --- |
| UI | React 18 + TypeScript + Vite | Mature, well-documented, easily maintained |
| App shell | Installable PWA (`vite-plugin-pwa`) | Installs to Android home screen; fully offline via service-worker precache |
| Storage | IndexedDB via Dexie 4 | Proven local database with schema versioning (migrations) and transactions |
| PDF | jsPDF + jspdf-autotable | Reliable in-browser PDF with table pagination |
| XLSX | ExcelJS | Genuine .xlsx with typed cells, frozen headers, autofilter |
| Tests | Vitest + fake-indexeddb + pdfjs-dist | Unit, integration, and export-verification tests |

No experimental dependencies. No backend. Architecture rationale in
`docs/ARCHITECTURE.md`.

## Getting started (development)

Prerequisites: Node.js 20+ and npm.

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm test           # run the automated test suite (53 tests)
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build locally
```

There are no environment variables and no secrets; nothing to configure
before running. (No `.env` file exists because none is needed — the app is
fully client-side.)

## Deployment

The production build in `dist/` is static files. Host it on any static web
server or service (internal IIS/nginx, GitHub Pages, Netlify, Cloudflare
Pages…). Requirements:

1. **HTTPS** (required for service workers / installability; `localhost` is
   exempt for testing).
2. Serve `index.html` for the root path. The app uses hash routing, so no
   server-side rewrite rules are needed.

No database, runtime, or server-side code is involved. If the hosting
provider disappears, the app keeps working on every phone it is installed
on, and all data remains on those devices.

## Installing on an Android phone

1. Open the hosted URL in Chrome on the phone.
2. Menu (⋮) → **Add to Home screen** / **Install app**.
3. Launch from the home screen — it runs full-screen and works with
   airplane mode on.

Also works installed from Edge/Chrome on Windows/macOS and in Safari on
iPadOS (Add to Home Screen).

## Backups (important)

Records live in the browser's IndexedDB on the device. Clearing site data,
uninstalling the browser, or losing the phone deletes them. **Create backup
files regularly** (More → Backup & restore → *Create backup file*) and store
them somewhere safe. Restore is available on the same screen; both merge
and full-replace modes are supported and tested. Full procedure in
`docs/USER_GUIDE.md`.

## Documentation

| File | Contents |
| --- | --- |
| `docs/ARCHITECTURE.md` | Architecture decision record, database schema, sync-readiness |
| `docs/DATA_DICTIONARY.md` | Every field and metric, with definitions and formulas |
| `docs/USER_GUIDE.md` | Handler-facing guide: workflows, reports, backup/restore |
| `docs/TEST_PLAN.md` | Test plan, automated results, manual verification log |
| `docs/SECURITY.md` | Threat model, storage security, privacy posture |
| `docs/RESEARCH.md` | Documentation-practice research and sources |
| `samples/` | Sample PDF/XLSX/backup files from the fictional Cooper dataset |

## Sample data

Onboarding offers a fictional dataset for **K9 Cooper**, an ESD Labrador
(Fairview County Sheriff's Office — all names, people, and locations are
invented). Use it to explore, then Settings/Profile to configure a real
team. Nothing agency-specific is hard-coded.

## Project structure

```
src/
  db/           types, Dexie schema, repository (transactions, audit), seed
  lib/          stats, validation, formatting, exports (PDF/XLSX), backup, lock
  components/   UI primitives and app shell (nav, topbar)
  screens/      one file per screen (19 screens)
  styles/       design tokens + all styling (light/dark, reduced motion)
tests/          automated suite (unit, DB integration, export verification)
tools/          sample-file generator
docs/           project documentation
samples/        generated sample exports
```

## Known limitations

Documented honestly in `docs/TEST_PLAN.md` §5, including: no cloud sync in
this release (schema is sync-ready), encryption-at-rest relies on device
storage encryption, PDF reports reference attachment captions but do not
embed images, and the main JS bundle is ~1.9 MB (precached by the service
worker, so it downloads once per version).
