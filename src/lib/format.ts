import { format, parseISO } from "date-fns";
import type { ActivityType, Blindness, DeviceType, HideOutcome, RecordStatus } from "../db/types";

/** Local-timezone calendar date as yyyy-MM-dd (toISOString would give UTC). */
export function localDateIso(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fmtDate(isoDate: string, pattern = "MM/dd/yyyy"): string {
  if (!isoDate) return "";
  try {
    return format(parseISO(isoDate), pattern);
  } catch {
    return isoDate;
  }
}

export function fmtDateTime(iso: string, pattern = "MM/dd/yyyy HH:mm"): string {
  if (!iso) return "";
  try {
    return format(new Date(iso), pattern);
  } catch {
    return iso;
  }
}

export function fmtMinutes(mins: number): string {
  if (!mins) return "0 min";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h} hr ${m} min` : `${m} min`;
}

export function fmtSeconds(secs: number | null): string {
  if (secs == null) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")} min` : `${s} sec`;
}

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  training: "Training",
  certification: "Certification",
  demonstration: "Demonstration",
  deployment_training: "Deployment",
  remedial: "Remedial training",
  other: "Other"
};

export const BLINDNESS_LABELS: Record<Blindness, string> = {
  known: "Known hide",
  single_blind: "Single-blind",
  double_blind: "Double-blind"
};

export const OUTCOME_LABELS: Record<HideOutcome, string> = {
  found_independent: "Found — independent",
  found_assisted: "Found — handler assisted",
  interest_no_indication: "Interest, no indication",
  missed: "Missed",
  not_searched: "Not searched",
  alert_unconfirmed: "Alert — nothing recovered"
};

/** Outcome wording for deployment records, where "hides" are real finds. */
export const DEPLOYMENT_OUTCOME_LABELS: Partial<Record<HideOutcome, string>> = {
  found_independent: "Device recovered",
  found_assisted: "Recovered — handler assisted",
  alert_unconfirmed: "Alert — nothing recovered",
  interest_no_indication: "Interest, no indication"
};

/** Outcome label appropriate to the record type. */
export const outcomeLabel = (outcome: HideOutcome, deployment: boolean) =>
  (deployment ? DEPLOYMENT_OUTCOME_LABELS[outcome] : undefined) ?? OUTCOME_LABELS[outcome];

/** True when a session is an operational deployment rather than training. */
export const isDeployment = (activityType: string) =>
  activityType === "deployment_training";

/** Route to the right editor for a draft record. */
export const draftEditorPath = (id: string, activityType: string) =>
  isDeployment(activityType) ? `/deployment/${id}` : `/session/${id}`;

export const STATUS_LABELS: Record<RecordStatus, string> = {
  draft: "Draft",
  completed: "Completed",
  reviewed: "Reviewed",
  locked: "Locked"
};

export const DEVICE_LABELS: Record<DeviceType, string> = {
  cellphone: "Cellphone",
  sd_card: "SD card",
  micro_sd: "MicroSD card",
  usb_drive: "USB drive",
  sim_card: "SIM card",
  hard_drive: "Hard drive",
  ssd: "SSD",
  tablet: "Tablet",
  laptop: "Laptop",
  dvr: "DVR",
  game_console: "Game console",
  training_aid_odor: "Odor training aid (non-device)",
  other: "Other"
};

export function pct(n: number | null): string {
  if (n == null) return "—";
  return `${Math.round(n * 100)}%`;
}

/** Device types in the order handlers reach for them. */
export const DEVICE_CHOICES: DeviceType[] = [
  "cellphone", "usb_drive", "sd_card", "micro_sd", "sim_card", "hard_drive",
  "ssd", "tablet", "laptop", "dvr", "game_console", "training_aid_odor", "other"
];

/** Short device names for buttons; DEVICE_LABELS stays the export wording. */
export const DEVICE_SHORT: Record<DeviceType, string> = {
  ...DEVICE_LABELS,
  micro_sd: "MicroSD",
  training_aid_odor: "Odor aid"
};

export const DEVICE_ICONS: Record<DeviceType, string> = {
  cellphone: "📱",
  sd_card: "💾",
  micro_sd: "💾",
  usb_drive: "🔌",
  sim_card: "📶",
  hard_drive: "🗄️",
  ssd: "🗄️",
  tablet: "📲",
  laptop: "💻",
  dvr: "📼",
  game_console: "🎮",
  training_aid_odor: "🧪",
  other: "❔"
};

/** "HH:mm" plus a number of minutes, wrapping past midnight. "" if start is empty. */
export function addMinutesToTime(hhmm: string, minutes: number): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return "";
  const total = (((Number(m[1]) * 60 + Number(m[2]) + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export type DaySlot = "morning" | "evening";

/**
 * Which of the K9's two daily sessions a record belongs to. Derived from the
 * start time (before noon = morning) so no new field is stored and every
 * existing record classifies itself.
 */
export function daySlot(startTime: string): DaySlot {
  const h = Number(startTime.split(":")[0]);
  return Number.isFinite(h) && startTime && h < 12 ? "morning" : "evening";
}

export const SLOT_LABELS: Record<DaySlot, string> = {
  morning: "Morning",
  evening: "Evening"
};
