/**
 * XLSX export — a genuine multi-worksheet workbook built with ExcelJS.
 * Worksheets: Sessions, Exercises, Hides, Outcomes, Summary, Data Dictionary.
 * Record IDs link the sheets; dates/times are real Excel date values;
 * every sheet has a frozen, filterable header row.
 */
import ExcelJS from "exceljs";
import type { AppSettings, Exercise, Hide, SearchTypeDef, TrainingSession } from "../db/types";
import { computeStats, sessionMinutes, tallyHides } from "./stats";
import {
  ACTIVITY_LABELS,
  BLINDNESS_LABELS,
  DEVICE_LABELS,
  OUTCOME_LABELS,
  STATUS_LABELS
} from "./format";

export interface ExportDataset {
  settings: AppSettings;
  sessions: TrainingSession[];
  exercises: Exercise[];
  hides: Hide[];
  searchTypes: SearchTypeDef[];
}

const HEADER_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF14532D" }
};

function styleHeader(sheet: ExcelJS.Worksheet) {
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  row.height = 24;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columnCount }
  };
}

function isoDateToExcel(iso: string): Date | "" {
  if (!iso) return "";
  return new Date(iso + "T00:00:00");
}

function isoDateTimeToExcel(iso: string): Date | "" {
  if (!iso) return "";
  return new Date(iso);
}

