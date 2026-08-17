import type { Exercise, Hide, TrainingSession } from "../db/types";
import { localDateIso } from "./format";

export interface ValidationIssue {
  field: string;
  message: string;
  severity: "error" | "warning";
}

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateSession(s: TrainingSession): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!DATE_RE.test(s.date)) {
    issues.push({ field: "date", message: "A valid date is required.", severity: "error" });
  } else if (s.date > localDateIso()) {
    issues.push({ field: "date", message: "Date is in the future.", severity: "warning" });
  }
  if (s.startTime && !TIME_RE.test(s.startTime))
    issues.push({ field: "startTime", message: "Start time must be HH:MM.", severity: "error" });
  if (s.endTime && !TIME_RE.test(s.endTime))
    issues.push({ field: "endTime", message: "End time must be HH:MM.", severity: "error" });
  if (!s.locationName.trim())
    issues.push({ field: "locationName", message: "Location is required.", severity: "error" });
  if (!s.handlerName.trim())
    issues.push({ field: "handlerName", message: "Handler is required.", severity: "error" });
  if (!s.k9Name.trim())
    issues.push({ field: "k9Name", message: "K9 name is required.", severity: "error" });
  return issues;
}

/** Issues that block finalization (in addition to validateSession errors). */
export function validateForFinalize(
  s: TrainingSession,
  exercises: Exercise[],
  hidesByExercise: Map<string, Hide[]>
): ValidationIssue[] {
  const issues = validateSession(s);
  if (exercises.length === 0)
    issues.push({
      field: "exercises",
      message: "Add at least one exercise before finalizing.",
      severity: "error"
    });
  for (const ex of exercises) {
    const hides = hidesByExercise.get(ex.id) ?? [];
    if (!ex.isBlankSearch && hides.length === 0)
      issues.push({
        field: `exercise-${ex.order}`,
        message: `Exercise ${ex.order}: no hides recorded. Mark it as a blank search or add hides.`,
        severity: "error"
      });
    if (ex.isBlankSearch && ex.blankCorrect === null)
      issues.push({
        field: `exercise-${ex.order}`,
        message: `Exercise ${ex.order}: record the blank-search result.`,
        severity: "error"
      });
    for (const h of hides) {
      if (!h.outcome)
        issues.push({
          field: `exercise-${ex.order}`,
          message: `Exercise ${ex.order}, hide ${h.number}: outcome not recorded.`,
          severity: "error"
        });
    }
    if (
      ex.timeToFirstFindSeconds != null &&
      ex.searchTimeSeconds != null &&
      ex.timeToFirstFindSeconds > ex.searchTimeSeconds
    )
      issues.push({
        field: `exercise-${ex.order}`,
        message: `Exercise ${ex.order}: time to first find exceeds total search time.`,
        severity: "warning"
      });
  }
  return issues;
}

export function validateHide(h: Hide): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!h.locationDescription.trim())
    issues.push({
      field: "locationDescription",
      message: "Describe where the hide was placed.",
      severity: "error"
    });
  if (h.placedTime && !TIME_RE.test(h.placedTime))
    issues.push({ field: "placedTime", message: "Placed time must be HH:MM.", severity: "error" });
  if (h.ageMinutes != null && (h.ageMinutes < 0 || h.ageMinutes > 60 * 24 * 30))
    issues.push({ field: "ageMinutes", message: "Aging time is out of range.", severity: "error" });
  if (h.deviceType === "other" && !h.deviceTypeOther.trim())
    issues.push({
      field: "deviceTypeOther",
      message: "Describe the device type.",
      severity: "error"
    });
  return issues;
}

export const hasErrors = (issues: ValidationIssue[]) =>
  issues.some((i) => i.severity === "error");
