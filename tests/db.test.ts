/**
 * Database lifecycle & integrity tests against fake-indexeddb:
 * draft persistence (crash recovery), finalize, correction audit trail,
 * locked-record protection, cascade delete, duplicate setup, seed integrity.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EsdK9Db, ensureSearchTypes, uuid } from "../src/db/db";
import { newExercise, newHide, newSession } from "../src/db/factories";
import {
  deleteDraftSession,
  deleteExercise,
  duplicateSessionSetup,
  finalizeSession,
  loadFullSession,
  recordCorrection,
  reviewSession,
  saveExercise,
  saveHide,
  saveSessionDraft,
  setSessionStatus
} from "../src/db/repo";
import { seedDatabase } from "../src/db/seed";

let db: EsdK9Db;

beforeEach(() => {
  db = new EsdK9Db(`test-${uuid()}`);
});
afterEach(async () => {
  await db.delete();
});

async function makeDraft() {
  const s = newSession({ handlerName: "Det. Test", k9Name: "Cooper" });
  s.locationName = "Annex";
  await saveSessionDraft(s, db);
  const ex = newExercise(s.id, 1);
  await saveExercise(ex, db);
  const h = newHide(ex.id, s.id, 1);
  h.locationDescription = "Under desk";
  h.outcome = "found_independent";
  await saveHide(h, db);
  return { s, ex, h };
}

describe("draft persistence (crash recovery)", () => {
  it("drafts written to the database survive reopening the connection", async () => {
    const { s } = await makeDraft();
    db.close();
    const reopened = new EsdK9Db(db.name);
    const loaded = await loadFullSession(s.id, reopened);
    expect(loaded).not.toBeNull();
    expect(loaded!.session.status).toBe("draft");
    expect(loaded!.exercises).toHaveLength(1);
    expect(loaded!.hides).toHaveLength(1);
    reopened.close();
  });
});

describe("finalize", () => {
  it("marks completed with acknowledgment and writes a revision entry", async () => {
    const { s } = await makeDraft();
    await finalizeSession(s.id, "Det. Test", db);
    const after = await db.sessions.get(s.id);
    expect(after!.status).toBe("completed");
    expect(after!.handlerAcknowledged).toBe(true);
    const revs = await db.revisions.where("sessionId").equals(s.id).toArray();
    expect(revs).toHaveLength(1);
    expect(revs[0].kind).toBe("finalize");
  });

  it("cannot finalize twice", async () => {
    const { s } = await makeDraft();
    await finalizeSession(s.id, "Det. Test", db);
    await expect(finalizeSession(s.id, "Det. Test", db)).rejects.toThrow();
  });

  it("creates a follow-up item when corrective training is flagged", async () => {
    const { s } = await makeDraft();
    s.correctiveFollowUp = "Repeat elevated hides";
    await saveSessionDraft(s, db);
    await finalizeSession(s.id, "Det. Test", db);
    const items = await db.followUps.where("sessionId").equals(s.id).toArray();
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe("Repeat elevated hides");
    expect(items[0].done).toBe(false);
  });
});

describe("corrections & audit trail", () => {
  it("preserves original values with person, time, and reason", async () => {
    const { s } = await makeDraft();
    await finalizeSession(s.id, "Det. Test", db);
    const current = (await db.sessions.get(s.id))!;
    const updated = { ...current, locationName: "Corrected Annex" };
    await recordCorrection(updated, "Det. Test", "Wrong building name", db);
    const revs = await db.revisions.where("sessionId").equals(s.id).toArray();
    const corr = revs.find((r) => r.kind === "correction")!;
    expect(corr.reason).toBe("Wrong building name");
    expect(corr.person).toBe("Det. Test");
    expect(corr.changes).toContainEqual({
      field: "locationName",
      before: "Annex",
      after: "Corrected Annex"
    });
    expect((await db.sessions.get(s.id))!.locationName).toBe("Corrected Annex");
  });

  it("rejects corrections without a reason", async () => {
    const { s } = await makeDraft();
    await finalizeSession(s.id, "Det. Test", db);
    const current = (await db.sessions.get(s.id))!;
    await expect(
      recordCorrection({ ...current, locationName: "X" }, "Det. Test", "  ", db)
    ).rejects.toThrow(/reason/i);
  });

  it("rejects corrections to locked records", async () => {
    const { s } = await makeDraft();
    await finalizeSession(s.id, "Det. Test", db);
    await setSessionStatus(s.id, "locked", "Det. Test", "", db);
    const current = (await db.sessions.get(s.id))!;
    await expect(
      recordCorrection({ ...current, locationName: "X" }, "Det. Test", "why", db)
    ).rejects.toThrow(/locked/i);
  });

  it("records supervisor review only on completed records", async () => {
    const { s } = await makeDraft();
    await expect(reviewSession(s.id, "Lt. B", "ok", db)).rejects.toThrow();
    await finalizeSession(s.id, "Det. Test", db);
    await reviewSession(s.id, "Lt. B", "Documentation complete", db);
    const after = (await db.sessions.get(s.id))!;
    expect(after.status).toBe("reviewed");
    expect(after.review!.reviewerName).toBe("Lt. B");
  });
});

describe("deletion protection & cascades", () => {
  it("deletes drafts with all children", async () => {
    const { s, ex } = await makeDraft();
    await deleteDraftSession(s.id, db);
    expect(await db.sessions.get(s.id)).toBeUndefined();
    expect(await db.exercises.where("sessionId").equals(s.id).count()).toBe(0);
    expect(await db.hides.where("sessionId").equals(s.id).count()).toBe(0);
    void ex;
  });

  it("refuses to delete finalized records", async () => {
    const { s } = await makeDraft();
    await finalizeSession(s.id, "Det. Test", db);
    await expect(deleteDraftSession(s.id, db)).rejects.toThrow(/draft/i);
    expect(await db.sessions.get(s.id)).toBeDefined();
  });

  it("deleting an exercise removes its hides only", async () => {
    const { s, ex } = await makeDraft();
    const ex2 = newExercise(s.id, 2);
    await saveExercise(ex2, db);
    const h2 = newHide(ex2.id, s.id, 1);
    await saveHide(h2, db);
    await deleteExercise(ex.id, db);
    expect(await db.hides.where("exerciseId").equals(ex.id).count()).toBe(0);
    expect(await db.hides.where("exerciseId").equals(ex2.id).count()).toBe(1);
  });
});

describe("duplicate session setup", () => {
  it("copies structure but clears outcomes and results", async () => {
    const { s, ex } = await makeDraft();
    const exWithData = { ...ex, comments: "great", coverage: 5 as const };
    await saveExercise(exWithData, db);
    const fresh = newSession({ handlerName: "Det. Test", k9Name: "Cooper" });
    await duplicateSessionSetup(s.id, fresh, db);
    const copy = await loadFullSession(fresh.id, db);
    expect(copy!.session.locationName).toBe("Annex");
    expect(copy!.exercises).toHaveLength(1);
    expect(copy!.exercises[0].comments).toBe("");
    expect(copy!.exercises[0].coverage).toBe(0);
    expect(copy!.hides).toHaveLength(1);
    expect(copy!.hides[0].outcome).toBe("");
    // new ids, not shared with the source
    expect(copy!.exercises[0].id).not.toBe(ex.id);
  });
});

describe("seed data integrity", () => {
  it("seeds Cooper dataset with valid referential integrity", async () => {
    await ensureSearchTypes(db);
    await seedDatabase(db);
    const sessions = await db.sessions.toArray();
    const exercises = await db.exercises.toArray();
    const hides = await db.hides.toArray();
    expect(sessions.length).toBeGreaterThanOrEqual(8);
    const sessionIds = new Set(sessions.map((s) => s.id));
    for (const e of exercises) expect(sessionIds.has(e.sessionId)).toBe(true);
    const exerciseIds = new Set(exercises.map((e) => e.id));
    for (const h of hides) {
      expect(exerciseIds.has(h.exerciseId)).toBe(true);
      expect(sessionIds.has(h.sessionId)).toBe(true);
    }
    // seed includes the outcome variety needed to exercise the stats engine
    const outcomes = new Set(hides.map((h) => h.outcome));
    expect(outcomes.has("found_independent")).toBe(true);
    expect(outcomes.has("found_assisted")).toBe(true);
    expect(outcomes.has("missed")).toBe(true);
    expect(outcomes.has("interest_no_indication")).toBe(true);
    expect(exercises.some((e) => e.isBlankSearch)).toBe(true);
    expect(exercises.some((e) => e.falseResponses.length > 0)).toBe(true);
  });
});
