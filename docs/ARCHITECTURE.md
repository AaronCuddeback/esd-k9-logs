# Architecture

## Decision record

Three approaches were evaluated against the actual requirements
(offline-first, Android-phone primary, tablets/desktop secondary, PDF/XLSX
exports, zero data loss, low cost, no vendor lock-in):

| Option | Verdict | Reasoning |
| --- | --- | --- |
| Native Android (Kotlin) | Rejected | Best platform integration, but no tablet/desktop story without a second codebase; Play-Store or sideload distribution burden; nothing in the requirements needs native APIs beyond what the web platform provides (camera capture, file sharing, storage all available). |
| Cross-platform (React Native + Expo + SQLite) | Rejected (close second) | Solid offline story, but adds build signing, store distribution or APK sideloading, upgrade friction, and a heavier toolchain — while desktop/tablet access would still be a separate web build. Export libraries (real XLSX) are weaker in the RN ecosystem. |
| **Installable PWA (chosen)** | **Chosen** | Installs to the Android home screen from a URL; one codebase serves phone, tablet, and desktop; service-worker precache gives true offline; IndexedDB gives a transactional local database; jsPDF/ExcelJS are mature browser-side export engines; hosting is any static file server at ~zero cost; updates deploy by copying files; no vendor lock-in of any kind. |

The PWA's real trade-offs are acknowledged: browser storage can be evicted
under extreme disk pressure and is deleted by "clear site data" (mitigated
by `navigator.storage.persist()` candidacy when installed, and by the
first-class backup/restore feature), and encryption-at-rest is delegated to
the device (see SECURITY.md).

## Stack

- React 18, TypeScript (strict), Vite 5
- `vite-plugin-pwa` (Workbox) — precached app shell, auto-updating SW
- Dexie 4 over IndexedDB — schema versioning = migrations; multi-table
  transactions for every compound write
- jsPDF + jspdf-autotable (PDF), ExcelJS (XLSX)
- Vitest + fake-indexeddb + pdfjs-dist + Testing Library (tests)

## Data flow

```
Screens (React) ──── dexie-react-hooks liveQuery ────► IndexedDB (Dexie)
     │                                                      ▲
     │  edits (debounced autosave, flush on pagehide)       │
     └──────────► repo.ts (transactions, audit trail) ──────┘

Exports: db → ExportDataset → exportPdf.ts / exportXlsx.ts → Blob
         → Web Share API (Android share sheet) or download

Backups: db → backup.ts (JSON, attachments base64) → file
         file → validateBackup (referential integrity) → transactional restore
```

Key invariants enforced in `src/db/repo.ts`:

1. Every multi-table write is a Dexie transaction — no half-saved records.
2. Only `draft` records can be deleted; deletion cascades to children.
3. `draft → completed` requires `finalizeSession` (writes acknowledgment +
   revision entry, spawns follow-up items).
4. Post-finalization edits go through `recordCorrection` /
   `recordChildCorrection`, which refuse empty reasons, refuse locked
   records, and store field-level before/after diffs permanently.
5. Restores are all-or-nothing and validated for referential integrity
   before any write.

## Database schema (Dexie v1)

```
settings      id (singleton "app")           profile, prefs, PIN hash
sessions      id, date, status, locationName, trainerName, updatedAt
exercises     id, sessionId, searchTypeId, [sessionId+order]
hides         id, exerciseId, sessionId, outcome
locations     id, name, favorite, lastUsedAt
searchTypes   id, label                       built-in + user-defined
revisions     id, sessionId, timestamp        immutable audit entries
attachments   id, sessionId, exerciseId       blobs + captions
followUps     id, sessionId, done, createdAt
```

Full field definitions: `docs/DATA_DICTIONARY.md`. All ids are UUIDs
(`crypto.randomUUID`). `createdAt`/`updatedAt` ISO timestamps on every
mutable entity. Future schema changes bump the Dexie version number with an
upgrade function — never edit an existing version block.

## Multi-K9 / multi-handler readiness

The current release optimizes for one handler + one K9 (from Settings), but
nothing structural prevents expansion: sessions store `handlerName` /
`k9Name` per record (not global references), and adding first-class
`handlers` / `k9s` tables plus foreign keys is an additive Dexie version
bump. UUIDs and per-record timestamps mean records from several devices can
be merged through the existing backup-merge path without collisions.

## Sync readiness (deliberately not shipped)

Cloud sync was excluded from this release because it cannot be made
"reliable and secure" without a vetted backend, and the requirements rank
offline reliability and privacy above multi-device convenience. The design
leaves a clean seam for it:

- UUID keys, `updatedAt` timestamps, and an append-only revision log are
  exactly the primitives a sync layer needs (last-writer-wins per field with
  the audit log preserving overwritten values, or CRDT-style merge).
- The backup format doubles as a transport format; the tested merge-restore
  path already handles duplicate detection by record id.
- If added, sync must handle: token expiry (re-auth without blocking local
  writes), retry queues (background sync), and conflicts (never silently
  discard — surface as revision entries). These are documented here so a
  future implementer inherits the constraints.

## Routing / shell

Hash routing (`HashRouter`) so any static host works with zero rewrite
configuration. Bottom navigation (5 items) on phones; the same nav renders
as a side rail ≥900 px. All primary workflows are reachable with the thumb;
no hover-dependent controls exist.

## Design tokens

`src/styles/app.css` defines the entire system as CSS custom properties:
brand palette (working-K9 green), light/dark themes via `data-theme`,
spacing/radius/type scale in rem (respects Android font scaling), 48 px
minimum touch targets, safe-area insets, and `prefers-reduced-motion`
support that disables all animation.
