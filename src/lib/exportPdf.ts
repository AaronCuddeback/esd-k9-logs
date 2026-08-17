/**
 * PDF reports (jsPDF + autotable), three types:
 *  1. Detailed session report — full detail for one or more sessions
 *  2. Condensed chronological log — professional replacement for the paper form
 *  3. Date-range summary — statistics with supporting session list
 *
 * All reports share a header (agency / K9 / handler / range), footer with
 * page numbers and generation timestamp, and consistent table styling that
 * prints cleanly in color or black-and-white.
 */
import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import type { ExportDataset } from "./exportXlsx";
import type { Exercise, Hide, TrainingSession } from "../db/types";
import { computeStats, sessionMinutes, tallyHides } from "./stats";
import {
  ACTIVITY_LABELS,
  BLINDNESS_LABELS,
  DEVICE_LABELS,
  OUTCOME_LABELS,
  STATUS_LABELS,
  fmtDate,
  fmtMinutes,
  fmtSeconds
} from "./format";

const GREEN: [number, number, number] = [20, 83, 45];
const GRAY: [number, number, number] = [90, 90, 90];
const LIGHT: [number, number, number] = [240, 244, 241];

const MARGIN = 40;

interface ReportContext {
  doc: jsPDF;
  data: ExportDataset;
  rangeLabel: string;
  title: string;
}

function docHeader(ctx: ReportContext) {
  const { doc, data, title, rangeLabel } = ctx;
  const s = data.settings;
  const identity = s.includeIdentityInExports;
  let y = MARGIN;
  if (s.agencyLogoDataUrl) {
    try {
      doc.addImage(s.agencyLogoDataUrl, "PNG", MARGIN, y - 8, 42, 42);
    } catch {
      /* invalid logo image — skip */
    }
  }
  const textX = s.agencyLogoDataUrl ? MARGIN + 54 : MARGIN;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...GREEN);
  doc.text(s.reportHeader || s.agency || "ESD K9 Training Records", textX, y);
  y += 18;
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(title, textX, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  const lines = [
    identity
      ? `K9: ${s.k9Name || "—"} (${s.k9Breed || "—"})   Handler: ${s.handlerName || "—"}${s.handlerId ? ` #${s.handlerId}` : ""}   Unit: ${s.unit || "—"}`
      : "Identifying information withheld per settings",
    `Target odor: ${s.targetOdor || "—"}   Certification: ${s.currentCertDate ? `${fmtDate(s.currentCertDate)} (expires ${fmtDate(s.certExpirationDate)})` : "—"}`,
    `Report range: ${rangeLabel}`
  ];
  for (const line of lines) {
    doc.text(line, textX, y);
    y += 12;
  }
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(1.2);
  doc.line(MARGIN, y, doc.internal.pageSize.getWidth() - MARGIN, y);
  return y + 10;
}

function docFooters(ctx: ReportContext) {
  const { doc, data } = ctx;
  const pageCount = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const generated = new Date().toLocaleString();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(
      data.settings.reportFooter || "Training record",
      MARGIN,
      h - 22
    );
    doc.text(`Generated ${generated}`, MARGIN, h - 12);
    doc.text(`Page ${i} of ${pageCount}`, w - MARGIN, h - 12, { align: "right" });
  }
}

const tableDefaults = {
  margin: { left: MARGIN, right: MARGIN },
  styles: { fontSize: 8.5, cellPadding: 4, overflow: "linebreak" as const },
  headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold" as const },
  alternateRowStyles: { fillColor: LIGHT }
};

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y > pageH - 90) {
    doc.addPage();
    y = MARGIN;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...GREEN);
  doc.text(text, MARGIN, y);
  return y + 6;
}

function kvTable(doc: jsPDF, rows: [string, string][], startY: number): number {
  autoTable(doc, {
    ...tableDefaults,
    startY,
    theme: "plain",
    body: rows.filter(([, v]) => v !== "") as RowInput[],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 130, textColor: [60, 60, 60] as [number, number, number] },
      1: { cellWidth: "auto" }
    },
    styles: { ...tableDefaults.styles, cellPadding: 2.5 }
  });
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
}

