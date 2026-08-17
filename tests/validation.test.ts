import { describe, expect, it } from "vitest";
import { hasErrors, validateForFinalize, validateHide, validateSession } from "../src/lib/validation";
import { newExercise, newHide, newSession } from "../src/db/factories";
import type { Hide } from "../src/db/types";

const validSession = () => {
  const s = newSession({ handlerName: "Det. Test", k9Name: "Cooper" });
  s.locationName = "Training annex";
  return s;
};

describe("validateSession", () => {
  it("accepts a complete session", () => {
    expect(hasErrors(validateSession(validSession()))).toBe(false);
  });
  it("requires date, location, handler, and K9", () => {
    const s = validSession();
    s.date = "not-a-date";
    s.locationName = " ";
    s.handlerName = "";
    s.k9Name = "";
    const issues = validateSession(s);
    expect(issues.filter((i) => i.severity === "error").map((i) => i.field).sort()).toEqual(
      ["date", "handlerName", "k9Name", "locationName"]
    );
  });
  it("rejects malformed times but allows empty times", () => {
    const s = validSession();
    s.startTime = "25:99";
    expect(hasErrors(validateSession(s))).toBe(true);
    s.startTime = "";
    s.endTime = "";
    expect(hasErrors(validateSession(s))).toBe(false);
  });
  it("warns (not errors) about future dates", () => {
    const s = validSession();
    const future = new Date();
    future.setDate(future.getDate() + 5);
    s.date = future.toISOString().slice(0, 10);
    const issues = validateSession(s);
    expect(hasErrors(issues)).toBe(false);
    expect(issues.some((i) => i.severity === "warning")).toBe(true);
  });
});

describe("validateForFinalize", () => {
  it("blocks finalization with no exercises", () => {
    const issues = validateForFinalize(validSession(), [], new Map());
    expect(issues.some((i) => i.field === "exercises" && i.severity === "error")).toBe(true);
  });
  it("blocks a non-blank exercise without hides", () => {
    const s = validSession();
    const ex = newExercise(s.id, 1);
    const issues = validateForFinalize(s, [ex], new Map());
    expect(hasErrors(issues)).toBe(true);
  });
  it("blocks a blank search without a recorded result", () => {
    const s = validSession();
    const ex = newExercise(s.id, 1);
    ex.isBlankSearch = true;
    ex.blankCorrect = null;
    const issues = validateForFinalize(s, [ex], new Map([[ex.id, []]]));
    expect(hasErrors(issues)).toBe(true);
    ex.blankCorrect = true;
    expect(hasErrors(validateForFinalize(s, [ex], new Map([[ex.id, []]])))).toBe(false);
  });
  it("blocks hides missing outcomes and passes complete records", () => {
    const s = validSession();
    const ex = newExercise(s.id, 1);
    const h: Hide = newHide(ex.id, s.id, 1);
    h.locationDescription = "Under desk";
    const map = new Map([[ex.id, [h]]]);
    expect(hasErrors(validateForFinalize(s, [ex], map))).toBe(true);
    h.outcome = "found_independent";
    expect(hasErrors(validateForFinalize(s, [ex], map))).toBe(false);
  });
  it("warns when first-find time exceeds search time", () => {
    const s = validSession();
    const ex = newExercise(s.id, 1);
    ex.searchTimeSeconds = 60;
    ex.timeToFirstFindSeconds = 120;
    const h = newHide(ex.id, s.id, 1);
    h.locationDescription = "x";
    h.outcome = "found_independent";
    const issues = validateForFinalize(s, [ex], new Map([[ex.id, [h]]]));
    expect(issues.some((i) => i.severity === "warning")).toBe(true);
  });
});

describe("validateHide", () => {
  it("requires a location description", () => {
    const h = newHide("e", "s", 1);
    expect(hasErrors(validateHide(h))).toBe(true);
    h.locationDescription = "Bookshelf";
    expect(hasErrors(validateHide(h))).toBe(false);
  });
  it("requires description when device type is other", () => {
    const h = newHide("e", "s", 1);
    h.locationDescription = "x";
    h.deviceType = "other";
    expect(hasErrors(validateHide(h))).toBe(true);
    h.deviceTypeOther = "Smart watch";
    expect(hasErrors(validateHide(h))).toBe(false);
  });
});
