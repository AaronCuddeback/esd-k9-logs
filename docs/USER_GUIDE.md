# User Guide

For the K9 handler. Everything here works with no internet connection.

## First run

Open the app → choose **Set up my team** (enter handler, K9, agency — all
editable later) or **Explore with sample data** to look around with the
fictional K9 Cooper dataset first.

## Daily training (v2.0)

The home screen opens on **Today**: a Morning and an Evening slot, plus
deployments. Each training is still its own record with its own times, so
court exports list them separately; the card just groups them by day. The
dots in the corner show the last 7 days (top = morning, bottom = evening).

1. Tap **＋ Morning training** (or Evening). The location, area searched and
   indoor/outdoor carry over from your last session, and Exercise 1 is
   already created.
2. Check **Where**: tap a saved location chip if it changed, confirm the
   area searched and Indoor / Outdoor / Mixed (chosen once, here).
3. In the exercise, tap **＋ Add hide** for each hide, tap the device to
   change it (repeats the last one), then **✓** found or **✗** missed.
   **Details** opens blindness, blank search, false responses, timing and
   per-hide placement when you need them.
4. Under **Time & record**: start time, then tap **15 / 20 / 30 / 45 min**
   (or **Other** for a custom end time), activity type and case #.
5. **Finish & save record** → certify → **Save record**.

A deployment can be logged at any time with **🚔 Log deployment**; a
morning or evening slot with only a deployment shows it, and you can still
add the training.

## Logging a deployment (a real search)

1. On **Today**, tap **🚔 Log deployment** and enter the location.
2. Enter the case / warrant number.
3. Tap the areas you searched (residence, vehicle, storage unit…).
4. For each device the K9 located, tap **＋ Add device located**, pick the
   device type, note where it was, and confirm **Device recovered** or
   **Nothing found** (an alert that produced nothing — log it honestly).
5. If the K9 searched and located nothing at all, add no devices: a cleared
   search is a valid record and saves without complaint.
6. **Finish & save record**.

Deployments never ask for hides, blindness, reward cups or drill ratings,
and their results are reported separately from your training statistics.

## Logging a training session (the 60-second version)

1. Tap **＋ New Session** (big green button, bottom right) → **Training** is
   already selected → tap a recent location. Date, time, handler and K9 fill
   themselves in.
2. Optionally fill **Area searched** under the location — which part of the
   site you worked ("master bedroom and garage", "back yard"). The location
   is the place; this is the area within it.
3. Tap **＋ Add exercise**. The search type and blindness carry over from
   your previous exercise, so a repeat drill needs no changes at all. Each
   exercise has its own **Area searched** too, so one session at "Home" can
   record "bedroom" on exercise 1 and "garage" on exercise 2.
4. Use the **＋ / −** stepper to set how many hides you placed. Each hide
   appears with big **✓ Found** / **✗ Missed** buttons — one tap each.
   Smaller buttons underneath cover *With help*, *Interest only* and
   *Not searched* when you need them.
5. Add a false response with the button on the exercise if one occurred.
6. Tap **Done**, add session notes if you want, then **Finish & save
   record** → tick the acknowledgment → **Save record**.

A three-hide box drill is roughly ten taps end to end. Everything else —
times, cups, leash, cueing, conditions, welfare, objective, ratings — lives
in the collapsed sections and is entirely optional. Turn on Settings →
*Show all detail fields* if you would rather have them open by default.

Everything autosaves as you type. If the phone dies, the app is killed, or
you get called out mid-entry, the draft is waiting on the Home screen when
you come back.

## Fixing a finalized record

Open the record → **Make a documented correction** → edit → **Save
correction** → enter the reason. The original values, your name, the time,
and the reason are kept permanently in **Revision history** (visible on
every record). Locked records cannot be corrected — only lock a record when
you are certain it is final.

## Supervisor review

Open a completed record → **Record supervisor review** → reviewer name and
comments. The record moves to *Reviewed* status.

## Finding records

- **History** tab: search box (location, objective, notes) + **Filters**
  (status, search type, date range, trainer, needs-follow-up).
- **Calendar** (icon in History, or from Home): month view; days with
  sessions are highlighted.
- **Stats** tab: totals, find rate, per-search-type recency ("14d ago"),
  blindness breakdown, monthly trend. Amber badges mean a search type
  hasn't been practiced in over 3 weeks.

## Reports and exports (Reports tab)

1. Pick the records: 30/90 days, 1 year, all, or a custom range.
2. Pick the output:
   - **Detailed session report** (PDF) — full narrative + hide tables +
     signature lines; for court prep, certification reviews, discovery.
   - **Condensed chronological log** (PDF, landscape) — one row per
     session; the professional replacement for the paper daily log.
   - **Summary with statistics** (PDF) — date-range stats with supporting
     session list.
   - **Excel workbook (XLSX)** — Sessions / Exercises / Hides / Outcomes /
     Summary / Data Dictionary sheets, filterable, real dates.
   - **CSV / JSON** — for portability and long-term migration.
3. On Android the share sheet opens (print, email, Drive, etc. — your
   choice); on desktop the file downloads. Nothing is ever transmitted
   automatically.

A single session can also be exported straight from its record page.

Settings → *Reports & exports* controls the report header/footer, whether
names appear in exports, and whether attachment captions are referenced.

## Attachments

On a session (draft or finalized): choose type + optional caption, then
**Take or choose a photo**. Photos are compressed and camera metadata
(GPS, device) is stripped. Deleting an attachment never touches the session
record.

## Backup and restore (do this regularly)

More → **Backup & restore**:

- **Create backup file** — one JSON file with every record, setting, and
  attachment. Save it to your agency share, a card, or wherever policy
  dictates. This is the recovery path if the phone is lost or site data is
  cleared.
- **Restore** — pick a backup file, choose **Merge** (adds sessions this
  device doesn't have; safe) or **Replace everything** (erases this device
  first; asks for confirmation), review the summary, confirm.

## Security options (Settings)

- **App PIN** + auto-lock timeout. The PIN is stored only as a salted hash.
  Use it together with your phone's screen lock and device encryption.
- **Lock now** button for handing the phone over.

## Custom search types

Settings → *Search types* → add (e.g., "Aircraft search"). Custom types can
be archived when no longer needed; historical records keep resolving.

## Command tracking (More → Command tracking)

Track each command's proficiency (1 learning – 5 mastered) and when it was
last practiced. Tap **✓** to mark a command practiced today; amber badges
flag commands not practiced in over a week. Start from the built-in
standard list or add your own.

## K9 health (More → K9 health)

- **Vaccinations**: record each vaccine with date given and next due date.
  Items due within 30 days (or overdue) get a badge here and a banner on
  the Home screen.
- **Weight log**: one-tap weight entries with the latest value and change
  shown at the top.
- **Vet & standing notes**: veterinarian contact and standing conditions
  (allergies, medications). Day-of condition still belongs in each
  session's welfare check.
- **Certification**: your certification expiration (set in the profile)
  drives a Home-screen warning starting 60 days out — ESD certifications
  are typically renewed annually.

## GPS and case numbers

In a session's basics card, tap **📍 Capture current GPS position** to
stamp the record with coordinates (the browser will ask for location
permission the first time). Coordinates appear on the record with a map
link and export as columns in the XLSX and lines in the PDF. For
deployment-related, certification, or other non-routine activity, a
**Case / reference #** field appears so records can be tied to a case.

## The follow-up list

Anything you type in "Corrective action / follow-up training needed"
becomes a checkable item in More → **Follow-up items** when the session is
finalized. Add ad-hoc items there too. The Home screen shows the open count.