function renderSessionDetail(
  ctx: ReportContext,
  session: TrainingSession,
  exercises: Exercise[],
  hides: Hide[],
  startY: number,
  attachmentRefs?: { caption: string; kind: string; createdAt: string }[]
): number {
  const { doc, data } = ctx;
  const typeLabel = (id: string) => data.searchTypes.find((t) => t.id === id)?.label ?? id;
  let y = sectionTitle(
    doc,
    `Session ${fmtDate(session.date)} — ${session.locationName || "Unnamed location"}`,
    startY
  );
  y = kvTable(
    doc,
    [
      ["Record ID", session.id],
      ["Status", STATUS_LABELS[session.status]],
      ["Activity", ACTIVITY_LABELS[session.activityType] + (session.activityOther ? ` — ${session.activityOther}` : "")],
      ["Time", `${session.startTime || "—"} to ${session.endTime || "—"} (${fmtMinutes(sessionMinutes(session))})`],
      ["Location", `${session.locationName}${session.locationAddress ? `, ${session.locationAddress}` : ""} (${session.environment})`],
      [
        "GPS",
        session.gps
          ? `${session.gps.lat}, ${session.gps.lon}${session.gps.accuracyM ? ` (±${session.gps.accuracyM} m)` : ""}`
          : ""
      ],
      ["Case / reference #", session.caseNumber],
      ["Handler / K9", `${session.handlerName} / ${session.k9Name}`],
      ["Trainer / evaluator", session.trainerName],
      ["Other personnel", session.otherPersonnel],
      ["Objective", session.objective],
      ["Environment", envSummary(session)],
      ["Welfare", welfareSummary(session)],
      ["Summary", session.summary],
      ["Overall assessment", session.overallAssessment ? `${session.overallAssessment} / 5` : ""],
      ["Corrective / follow-up", session.correctiveFollowUp],
      ["Next training focus", session.nextFocus],
      [
        "Attachments",
        attachmentRefs && attachmentRefs.length > 0
          ? `${attachmentRefs.length} on file: ${attachmentRefs
              .map((a) => a.caption || a.kind.replace("_", " "))
              .join("; ")}`
          : ""
      ],
      ["Handler acknowledgment", session.handlerAcknowledged ? `Acknowledged ${new Date(session.handlerAcknowledgedAt).toLocaleString()}` : ""],
      ["Review", session.review ? `${session.review.reviewerName} — ${session.review.comments || "no comments"} (${new Date(session.review.reviewedAt).toLocaleDateString()})` : ""],
      ["Created / modified", `${new Date(session.createdAt).toLocaleString()} / ${new Date(session.updatedAt).toLocaleString()}`]
    ],
    y
  );

  for (const ex of exercises.sort((a, b) => a.order - b.order)) {
    const exHides = hides
      .filter((h) => h.exerciseId === ex.id)
      .sort((a, b) => a.number - b.number);
    const t = tallyHides(exHides);
    y = sectionTitle(
      doc,
      `Exercise ${ex.order}: ${typeLabel(ex.searchTypeId)}${ex.isBlankSearch ? " (blank search)" : ""}`,
      y
    );
    const ratings = [
      ex.coverage && `coverage ${ex.coverage}`,
      ex.intensity && `intensity ${ex.intensity}`,
      ex.independence && `independence ${ex.independence}`,
      ex.focus && `focus ${ex.focus}`,
      ex.stamina && `stamina ${ex.stamina}`,
      ex.indicationQuality && `indication ${ex.indicationQuality}`
    ]
      .filter(Boolean)
      .join(", ");
    y = kvTable(
      doc,
      [
        ["Blindness", BLINDNESS_LABELS[ex.blindness]],
        ["Area", ex.areaDescription + (ex.roomTypes.length ? ` (${ex.roomTypes.join(", ")})` : "")],
        [
          "Results",
          ex.isBlankSearch
            ? ex.blankCorrect === true
              ? "Blank search — correctly cleared, no false response"
              : ex.blankCorrect === false
                ? "Blank search — false response given"
                : "Blank search — result not recorded"
            : `${t.hidesPlaced} hides: ${t.independentFinds} independent finds, ${t.assistedFinds} assisted, ${t.misses} missed, ${t.interestOnly} interest-only. ${ex.falseResponses.length} false response(s).`
        ],
        ["Search time", ex.searchTimeSeconds != null ? `${fmtSeconds(ex.searchTimeSeconds)}${ex.timeToFirstFindSeconds != null ? `, first find at ${fmtSeconds(ex.timeToFirstFindSeconds)}` : ""}` : ""],
        ["Ratings (1-5)", ratings],
        ["Final response", ex.finalResponseType],
        ["Handler cueing", ex.handlerCueing],
        ["Leash", ex.offLeash ? "Off leash" : "On leash"],
        ["Reward", `${ex.rewardType || "—"}${ex.rewardCups != null ? `, ${ex.rewardCups} cup(s)` : ""}${ex.rewardedAtSource === true ? ", rewarded at source" : ex.rewardedAtSource === false ? ", not rewarded at source" : ""}`],
        ["Problems", ex.problems],
        ["Corrective training", ex.correctiveTraining],
        ["Exercise result", ex.result ? ex.result.replace("_", " ") : ""],
        ["Comments", ex.comments]
      ],
      y
    );
    if (exHides.length > 0) {
      autoTable(doc, {
        ...tableDefaults,
        startY: y,
        head: [["#", "Device", "Hide location", "Concealment", "Blind?", "Outcome", "Notes"]],
        body: exHides.map((h) => [
          String(h.number),
          h.deviceType === "other" ? h.deviceTypeOther : DEVICE_LABELS[h.deviceType],
          h.locationDescription,
          [h.concealment, h.heightDescription].filter(Boolean).join(", "),
          h.handlerKnewLocation === null ? "—" : h.handlerKnewLocation ? "Known" : "Blind",
          h.outcome ? OUTCOME_LABELS[h.outcome] : "—",
          h.notes
        ])
      });
      y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }
    if (ex.falseResponses.length > 0) {
      autoTable(doc, {
        ...tableDefaults,
        startY: y,
        head: [["False response location", "Suspected cause", "Handler response"]],
        body: ex.falseResponses.map((f) => [f.locationDescription, f.suspectedCause, f.handlerResponse])
      });
      y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }
  }
  return y + 6;
}

