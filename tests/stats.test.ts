import { describe, expect, it } from "vitest";
import { computeStats, sessionMinutes, tallyHides, daysSince } from "../src/lib/stats";
import { newExercise, newHide, newSession } from "../src/db/factories";
import type { Hide } from "../src/db/types";

const mkSession = () => newSession({ handlerName: "H", k9Name: "K" });

function hideWith(outcome: Hide["outcome"], exerciseId = "ex1", sessionId = "s1"): Hide {
  const h = newHide(exerciseId, sessionId, 1);
  h.outcome = outcome;
  return h;
}

describe("tallyHides", () => {
  it("keeps outcome categories distinct — never a lumped 'finds' number", () => {
    const hides = [
      hideWith("found_independent"),
      hideWith("found_independent"),
      hideWith("found_assisted"),
      hideWith("missed"),
      hideWith("interest_no_indication"),
      hideWith("not_searched"),
      hideWith("") // outcome not recorded
    ];
    const t = tallyHides(hides);
    expect(t.hidesPlaced).toBe(7);
    expect(t.independentFinds).toBe(2);
    expect(t.assistedFinds).toBe(1);
    expect(t.confirmedFinds).toBe(3);
    expect(t.misses).toBe(1);
    expect(t.interestOnly).toBe(1);
    expect(t.notSearched).toBe(1);
    // searched = found(3) + missed(1) + interest(1); excludes not_searched and blank outcome
    expect(t.searchedHides).toBe(5);
  });
});

describe("computeStats", () => {
  it("computes find rate as confirmed finds / searched hides", () => {
    const s = mkSession();
    const ex = newExercise(s.id, 1);
    const hides = [
      hideWith("found_independent", ex.id, s.id),
      hideWith("found_assisted", ex.id, s.id),
      hideWith("missed", ex.id, s.id),
      hideWith("not_searched", ex.id, s.id)
    ];
    const st = computeStats([s], [ex], hides);
    expect(st.findRate).toBeCloseTo(2 / 3);
    expect(st.smallSample).toBe(true);
  });

  it("returns null find rate when no hides were searched", () => {
    const s = mkSession();
    const ex = newExercise(s.id, 1);
    const st = computeStats([s], [ex], [hideWith("not_searched", ex.id, s.id)]);
    expect(st.findRate).toBeNull();
  });

  it("counts false responses and blank searches from exercises", () => {
    const s = mkSession();
    const ex1 = newExercise(s.id, 1);
    ex1.falseResponses = [
      { id: "f1", locationDescription: "cabinet", suspectedCause: "", handlerResponse: "" }
    ];
    const ex2 = newExercise(s.id, 2);
    ex2.isBlankSearch = true;
    ex2.blankCorrect = true;
    const ex3 = newExercise(s.id, 3);
    ex3.isBlankSearch = true;
    ex3.blankCorrect = false;
    const st = computeStats([s], [ex1, ex2, ex3], []);
    expect(st.falseResponses).toBe(1);
    expect(st.blankSearches).toBe(2);
    expect(st.blankCorrect).toBe(1);
    expect(st.blankIncorrect).toBe(1);
  });

  it("aggregates by search type and blindness", () => {
    const s = mkSession();
    s.date = "2026-08-01";
    const ex = newExercise(s.id, 1);
    ex.searchTypeId = "vehicle";
    ex.blindness = "double_blind";
    const h = hideWith("found_independent", ex.id, s.id);
    const st = computeStats([s], [ex], [h]);
    expect(st.bySearchType.vehicle.exercises).toBe(1);
    expect(st.bySearchType.vehicle.finds).toBe(1);
    expect(st.bySearchType.vehicle.lastDate).toBe("2026-08-01");
    expect(st.byBlindness.double_blind).toEqual({ hides: 1, finds: 1 });
  });
});

describe("sessionMinutes", () => {
  it("computes duration from start and end times", () => {
    const s = mkSession();
    s.startTime = "08:30";
    s.endTime = "10:05";
    expect(sessionMinutes(s)).toBe(95);
  });
  it("handles sessions crossing midnight", () => {
    const s = mkSession();
    s.startTime = "23:30";
    s.endTime = "00:45";
    expect(sessionMinutes(s)).toBe(75);
  });
  it("returns 0 when times are missing", () => {
    const s = mkSession();
    s.startTime = "";
    s.endTime = "";
    expect(sessionMinutes(s)).toBe(0);
  });
});

describe("daysSince", () => {
  it("computes whole days", () => {
    expect(daysSince("2026-08-10", new Date("2026-08-16T12:00:00"))).toBe(6);
    expect(daysSince("")).toBeNull();
  });
});
