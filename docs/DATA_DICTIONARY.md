# Data Dictionary

Authoritative definitions for every stored field and calculated metric.
The XLSX export includes a condensed copy on its "Data Dictionary" sheet;
the in-app version is under Help & field definitions.

## Record lifecycle (sessions.status)

| Value | Meaning |
| --- | --- |
| `draft` | Editable; autosaved continuously; survives app restarts. The only status that can be deleted. |
| `completed` | Finalized by the handler with an electronic acknowledgment (name + timestamp stored). Read-only except through documented corrections. |
| `reviewed` | A supervisor/trainer review (name, comments, timestamp) has been recorded on a completed record. |
| `locked` | Permanently read-only; corrections are refused. Not reversible in the UI. |

A correction to a finalized record stores: person, timestamp, stated
reason, and field-level before/after values in `revisions`. This is an
**auditability feature**; it does not by itself create a legal chain of
custody or guarantee admissibility.

## Sessions

| Field | Type | Meaning |
| --- | --- | --- |
| id | UUID | Stable record id; appears on reports and links XLSX sheets |
| date | ISO date | Local calendar date of the session |
| startTime / endTime | HH:mm | Optional; duration is calculated (crossing midnight supported) |
| activityType | enum | training, certification, demonstration, deployment_training, remedial, other |
| locationId/-Name/-Address | | Location reference plus denormalized text (records keep their text even if the reusable location is deleted) |
| environment | enum | indoor / outdoor / mixed |
| handlerName, k9Name | text | Copied per record so history is stable if the profile changes |
| trainerName | text | Trainer / evaluator / hide placer |
| otherPersonnel | text | Other participants or agencies |
| objective | text | What the session was meant to work on |
| summary | text | Narrative wrap-up |
| overallAssessment | 0–5 | Handler rating; 0 = not rated, 1 poor … 5 excellent |
| correctiveFollowUp | text | Corrective action / follow-up training needed (auto-creates a follow-up item on finalize) |
| nextFocus | text | Next recommended training focus |
| env | object | Environmental conditions (below) |
| welfare | object/null | K9 welfare check (below); null when not recorded |
| review | object/null | reviewerName, comments, reviewedAt |
| handlerAcknowledged(-At) | bool/timestamp | Electronic certification at finalize |
| createdAt/updatedAt/createdBy/modifiedBy | | Audit columns |

### Environmental conditions (sessions.env)

temperatureF, weather, wind, airflow (indoor ventilation), lighting,
noiseDistractions, surface, areaSize, clutterLevel (0–5),
accessibilityDifficulty (0–5), familiarLocation (yes/no/unset),
peoplePresent, animalsPresent, distractorOdors, notes. All optional.

### Welfare check (sessions.welfare)

conditionBefore, energyMotivation (0–5), recentFeeding, hydration,
healthConcerns (injury/illness/medication), heatSafetyConcern (bool),
restBreaks, notes. Only conditions that may explain or affect training
performance — not a veterinary record.

## Exercises