function envSummary(s: TrainingSession): string {
  const e = s.env;
  return [
    e.temperatureF != null && `${e.temperatureF}°F`,
    e.weather,
    e.wind && `wind: ${e.wind}`,
    e.airflow && `airflow: ${e.airflow}`,
    e.lighting && `lighting: ${e.lighting}`,
    e.surface && `surface: ${e.surface}`,
    e.areaSize && `area: ${e.areaSize}`,
    e.clutterLevel ? `clutter ${e.clutterLevel}/5` : "",
    e.familiarLocation === false ? "unfamiliar location" : "",
    e.distractorOdors && `distractors: ${e.distractorOdors}`,
    e.notes
  ]
    .filter(Boolean)
    .join("; ");
}

function welfareSummary(s: TrainingSession): string {
  const w = s.welfare;
  if (!w) return "";
  return [
    w.conditionBefore && `condition: ${w.conditionBefore}`,
    w.energyMotivation ? `energy ${w.energyMotivation}/5` : "",
    w.healthConcerns && `health: ${w.healthConcerns}`,
    w.heatSafetyConcern ? "heat-safety concern noted" : "",
    w.restBreaks && `rest: ${w.restBreaks}`,
    w.notes
  ]
    .filter(Boolean)
    .join("; ");
}

// ---------- public API ----------

export interface SessionBundle {
  session: TrainingSession;
  exercises: Exercise[];
  hides: Hide[];
  /** Attachment references (captions only, no image data) for the report. */
  attachmentRefs?: { caption: string; kind: string; createdAt: string }[];
}

