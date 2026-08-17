# Research: ESD / Detection-K9 Documentation Practices

Research conducted 2026-08-16 before the data model was finalized. This
summarizes what shaped the design, with sources. No field in this app is
claimed to be *legally required*; the design goal is records that align
with recognized professional guidance and that withstand scrutiny.

## 1. Summary of useful practices found

**Courts evaluate detection-dog reliability primarily through training and
certification records.** In *Florida v. Harris*, 568 U.S. 237 (2013), the
U.S. Supreme Court rejected a rigid checklist (including mandatory field
records) in favor of totality-of-the-circumstances review, and observed
that controlled training/certification results are often *better* evidence
of reliability than field data, because in the field false negatives go
unseen and unverified alerts can overstate false positives. Practical
consequence: consistent, complete, honest **training** logs are the
handler's central reliability evidence — and defense challenges focus on
gaps, especially missing false-response and blank-search documentation.
At least one lower-court decision discussed in K9 industry guidance found a
dog unreliable specifically because the handler kept no false-alert
records.

**SWGDOG / ANSI-ASB guidance** (Scientific Working Group on Dogs and
Orthogonal detection Guidelines; successor standards published through
AAFS/ASB, e.g. ANSI/ASB Standard 092) recommends: regular maintenance
training sufficient to maintain operational proficiency; periodic
proficiency assessment including odor-recognition, comprehensive, and
**double-blind** assessments; inclusion of **negative (blank) searches**;
recording assessment design (single- vs double-blind); recording
deficiencies and corrective action; and retention of training,
certification, and deployment records by handler and agency.

**ESD-specific practice**: ESD dogs detect triphenylphosphine oxide (TPPO),
a compound on storage-device circuit boards; devices trained include
phones, USB drives, SD/microSD cards, SIMs, hard drives, tablets. Most ESD
dogs (typically Labradors) are **food-reward** dogs fed only through
detection work — hence daily training is mandatory and the paper form's
"Cups" column is a welfare-relevant record, preserved in this app as
`rewardCups`. Training programs (e.g., Jordan Detection K9, Custom Canine
Unlimited) emphasize varied search environments — rooms mirrored from
warrant scenarios, vehicles, parcels, outdoor and water searches — and
courtroom-ready documentation.

**Commercial K9 record systems** (KATS, PACKTRACK, PoliceK9.com) confirm
the market-standard structure: session → exercise → hide/outcome records,
distinct outcome codes (alert / no alert / false response), environmental
conditions, deployment vs. training separation, and court-ready exports.

## 2. Features adopted beyond the paper form

Distinct outcome taxonomy (independent/assisted find, interest-only, miss,
false response, blank-clear); blindness level per exercise; hide-level
detail (placement, height, concealment, aging, placer, handler knowledge,
aid inventory number, odor-source vs device distinction); environmental and
difficulty context; handler-cueing documentation; corrective-action and
follow-up tracking; finalize/acknowledge/review/lock lifecycle with an
append-only revision log; defined metrics with small-sample warnings.

## 3. Uncertainties and conflicting practices

- No single mandated national standard exists for ESD K9 records; SWGDOG is
  guidance, not law, and certification bodies differ. The app therefore
  avoids claiming any field is legally required.
- Whether field-deployment records help or hurt reliability showings is
  contested (*Harris* discusses both directions). This app documents
  training; deployment logging is a possible future module.
- "False alert" terminology varies (false response / unverified alert /
  non-productive response). The app uses "false response" and lets the
  handler record suspected cause (e.g., residual odor), since an unverified
  response is not necessarily an error — a nuance the seed data
  deliberately illustrates.

## 4. Sources

- [Florida v. Harris — FindLaw full opinion](https://caselaw.findlaw.com/court/us-supreme-court/11-817.html)
- [Florida v. Harris — Cornell LII case page](https://www.law.cornell.edu/supct/cert/11-817_3)
- [SWGDOG general guidelines abstract — Office of Justice Programs](https://www.ojp.gov/ncjrs/virtual-library/abstracts/scientific-working-group-dogs-and-orthogonal-detection-guidelines)
- [General Guidelines for Training, Certification, and Documentation of Canine Detection Disciplines (draft, NIST-hosted)](https://www.nist.gov/system/files/documents/2019/06/10/088_std_guidelines_for_training_certification_and_documentation_of_canine_detection_disciplines_draft_06102019.pdf)
- [ANSI/ASB Standard 092 (dogs/handler teams)](https://www.aafs.org/sites/default/files/media/documents/092_Std_e1.pdf)
- [SWGDOG SC8 Substance Detector Dogs — Explosives section (NIST-hosted)](https://www.nist.gov/system/files/documents/2018/04/25/swgdog_substance_detector_dogs_-_explosives_detection.pdf)
- [KATS record-keeping basics (Florida v. Harris discussion)](https://katsplatinum.com/record-keeping-basics)
- [Electronic detection K9s — IACIS Journal 2023](https://iacis.org/iis/2023/4_iis_2023_40-50.pdf)
- [U.S. Secret Service — Electronic Detection Dogs](https://www.secretservice.gov/newsroom/behind-the-shades/2025/06/electronic-detection-dogs-equip-agencies-high-tech-tracking)
- [Jordan Detection K9 — Electronic Storage Detection](https://www.jordandetectionk9.com/electronics-detection)
- [Custom Canine Unlimited — ESD Handler Course](https://customcanineunlimited.com/law-enforcement-k9-training/electronic-storage-device-detection-dog-handler-course/)
- [AKC — Can Dogs Detect Cybercrime?](https://www.akc.org/expert-advice/news/can-dogs-detect-cybercrime/)
- [Inverse — how ESD dogs are trained (TPPO, food reward)](https://www.inverse.com/article/45988-how-to-become-a-bomb-sniffing-dog)
- [National Narcotic Detector Dog Association — The Double-Blind Attack](https://nndda.org/the-double-blind-attack/)
- [Officer.com — K9 Paperwork](https://www.officer.com/on-the-street/article/10250862/k9-paperwork)
- [PACKTRACK K9 record software](https://packtrackapp.com/) · [PoliceK9.com records management](https://policek9.com/k9-records-management)