export async function buildWorkbook(data: ExportDataset): Promise<ExcelJS.Workbook> {
  const { settings, sessions, exercises, hides, searchTypes } = data;
  const typeLabel = (id: string) =>
    searchTypes.find((t) => t.id === id)?.label ?? id;
  const wb = new ExcelJS.Workbook();
  wb.creator = "ESD K9 Training Logs";
  wb.created = new Date();

  const identity = settings.includeIdentityInExports;

  // ---- Sessions sheet ----
  const sSheet = wb.addWorksheet("Sessions");
  sSheet.columns = [
    { header: "Session ID", key: "id", width: 38 },
    { header: "Date", key: "date", width: 12, style: { numFmt: "mm/dd/yyyy" } },
    { header: "Start", key: "start", width: 8 },
    { header: "End", key: "end", width: 8 },
    { header: "Duration (min)", key: "dur", width: 14 },
    { header: "Activity", key: "activity", width: 16 },
    { header: "Location", key: "loc", width: 28 },
    { header: "GPS lat", key: "lat", width: 11 },
    { header: "GPS lon", key: "lon", width: 11 },
    { header: "Case / ref #", key: "caseNum", width: 14 },
    { header: "Environment", key: "envir", width: 12 },
    { header: "Handler", key: "handler", width: 18 },
    { header: "K9", key: "k9", width: 12 },
    { header: "Trainer / Evaluator", key: "trainer", width: 20 },
    { header: "Objective", key: "objective", width: 40 },
    { header: "Summary", key: "summary", width: 60 },
    { header: "Overall (1-5)", key: "assessment", width: 12 },
    { header: "Temp (°F)", key: "temp", width: 10 },
    { header: "Weather", key: "weather", width: 18 },
    { header: "Follow-up needed", key: "followUp", width: 40 },
    { header: "Next focus", key: "nextFocus", width: 30 },
    { header: "Status", key: "status", width: 12 },
    { header: "Created", key: "created", width: 18, style: { numFmt: "mm/dd/yyyy hh:mm" } },
    { header: "Last modified", key: "modified", width: 18, style: { numFmt: "mm/dd/yyyy hh:mm" } },
    { header: "Reviewed by", key: "reviewer", width: 18 }
  ];
  for (const s of sessions) {
    sSheet.addRow({
      id: s.id,
      date: isoDateToExcel(s.date),
      start: s.startTime,
      end: s.endTime,
      dur: sessionMinutes(s),
      activity: ACTIVITY_LABELS[s.activityType],
      loc: s.locationName,
      lat: s.gps?.lat ?? "",
      lon: s.gps?.lon ?? "",
      caseNum: s.caseNumber,
      envir: s.environment,
      handler: identity ? s.handlerName : "[withheld]",
      k9: identity ? s.k9Name : "[withheld]",
      trainer: identity ? s.trainerName : "[withheld]",
      objective: s.objective,
      summary: s.summary,
      assessment: s.overallAssessment || "",
      temp: s.env.temperatureF ?? "",
      weather: s.env.weather,
      followUp: s.correctiveFollowUp,
      nextFocus: s.nextFocus,
      status: STATUS_LABELS[s.status],
      created: isoDateTimeToExcel(s.createdAt),
      modified: isoDateTimeToExcel(s.updatedAt),
      reviewer: s.review?.reviewerName ?? ""
    });
  }
  styleHeader(sSheet);

  // ---- Exercises sheet ----
  const eSheet = wb.addWorksheet("Exercises");
  eSheet.columns = [
    { header: "Exercise ID", key: "id", width: 38 },
    { header: "Session ID", key: "sessionId", width: 38 },
    { header: "Session date", key: "date", width: 12, style: { numFmt: "mm/dd/yyyy" } },
    { header: "#", key: "order", width: 5 },
    { header: "Search type", key: "type", width: 22 },
    { header: "Room types", key: "rooms", width: 24 },
    { header: "Blindness", key: "blind", width: 14 },
    { header: "Blank search", key: "blank", width: 12 },
    { header: "Blank result", key: "blankResult", width: 14 },
    { header: "Area", key: "area", width: 34 },
    { header: "Hides", key: "hides", width: 8 },
    { header: "Finds", key: "finds", width: 8 },
    { header: "Misses", key: "misses", width: 8 },
    { header: "False responses", key: "falseResp", width: 14 },
    { header: "Search time (sec)", key: "time", width: 14 },
    { header: "First find (sec)", key: "first", width: 14 },
    { header: "Off leash", key: "leash", width: 10 },
    { header: "Coverage", key: "coverage", width: 10 },
    { header: "Intensity", key: "intensity", width: 10 },
    { header: "Independence", key: "independence", width: 12 },
    { header: "Focus", key: "focus", width: 8 },
    { header: "Stamina", key: "stamina", width: 8 },
    { header: "Indication", key: "indication", width: 10 },
    { header: "Final response", key: "finalResp", width: 16 },
    { header: "Handler cueing", key: "cueing", width: 16 },
    { header: "Reward", key: "reward", width: 10 },
    { header: "Cups", key: "cups", width: 7 },
    { header: "Rewarded at source", key: "atSource", width: 16 },
    { header: "Result", key: "result", width: 14 },
    { header: "Problems", key: "problems", width: 40 },
    { header: "Corrective training", key: "corrective", width: 40 },
    { header: "Comments", key: "comments", width: 60 }
  ];
  for (const ex of exercises) {
    const session = sessions.find((s) => s.id === ex.sessionId);
    const exHides = hides.filter((h) => h.exerciseId === ex.id);
    const t = tallyHides(exHides);
    eSheet.addRow({
      id: ex.id,
      sessionId: ex.sessionId,
      date: isoDateToExcel(session?.date ?? ""),
      order: ex.order,
      type: typeLabel(ex.searchTypeId),
      rooms: ex.roomTypes.join(", "),
      blind: BLINDNESS_LABELS[ex.blindness],
      blank: ex.isBlankSearch ? "Yes" : "No",
      blankResult: ex.isBlankSearch
        ? ex.blankCorrect === true
          ? "Correct (clear)"
          : ex.blankCorrect === false
            ? "False response"
            : ""
        : "",
      area: ex.areaDescription,
      hides: t.hidesPlaced,
      finds: t.confirmedFinds,
      misses: t.misses,
      falseResp: ex.falseResponses.length,
      time: ex.searchTimeSeconds ?? "",
      first: ex.timeToFirstFindSeconds ?? "",
      leash: ex.offLeash ? "Yes" : "No",
      coverage: ex.coverage || "",
      intensity: ex.intensity || "",
      independence: ex.independence || "",
      focus: ex.focus || "",
      stamina: ex.stamina || "",
      indication: ex.indicationQuality || "",
      finalResp: ex.finalResponseType,
      cueing: ex.handlerCueing,
      reward: ex.rewardType,
      cups: ex.rewardCups ?? "",
      atSource: ex.rewardedAtSource === null ? "" : ex.rewardedAtSource ? "Yes" : "No",
      result: ex.result,
      problems: ex.problems,
      corrective: ex.correctiveTraining,
      comments: ex.comments
    });
  }
  styleHeader(eSheet);

  // ---- Hides sheet ----
  const hSheet = wb.addWorksheet("Hides");
  hSheet.columns = [
    { header: "Hide ID", key: "id", width: 38 },
    { header: "Exercise ID", key: "exerciseId", width: 38 },
    { header: "Session ID", key: "sessionId", width: 38 },
    { header: "Session date", key: "date", width: 12, style: { numFmt: "mm/dd/yyyy" } },
    { header: "Hide #", key: "num", width: 7 },
    { header: "Target material", key: "material", width: 24 },
    { header: "Aid inventory #", key: "aid", width: 14 },
    { header: "Device type", key: "device", width: 16 },
    { header: "Hide location", key: "loc", width: 44 },
    { header: "Height", key: "height", width: 12 },
    { header: "Concealment", key: "conceal", width: 16 },
    { header: "Accessible", key: "accessible", width: 10 },
    { header: "Difficulty (1-5)", key: "difficulty", width: 12 },
    { header: "Placed time", key: "placed", width: 10 },
    { header: "Aging (min)", key: "age", width: 10 },
    { header: "Placed by", key: "placedBy", width: 18 },
    { header: "Handler knew location", key: "knew", width: 18 },
    { header: "Outcome", key: "outcome", width: 24 },
    { header: "Notes", key: "notes", width: 60 }
  ];
  for (const h of hides) {
    const session = sessions.find((s) => s.id === h.sessionId);
    hSheet.addRow({
      id: h.id,
      exerciseId: h.exerciseId,
      sessionId: h.sessionId,
      date: isoDateToExcel(session?.date ?? ""),
      num: h.number,
      material: h.targetMaterial,
      aid: h.aidInventoryId,
      device: h.deviceType === "other" ? h.deviceTypeOther : DEVICE_LABELS[h.deviceType],
      loc: h.locationDescription,
      height: h.heightDescription,
      conceal: h.concealment,
      accessible: h.accessible === null ? "" : h.accessible ? "Yes" : "No",
      difficulty: h.difficulty || "",
      placed: h.placedTime,
      age: h.ageMinutes ?? "",
      placedBy: identity ? h.placedBy : "[withheld]",
      knew: h.handlerKnewLocation === null ? "" : h.handlerKnewLocation ? "Yes" : "No",
      outcome: h.outcome ? OUTCOME_LABELS[h.outcome] : "",
      notes: h.notes
    });
  }
  styleHeader(hSheet);

  // ---- Outcomes sheet (one row per recorded K9 response incl. false responses) ----
  const oSheet = wb.addWorksheet("Outcomes");
  oSheet.columns = [
    { header: "Session ID", key: "sessionId", width: 38 },
    { header: "Exercise ID", key: "exerciseId", width: 38 },
    { header: "Session date", key: "date", width: 12, style: { numFmt: "mm/dd/yyyy" } },
    { header: "Search type", key: "type", width: 22 },
    { header: "Blindness", key: "blind", width: 14 },
    { header: "Outcome category", key: "category", width: 24 },
    { header: "Detail", key: "detail", width: 60 },
    { header: "Related hide ID", key: "hideId", width: 38 }
  ];
  for (const ex of exercises) {
    const session = sessions.find((s) => s.id === ex.sessionId);
    const base = {
      sessionId: ex.sessionId,
      exerciseId: ex.id,
      date: isoDateToExcel(session?.date ?? ""),
      type: typeLabel(ex.searchTypeId),
      blind: BLINDNESS_LABELS[ex.blindness]
    };
    for (const h of hides.filter((x) => x.exerciseId === ex.id)) {
      if (!h.outcome) continue;
      oSheet.addRow({
        ...base,
        category: OUTCOME_LABELS[h.outcome],
        detail: h.locationDescription,
        hideId: h.id
      });
    }
    for (const fr of ex.falseResponses) {
      oSheet.addRow({
        ...base,
        category: "False response",
        detail: `${fr.locationDescription}${fr.suspectedCause ? ` — suspected cause: ${fr.suspectedCause}` : ""}`,
        hideId: ""
      });
    }
    if (ex.isBlankSearch && ex.blankCorrect !== null) {
      oSheet.addRow({
        ...base,
        category: ex.blankCorrect ? "Blank search — correct clear" : "Blank search — false response",
        detail: ex.areaDescription,
        hideId: ""
      });
    }
  }
  styleHeader(oSheet);

  // ---- Summary sheet ----
  const stats = computeStats(sessions, exercises, hides);
  const sumSheet = wb.addWorksheet("Summary");
  sumSheet.columns = [
    { header: "Metric", key: "metric", width: 38 },
    { header: "Value", key: "value", width: 20 },
    { header: "Definition", key: "def", width: 90 }
  ];
  const rows: [string, string | number, string][] = [
    ["Sessions", stats.sessions, "Training sessions in this export"],
    ["Total session time (min)", stats.totalSessionMinutes, "Sum of (end time − start time) across sessions with both times recorded"],
    ["Exercises", stats.exercises, "Individual search exercises"],
    ["Hides placed", stats.hidesPlaced, "Hide records in this export"],
    ["Searched hides", stats.searchedHides, "Hides with a recorded outcome other than Not searched"],
    ["Confirmed finds", stats.confirmedFinds, "Found — independent plus Found — handler assisted"],
    ["Independent finds", stats.independentFinds, "Found with an independent final indication"],
    ["Assisted finds", stats.assistedFinds, "Correct response after handler assistance or directed recheck"],
    ["Misses", stats.misses, "Hides the K9 failed to locate"],
    ["Interest without indication", stats.interestOnly, "Interest shown but no final response (not counted as a find)"],
    ["False responses", stats.falseResponses, "Final responses where no target odor was confirmed present"],
    ["Blank searches", stats.blankSearches, "Exercises deliberately containing no target odor"],
    ["Blank searches — correct", stats.blankCorrect, "Blank searches the K9 cleared without a false response"],
    [
      "Find rate",
      stats.findRate == null ? "n/a" : `${Math.round(stats.findRate * 100)}%`,
      "Confirmed finds ÷ searched hides. Training metric only; not an operational reliability estimate." +
        (stats.smallSample ? " CAUTION: small sample (fewer than 20 searched hides)." : "")
    ],
    ["Total reward cups", stats.totalRewardCups, "Food-reward cups recorded across exercises"]
  ];
  for (const [metric, value, def] of rows) sumSheet.addRow({ metric, value, def });
  sumSheet.addRow({});
  sumSheet.addRow({ metric: "By search type", value: "", def: "" }).font = { bold: true };
  for (const [typeId, t] of Object.entries(stats.bySearchType)) {
    sumSheet.addRow({
      metric: `  ${typeLabel(typeId)}`,
      value: `${t.exercises} exercises`,
      def: `${t.hides} hides, ${t.finds} finds, ${t.misses} misses. Last practiced ${t.lastDate || "never"}.`
    });
  }
  styleHeader(sumSheet);

  // ---- Data Dictionary ----
  const dSheet = wb.addWorksheet("Data Dictionary");
  dSheet.columns = [
    { header: "Sheet", key: "sheet", width: 12 },
    { header: "Column", key: "col", width: 24 },
    { header: "Meaning", key: "meaning", width: 100 }
  ];
  const dict: [string, string, string][] = [
    ["Sessions", "Session ID", "Stable UUID for the training session. Links to Exercises and Hides sheets."],
    ["Sessions", "Duration (min)", "Calculated as end time minus start time; blank when either time is missing."],
    ["Sessions", "Activity", "Training, Certification, Demonstration, Deployment-related training, Remedial, or Other."],
    ["Sessions", "Overall (1-5)", "Handler's overall session assessment: 1 = poor, 5 = excellent."],
    ["Sessions", "Status", "Draft (editable), Completed (finalized by handler), Reviewed (supervisor review recorded), Locked (read-only)."],
    ["Exercises", "Blindness", "Known: handler knew hide locations. Single-blind: handler did not know. Double-blind: no participant present knew."],
    ["Exercises", "Blank search", "A deliberately target-free search area used to test for false responses."],
    ["Exercises", "Coverage / Intensity / Independence / Focus / Stamina / Indication", "Handler ratings, 1 (poor) to 5 (excellent). Blank = not rated."],
    ["Exercises", "Handler cueing", "Degree of handler assistance during the exercise."],
    ["Exercises", "Cups", "Food-reward cups given (ESD K9s are typically fed exclusively through training)."],
    ["Hides", "Device type", "Physical item hidden. 'Odor training aid' means a scent aid rather than a functional device."],
    ["Hides", "Aging (min)", "Approximate minutes between hide placement and the start of the search."],
    ["Hides", "Outcome", "Found — independent; Found — handler assisted; Interest, no indication; Missed; Not searched."],
    ["Outcomes", "Outcome category", "One row per recorded K9 response, including false responses and blank-search results."],
    ["Summary", "Find rate", "Confirmed finds ÷ searched hides. Excludes hides never searched. Training metric only."]
  ];
  for (const [sheet, col, meaning] of dict) dSheet.addRow({ sheet, col, meaning });
  styleHeader(dSheet);

  return wb;
}

export async function exportXlsxBlob(data: ExportDataset): Promise<Blob> {
  const wb = await buildWorkbook(data);
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

/** CSV export of the session list (portability extra; XLSX is the primary format). */
export function exportSessionsCsv(data: ExportDataset): Blob {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [
    "session_id", "date", "start", "end", "activity", "location", "handler", "k9",
    "trainer", "objective", "summary", "overall", "status"
  ];
  const lines = [header.join(",")];
  for (const s of data.sessions) {
    lines.push([
      s.id, s.date, s.startTime, s.endTime, s.activityType, s.locationName,
      s.handlerName, s.k9Name, s.trainerName, s.objective, s.summary,
      s.overallAssessment || "", s.status
    ].map(esc).join(","));
  }
  return new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
}