export function buildDetailedReport(data: ExportDataset, bundles: SessionBundle[]): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const rangeLabel =
    bundles.length === 1
      ? fmtDate(bundles[0].session.date)
      : `${fmtDate(bundles[bundles.length - 1].session.date)} – ${fmtDate(bundles[0].session.date)} (${bundles.length} sessions)`;
  const ctx: ReportContext = { doc, data, rangeLabel, title: "Detailed Training Session Report" };
  let y = docHeader(ctx);
  bundles.forEach((b, i) => {
    if (i > 0) {
      doc.addPage();
      y = MARGIN;
    }
    y = renderSessionDetail(ctx, b.session, b.exercises, b.hides, y, b.attachmentRefs);
    if (data.settings.reportHeader || true) {
      // signature block on final page of each session when enabled
    }
  });
  appendSignatureBlock(ctx, y);
  docFooters(ctx);
  return doc;
}

function appendSignatureBlock(ctx: ReportContext, y: number) {
  const { doc } = ctx;
  const h = doc.internal.pageSize.getHeight();
  if (y > h - 110) {
    doc.addPage();
    y = MARGIN;
  }
  y = Math.max(y + 20, h - 130);
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.8);
  const w = doc.internal.pageSize.getWidth();
  const colW = (w - MARGIN * 2 - 40) / 2;
  doc.line(MARGIN, y + 30, MARGIN + colW, y + 30);
  doc.line(MARGIN + colW + 40, y + 30, w - MARGIN, y + 30);
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);
  doc.setFont("helvetica", "normal");
  doc.text("Handler signature / date", MARGIN, y + 42);
  doc.text("Supervisor / trainer signature / date", MARGIN + colW + 40, y + 42);
}

export function buildCondensedLog(data: ExportDataset, bundles: SessionBundle[]): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape" });
  const sorted = [...bundles].sort((a, b) => a.session.date.localeCompare(b.session.date));
  const rangeLabel = sorted.length
    ? `${fmtDate(sorted[0].session.date)} – ${fmtDate(sorted[sorted.length - 1].session.date)} (${sorted.length} sessions)`
    : "No sessions";
  const ctx: ReportContext = { doc, data, rangeLabel, title: "Condensed Daily Training Log" };
  const y = docHeader(ctx);
  const typeLabel = (id: string) => data.searchTypes.find((t) => t.id === id)?.label ?? id;
  autoTable(doc, {
    ...tableDefaults,
    startY: y,
    head: [
      ["Date", "Location", "Search types", "Blind", "Hides", "Finds (ind/asst)", "Miss", "False", "Blank", "Cups", "Time", "Result / comments", "Status"]
    ],
    body: sorted.map((b) => {
      const t = tallyHides(b.hides);
      const falseCount = b.exercises.reduce((n, e) => n + e.falseResponses.length, 0);
      const blanks = b.exercises.filter((e) => e.isBlankSearch);
      const cups = b.exercises.reduce((n, e) => n + (e.rewardCups ?? 0), 0);
      const types = [...new Set(b.exercises.map((e) => typeLabel(e.searchTypeId)))].join(", ");
      const blind = [...new Set(b.exercises.map((e) => BLINDNESS_LABELS[e.blindness]))].join(", ");
      return [
        fmtDate(b.session.date),
        b.session.locationName,
        types,
        blind,
        String(t.hidesPlaced),
        `${t.confirmedFinds} (${t.independentFinds}/${t.assistedFinds})`,
        String(t.misses),
        String(falseCount),
        blanks.length ? `${blanks.filter((e) => e.blankCorrect).length}/${blanks.length} ok` : "—",
        cups ? String(cups) : "—",
        fmtMinutes(sessionMinutes(b.session)),
        [b.session.summary, b.session.correctiveFollowUp && `Follow-up: ${b.session.correctiveFollowUp}`]
          .filter(Boolean)
          .join(" ")
          .slice(0, 220),
        STATUS_LABELS[b.session.status]
      ];
    }),
    columnStyles: {
      1: { cellWidth: 80 },
      2: { cellWidth: 90 },
      11: { cellWidth: 170 }
    }
  });
  docFooters(ctx);
  return doc;
}