| Field | Meaning |
| --- | --- |
| sessionId, order | Parent link and display order |
| searchTypeId | Built-in (room, vehicle, parcel, boxes, outdoor, water, furniture, cluttered, elevated, buried, blank) or user-defined |
| roomTypes[] | For building searches: Residence, Office, School/classroom, Commercial, Warehouse, Jail/correctional, Hotel, Storage, Other |
| blindness | `known` (handler knew placements), `single_blind` (handler didn't), `double_blind` (nobody present knew) |
| isBlankSearch / blankCorrect | Deliberately target-free area; correct = K9 gave no final response |
| areaDescription | Free text |
| searchTimeSeconds / timeToFirstFindSeconds | Entered in minutes in the UI, stored in seconds |
| offLeash | bool |
| coverage, intensity, independence, focus, stamina, indicationQuality | 0–5 handler ratings (0 = not rated) |
| finalResponseType | e.g. "Sit (passive)" |
| handlerCueing | None / Minimal / Directed recheck / Significant |
| handlerStrategy | Free text |
| rewardType / rewardCups / rewardedAtSource | Food cups matter: ESD K9s are typically fed exclusively through training |
| falseResponses[] | Each: location, suspected cause, handler response. A false response is a **final response where no target odor was confirmed present** — recorded per exercise because it is not tied to any real hide |
| problems / correctiveTraining | Free text |
| result | successful / needs_work / unsatisfactory |
| comments | Free text |

## Hides

| Field | Meaning |
| --- | --- |
| exerciseId, sessionId, number | Parent links, display number |
| targetMaterial | Odor source (a training aid is not necessarily a functional device) |
| aidInventoryId | Optional training-aid inventory number |
| deviceType | cellphone, sd_card, micro_sd, usb_drive, sim_card, hard_drive, ssd, tablet, laptop, dvr, game_console, training_aid_odor, other (+ free-text description) |
| locationDescription | Required. Where the hide was placed |
| heightDescription | floor / knee / waist / chest / elevated |
| concealment | exposed / partially concealed / fully concealed / buried |
| accessible | Could the K9 physically reach source? (yes/no/unset) |
| difficulty | 0–5 |
| placedTime / ageMinutes | Placement time and aging before the search |
| placedBy | Person who placed the hide |
| handlerKnewLocation | yes/no/unset |
| outcome | See below |
| notes | Free text |

### Hide outcomes (never combined into one "finds" number)

| Code | Meaning | Counts as |
| --- | --- | --- |
| `found_independent` | Located with an independent final indication | Confirmed find, independent |
| `found_assisted` | Correct response after handler assistance / directed recheck | Confirmed find, assisted |
| `interest_no_indication` | Interest shown, no final response | Searched; neither find nor false response |
| `missed` | Area searched, hide not located | Miss |
| `not_searched` | Hide placed but its area was never searched | Excluded from find-rate math |
| (empty) | Outcome not yet recorded | Blocks finalization |

## Metrics (src/lib/stats.ts)

| Metric | Formula |
| --- | --- |
| Hides placed | count of hide records |
| Searched hides | hides with outcome ∈ {found_independent, found_assisted, interest_no_indication, missed} |
| Confirmed finds | found_independent + found_assisted |
| Misses | outcome = missed |
| False responses | Σ exercise.falseResponses.length |
| Blank searches / correct | exercises with isBlankSearch; correct where blankCorrect = true |
| **Find rate** | confirmed finds ÷ searched hides; **null** when searched hides = 0; flagged "small sample" below 20 searched hides |
| Session duration | endTime − startTime (+24 h if negative) |
| Total training time | Σ session durations where both times recorded |
| Days since practiced | today − max(session.date) per search type; > 21 days is surfaced as needing attention |

Find rate is a **training metric**, not a scientific estimate of operational
reliability, and the UI/reports say so wherever it appears.

## Sessions — v1.1 additions

| Field | Meaning |
| --- | --- |
| gps | Optional `{lat, lon, accuracyM, capturedAt}` captured on-device at the training site. Exported as GPS lat/lon columns and shown as a map link. |
| caseNumber | Optional case / incident / reference number (shown for non-training activity types; always exported). |

## Other tables

- **locations**: name, address, kind, favorite, useCount, lastUsedAt.
- **searchTypes**: label, builtIn, archived (custom types can be archived,
  never deleted, so old records always resolve).
- **revisions**: sessionId, timestamp, person, reason, kind
  (finalize/correction/status_change/review), changes[{field, before, after}].
  Append-only; no UI exists to edit or delete entries.
- **attachments**: sessionId, kind (hide_photo/environment_photo/diagram/
  document/other), caption, mimeType, blob, byteSize, createdAt. Images are
  re-encoded (max 1600 px, JPEG q0.82), which strips EXIF metadata.
- **followUps**: sessionId?, text, done, createdAt, completedAt.
- **commands** (v1.1): name, category (Obedience/Detection/Control/Other),
  proficiency (0–5), lastPracticed, notes, archived. Practice recency over
  7 days is flagged in the UI.
- **vaccinations** (v1.1): name, dateGiven, nextDueDate, administeredBy,
  notes. Due within 30 days or overdue triggers a home-screen reminder.
- **weights** (v1.1): date, weightLb, notes. Latest entry and delta vs the
  previous entry are shown on the K9 Health screen.
- **settings — v1.1 additions**: k9PhotoDataUrl, vetName, vetPhone,
  k9HealthNotes. Certification expiration within 60 days (or past) triggers
  a home-screen banner — ESD certifications are typically annual.

## Backup file format

`esd-k9-logs-backup`, formatVersion 1: JSON containing settings and every
table; attachment blobs base64-encoded. Restore validates the format marker,
version, table presence, and referential integrity (every exercise → session,
every hide → exercise) before writing anything, inside one transaction.
