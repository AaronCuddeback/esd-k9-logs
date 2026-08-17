# Test Plan & Results

Delivery verification for ESD K9 Training Logs v1.0.0, 2026-08-16.

## 1. Automated suite — 53/53 passing

Run with `npm test` (Vitest, jsdom, fake-indexeddb). Final run: **7 files,
53 tests, 0 failures.**

| Area | File | Coverage |
| --- | --- | --- |
| Metrics | `tests/stats.test.ts` (9) | Outcome tallies stay distinct (no lumped "finds"); find-rate formula incl. null/edge cases; blanks & false responses; per-type and per-blindness aggregation; duration incl. midnight crossing; days-since |
| Validation | `tests/validation.test.ts` (11) | Required fields; malformed vs empty times; future-date warning; finalize gates (no exercises, hides without outcomes, unrecorded blank results, first-find > total time warning); hide validation |
| Database lifecycle | `tests/db.test.ts` (13) | Draft persistence across connection close/reopen (crash recovery); finalize (ack + revision entry + double-finalize refusal + follow-up auto-creation); corrections (before/after preservation, reason required, locked-record refusal); review gating; draft-only deletion with cascades; duplicate-setup copies structure but clears outcomes; seed referential integrity |
| Backup/restore | `tests/backup.test.ts` (5) | Full JSON round-trip into empty DB; merge skips existing / keeps local; transactional restore leaves nothing behind on corrupt input; format/version/orphan validation |
| Exports | `tests/exports.test.ts` (13) | XLSX parsed back with ExcelJS: 6 worksheets, row counts, real Date cells, frozen+filtered headers on every sheet, cross-sheet ID integrity, Summary math vs computeStats, 2000-char notes survive, identity withholding; CSV quoting/newlines; all 3 PDFs text-extracted with pdf.js: titles, session content, outcome labels, page numbers, stats values, identity withholding |
| Security | `tests/lock.test.ts` (2) | PIN hashing (salted, no plaintext), auto-lock timeout semantics |

## 2. Browser verification (dev build, Chromium)

Performed in the embedded browser at 375×812 (phone), 768×1024 (tablet),
1280×800 (desktop), dark and light themes.

| Check | Result |
| --- | --- |
| Onboarding → sample-data load (8 Cooper sessions) | ✔ |
| Home dashboard: stats, drafts, follow-ups, staleness warning, FAB | ✔ |
| New session: one-tap recent location; repeat-last-setup | ✔ |
| Session editor: autosave ("Saved" indicator), prefilled fields | ✔ |
| Exercise editor: chips, blindness, conditional room types, quick-add hide | ✔ |
| Hide editor: device chips, placement fields, one-tap outcome | ✔ |
| **Draft recovery: hard reload mid-draft → all data intact** | ✔ |
| Review & finalize: validation gate, acknowledgment checkbox, finalize | ✔ |
| Correction with reason → revision history shows before→after values | ✔ |
| History: 9 sessions listed; search + filter sheet | ✔ |
| All 11 routes render after react-router 7 upgrade | ✔ |
| In-browser export generation: XLSX 24 KB, PDFs 40–165 KB | ✔ |
| Detailed PDF visually inspected (pdf.js render): header, tables, footer, "Page 1 of 5" | ✔ |
| Condensed landscape log inspected: one row/session, clean wrapping | ✔ |
| Desktop: side nav rail, centered content; tablet: 4-col stat grid | ✔ |
| Dark & light themes | ✔ |

Offline behavior: the production build precaches all 14 assets via the
generated service worker (verified in build output); the app makes no
runtime network requests, and all reads/writes are IndexedDB — offline
creation/editing is the architecture's default path, and the automated
suite exercises it (fake-indexeddb has no network at all). An
offline-status banner appears when `navigator.onLine` is false.

## 3. Defects found during verification — all fixed

| # | Severity | Defect | Fix |
| --- | --- | --- | --- |
| 1 | Critical | `useSettings` performed a write (`getSettings` seeds defaults) inside a read-only Dexie liveQuery → app crash on first load | Read-only query in the hook; defaults returned without writing |
| 2 | High | `ensureSearchTypes` used `bulkAdd`, throwing under React StrictMode double-invocation | Idempotent `bulkPut` |
| 3 | High | Redirect race: while settings loaded, `onboarded:false` default bounced users to onboarding and kept them there | `useSettingsLoaded` distinguishes loading; App waits; reverse redirect added |
| 4 | High | New sessions dated with UTC (`toISOString`) — an evening session got tomorrow's date | `localDateIso()` helper used everywhere dates are generated/compared (factories, validation, seed, home/stats/reports/calendar) |
| 5 | Medium | jspdf ≤2.x shipped vulnerable dompurify (1 critical/1 high advisory) | Upgraded jspdf 4 / jspdf-autotable 5; PDF tests re-verified output |
| 6 | Medium | react-router 6 open-redirect/SSR advisories | Upgraded react-router-dom 7; all routes smoke-tested |
| 7 | Low | Staleness banner showed raw type id ("cluttered") | Shows label ("Cluttered environment") |
| 8 | Low | "-1d ago" recency badge for a future-dated record | Clamped to "today" |
| 9 | Low (test-only) | jsdom Blob lacks `.text()`; ExcelJS view typing | Tests adjusted (FileReader; typed view cast) |

## 4. Acceptance criteria

| # | Criterion | Status |
| --- | --- | --- |
| 1 | Create a complete session offline | ✔ (offline-first architecture; DB tests run with no network) |
| 2 | Multiple exercises and hides | ✔ (browser walkthrough + seed data + tests) |
| 3 | Close/reopen app without losing the draft | ✔ (browser reload test + connection-close test) |
| 4 | Finalize the record | ✔ |
| 5 | Locate via search and filters | ✔ |
| 6 | Correct via documented revision | ✔ |
| 7 | Export to readable PDF | ✔ (visual inspection + text extraction) |
| 8 | Export to valid XLSX | ✔ (parsed back and content-verified) |
| 9 | Back up the data | ✔ (round-trip tested) |
| 10 | Restore successfully | ✔ (merge + replace + corrupt-file rejection) |
| 11 | Critical functions phone-comfortable, no horizontal scrolling | ✔ (375 px walkthrough; only intentional intra-control scroll areas) |

## 5. Known limitations (honest list, all low severity)

1. **No cloud sync** in this release — single-device with backup-file
   transfer. Deliberate (see ARCHITECTURE.md §sync); schema is sync-ready.
2. **Encryption at rest** relies on device/OS storage encryption; the app
   PIN is a UI lock, not disk encryption (SECURITY.md).
3. **Attachments** support camera/gallery capture, captions, types,
   compression, EXIF stripping, previews, safe delete, and backup
   round-trip; PDFs reference captions but do **not embed images**, and
   attachments are session-level (not per-exercise) in the UI.
4. **Bundle size** ~1.9 MB JS (ExcelJS + jsPDF dominate). Precached by the
   service worker, so it downloads once per version; could be code-split
   later.
5. **Locked records** cannot be unlocked in the UI (by design; a fresh
   correction workflow would require policy discussion).
6. **exceljs bundled uuid** advisory (2 moderate) — code path unreachable;
   documented in SECURITY.md.
7. Automated UI-component tests are thinner than logic tests; UI was
   verified by scripted browser walkthrough. The embedded browser tool's
   synthetic tap events were unreliable during verification, so flows were
   driven by dispatching real DOM click events — same handlers, same code
   paths.

## 6. Reproducing

```bash
npm install
npm test                              # 53 tests
npm run build                         # typecheck + production build + SW
npx vitest run tools/samples.test.ts  # regenerate samples/
```