export function buildSummaryReport(data: ExportDataset, bundles: SessionBundle[]): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const sorted = [...bundles].sort((a, b) => a.session.date.localeCompare(b.session.date));
  const rangeLabel = sorted.length
    ? `${fmtDate(sorted[0].session.date)} – ${fmtDate(sorted[sorted.length - 1].session.date)} (${sorted.length} sessions)`
    : "No sessions";
  const ctx: ReportContext = { doc, data, rangeLabel, title: "Training Summary Report" };
  let y = docHeader(ctx);

  const sessions = sorted.map((b) => b.session);
  const exercises = sorted.flatMap((b) => b.exercises);
  const hides = sorted.flatMap((b) => b.hides);
  const stats = computeStats(sessions, exercises, hides);
  const typeLabel = (id: string) => data.searchTypes.find((t) => t.id === id)?.label ?? id;

  y = sectionTitle(doc, "Statistics", y);
  autoTable(doc, {
    ...tableDefaults,
    startY: y,
    head: [["Metric", "Value", "Notes"]],
    body: [
      ["Sessions / total time", `${stats.sessions} / ${fmtMinutes(stats.totalSessionMinutes)}`, ""],
      ["Exercises", String(stats.exercises), `${stats.blankSearches} blank searches (${stats.blankCorrect} correctly cleared)`],
      ["Hides placed / searched", `${stats.hidesPlaced} / ${stats.searchedHides}`, ""],
      ["Confirmed finds", String(stats.confirmedFinds), `${stats.independentFinds} independent, ${stats.assistedFinds} assisted`],
      ["Misses", String(stats.misses), ""],
      ["Interest without indication", String(stats.interestOnly), "Not counted as finds or false responses"],
      ["False responses", String(stats.falseResponses), ""],
      [
        "Find rate",
        stats.findRate == null ? "n/a" : `${Math.round(stats.findRate * 100)}%`,
        `Confirmed finds ÷ searched hides.${stats.smallSample ? " Small sample — interpret with caution." : ""} Training metric; not an operational reliability estimate.`
      ],
      ["Reward cups", String(stats.totalRewardCups), ""]
    ]
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;

  y = sectionTitle(doc, "By search type", y);
  autoTable(doc, {
    ...tableDefaults,
    startY: y,
    head: [["Search type", "Exercises", "Hides", "Finds", "Misses", "Last practiced"]],
    body: Object.entries(stats.bySearchType).map(([id, t]) => [
      typeLabel(id),
      String(t.exercises),
      String(t.hides),
      String(t.finds),
      String(t.misses),
      t.lastDate ? fmtDate(t.lastDate) : "never"
    ])
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;

  y = sectionTitle(doc, "By blindness level", y);
  autoTable(doc, {
    ...tableDefaults,
    startY: y,
    head: [["Blindness", "Hides", "Finds"]],
    body: Object.entries(stats.byBlindness).map(([b, t]) => [
      BLINDNESS_LABELS[b as keyof typeof BLINDNESS_LABELS] ?? b,
      String(t.hides),
      String(t.finds)
    ])
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;

  y = sectionTitle(doc, "Supporting session detail", y);
  autoTable(doc, {
    ...tableDefaults,
    startY: y,
    head: [["Date", "Location", "Objective", "Hides", "Finds", "Miss", "False", "Overall", "Status", "Record ID"]],
    body: sorted.map((b) => {
      const t = tallyHides(b.hides);
      const falseCount = b.exercises.reduce((n, e) => n + e.falseResponses.length, 0);
      return [
        fmtDate(b.session.date),
        b.session.locationName,
        b.session.objective.slice(0, 90),
        String(t.hidesPlaced),
        String(t.confirmedFinds),
        String(t.misses),
        String(falseCount),
        b.session.overallAssessment ? `${b.session.overallAssessment}/5` : "—",
        STATUS_LABELS[b.session.status],
        b.session.id.slice(0, 8)
      ];
    }),
    columnStyles: { 2: { cellWidth: 130 }, 9: { fontSize: 7 } }
  });
  docFooters(ctx);
  return doc;
}

export function pdfBlob(doc: jsPDF): Blob {
  return doc.output("blob");
}
