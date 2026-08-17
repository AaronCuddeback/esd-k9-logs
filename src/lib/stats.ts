/**
 * Metric definitions (documented in Help > Field definitions and the
 * XLSX Data Dictionary sheet):
 *
 * - Hides placed        = count of hide records (excludes blank searches, which have none)
 * - Confirmed finds     = hides with outcome found_independent + found_assisted
 * - Independent finds   = outcome found_independent only
 * - Misses              = outcome missed
 * - Interest only       = outcome interest_no_indication (not a find, not a false response)
 * - False responses     = per-exercise false-response entries (final response where
 *                         no target odor was confirmed present)
 * - Blank searches      = exercises flagged isBlankSearch; "correct" when the K9
 *                         gave no final response in the blank area
 * - Find rate           = confirmed finds / searched hides, where searched hides =
 *                         hides with any recorded outcome other than not_searched.
 *                         Not computed when searched hides = 0.
 *
 * Find rate is a training metric only — it is not a scientific estimate of
 * operational reliability, and small samples are flagged in the UI.
 */
import type { Exercise, Hide, TrainingSession } from "../db/types";

export interface HideTally {
  hidesPlaced: number;
  searchedHides: number;
  confirmedFinds: number;
  independentFinds: number;
  assistedFinds: number;
  misses: number;
  interestOnly: number;
  notSearched: number;
}

export interface ExerciseTally {
  exercises: number;
  falseResponses: number;
  blankSearches: number;
  blankCorrect: number;
  blankIncorrect: number;
  totalSearchSeconds: number;
  totalRewardCups: number;
}

export interface StatsBundle extends HideTally, ExerciseTally {
  sessions: number;
  totalSessionMinutes: number;
  findRate: number | null; // 0..1 or null when no searched hides
  smallSample: boolean; // fewer than 20 searched hides
  bySearchType: Record<string, { exercises: number; hides: number; finds: number; misses: number; lastDate: string }>;
  byBlindness: Record<string, { hides: number; finds: number }>;
}

export function tallyHides(hides: Hide[]): HideTally {
  const t: HideTally = {
    hidesPlaced: 0,
    searchedHides: 0,
    confirmedFinds: 0,
    independentFinds: 0,
    assistedFinds: 0,
    misses: 0,
    interestOnly: 0,
    notSearched: 0
  };
  for (const h of hides) {
    t.hidesPlaced++;
    switch (h.outcome) {
      case "found_independent":
        t.searchedHides++;
        t.confirmedFinds++;
        t.independentFinds++;
        break;
      case "found_assisted":
        t.searchedHides++;
        t.confirmedFinds++;
        t.assistedFinds++;
        break;
      case "missed":
        t.searchedHides++;
        t.misses++;
        break;
      case "interest_no_indication":
        t.searchedHides++;
        t.interestOnly++;
        break;
      case "not_searched":
        t.notSearched++;
        break;
      default:
        // no outcome recorded yet — counted as placed but not searched
        break;
    }
  }
  return t;
}

export function tallyExercises(exercises: Exercise[]): ExerciseTally {
  const t: ExerciseTally = {
    exercises: exercises.length,
    falseResponses: 0,
    blankSearches: 0,
    blankCorrect: 0,
    blankIncorrect: 0,
    totalSearchSeconds: 0,
    totalRewardCups: 0
  };
  for (const e of exercises) {
    t.falseResponses += e.falseResponses.length;
    if (e.isBlankSearch) {
      t.blankSearches++;
      if (e.blankCorrect === true) t.blankCorrect++;
      if (e.blankCorrect === false) t.blankIncorrect++;
    }
    if (e.searchTimeSeconds) t.totalSearchSeconds += e.searchTimeSeconds;
    if (e.rewardCups) t.totalRewardCups += e.rewardCups;
  }
  return t;
}

export function sessionMinutes(s: TrainingSession): number {
  if (!s.startTime || !s.endTime) return 0;
  const [sh, sm] = s.startTime.split(":").map(Number);
  const [eh, em] = s.endTime.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // session crossed midnight
  return mins;
}

export function computeStats(
  sessions: TrainingSession[],
  exercises: Exercise[],
  hides: Hide[]
): StatsBundle {
  const ht = tallyHides(hides);
  const et = tallyExercises(exercises);
  const findRate = ht.searchedHides > 0 ? ht.confirmedFinds / ht.searchedHides : null;

  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const byType: StatsBundle["bySearchType"] = {};
  const hidesByExercise = new Map<string, Hide[]>();
  for (const h of hides) {
    const list = hidesByExercise.get(h.exerciseId) ?? [];
    list.push(h);
    hidesByExercise.set(h.exerciseId, list);
  }
  for (const e of exercises) {
    const entry = byType[e.searchTypeId] ?? {
      exercises: 0,
      hides: 0,
      finds: 0,
      misses: 0,
      lastDate: ""
    };
    entry.exercises++;
    const exHides = hidesByExercise.get(e.id) ?? [];
    const t = tallyHides(exHides);
    entry.hides += t.hidesPlaced;
    entry.finds += t.confirmedFinds;
    entry.misses += t.misses;
    const date = sessionById.get(e.sessionId)?.date ?? "";
    if (date > entry.lastDate) entry.lastDate = date;
    byType[e.searchTypeId] = entry;
  }

  const byBlindness: StatsBundle["byBlindness"] = {};
  const exById = new Map(exercises.map((e) => [e.id, e]));
  for (const h of hides) {
    const ex = exById.get(h.exerciseId);
    if (!ex) continue;
    const entry = byBlindness[ex.blindness] ?? { hides: 0, finds: 0 };
    entry.hides++;
    if (h.outcome === "found_independent" || h.outcome === "found_assisted") entry.finds++;
    byBlindness[ex.blindness] = entry;
  }

  return {
    ...ht,
    ...et,
    sessions: sessions.length,
    totalSessionMinutes: sessions.reduce((sum, s) => sum + sessionMinutes(s), 0),
    findRate,
    smallSample: ht.searchedHides < 20,
    bySearchType: byType,
    byBlindness
  };
}

/** Days since a search type was last practiced; null if never. */
export function daysSince(dateIso: string, today = new Date()): number | null {
  if (!dateIso) return null;
  const then = new Date(dateIso + "T00:00:00");
  return Math.floor((today.getTime() - then.getTime()) / 86400000);
}
