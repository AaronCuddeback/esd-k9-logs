# Security & Privacy

Training records are treated as potentially sensitive law-enforcement
information. This document states what the app does and — just as important
— what it does not claim.

## Data locality

- All records live in the browser's IndexedDB on the device. There is no
  server, no account, no cloud storage, and no network dependency.
- The app makes **zero network requests at runtime** beyond loading its own
  static files (which the service worker then caches; afterwards it runs
  fully offline).
- No analytics, advertising, tracking pixels, crash reporting, or
  telemetry of any kind. No data is sold, shared, or reused.
- Exports and backups leave the device only through the share/download
  action the user explicitly takes.

## Application security measures

- **App PIN**: stored as a salted SHA-256 hash (never plain text); optional
  auto-lock after 5/15/60 minutes of inactivity; manual "Lock now".
- **No secrets in the repository**: there are no API keys, credentials, or
  agency data anywhere in the source. Sample data is entirely fictional.
- **No sensitive data in logs**: the app writes no application logs; no
  crash-reporting SDK exists.
- **Input validation**: dates/times/counts validated before finalize;
  backup imports are schema- and referential-integrity-checked before a
  single row is written; restore is transactional (a bad file changes
  nothing).
- **Safe file handling**: attachments are size-capped, images re-encoded
  through canvas (strips EXIF including GPS), object URLs revoked after
  use. Export filenames contain no personal data beyond dates.
- **Identity withholding**: a setting removes handler/K9/trainer names from
  every export for redacted disclosures.

## Encryption at rest — honest statement

The app does **not** implement its own at-rest encryption. IndexedDB
content is protected by the device's storage encryption (standard on
Android with a screen lock, BitLocker/FileVault on desktop) and by the
browser profile boundary. The app PIN is a screen lock for the app UI, not
disk encryption: someone with full filesystem access to an unencrypted
device could read the database. Deployment guidance: require device
encryption + screen lock on any phone used for these records (standard
MDM policy). Application-layer encryption (e.g., encrypting record payloads
with a key derived from the PIN) is a possible future enhancement; it was
not shipped because a forgotten PIN would then mean unrecoverable records,
which conflicts with priority #1 (prevention of data loss).

## Transport security

The app must be served over HTTPS (a PWA requirement). Exports shared via
the Android share sheet inherit the security of whatever channel the user
picks — that choice is visible and deliberate, never automatic.

## Compliance

**No CJIS compliance claim is made.** CJIS compliance is a property of a
complete, contracted, audited deployment — not of an application in
isolation. Because this app stores data only on the device and transmits
nothing, most CJIS controls fall on device management (encryption, screen
lock, MDM) and on where the agency chooses to store backups and exports.
Agencies should route those through their existing evidence/records
policies.

## Dependency posture

Runtime dependencies are few, mainstream, and actively maintained: react,
react-router-dom 7, dexie (+hooks), date-fns, exceljs, jspdf 4 (+autotable 5).

`npm audit --omit=dev` status at delivery: jspdf/dompurify advisories
(1 critical, 1 high, several moderate) were **resolved** by upgrading to
jspdf 4 / jspdf-autotable 5; react-router advisories were **resolved** by
upgrading to react-router-dom 7. Two moderate advisories remain in
`exceljs`'s bundled `uuid` (< 11.1.1, buffer bounds check in uuid v3/v5/v6
when a `buf` argument is supplied). This code path is not reachable from
this app — ExcelJS uses uuid v4 without a buffer argument, and no untrusted
input flows into workbook generation. Accepted and documented; revisit when
ExcelJS ships an updated dependency. Pin versions via the committed
lockfile and review updates before deploying.

## Residual risks

| Risk | Mitigation |
| --- | --- |
| Device loss/theft | Device encryption + screen lock + app PIN; records recoverable from backups |
| Browser data cleared | Regular backup files (first-class feature, prominently documented) |
| Storage eviction under disk pressure | App requests persistent storage when installed; backups |
| Backup file disclosure | Backups are plaintext JSON by design (recoverability first) — store them per agency records policy |
| Shared-device snooping | App PIN + auto-lock; identity withholding for exports |
