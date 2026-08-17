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
  deployment_training: "Deployment-related training",
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
  not_searched: "Not searched"
};

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
