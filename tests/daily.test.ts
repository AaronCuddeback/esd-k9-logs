/**
 * v2.0 daily flow: one-tap morning/evening start, duration math, and the
 * guarantee that the new flow writes ordinary records the existing
 * exports and backups already understand (no schema change).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EsdK9Db, uuid } from "../src/db/db";
import { newSession } from "../src/db/factories";
import { saveSessionDraft, startDailySession } from "../src/db/repo";
import { addMinutesToTime, daySlot } from "../src/lib/format";
import { createBackup } from "../src/lib/backup";

let db: EsdK9Db;

beforeEach(() => {
  db = new EsdK9Db(`test-${uuid()}`);
});
afterEach(async () => {
  vi.useRealTimers();
  await db.delete();
});

describe("addMinutesToTime", () => {
  it("adds quick durations", () => {
    expect(addMinutesToTime("07:10", 15)).toBe("07:25");
    expect(addMinutesToTime("06:50", 20)).toBe("07:10");
    expect(addMinutesToTime("9:45", 30)).toBe("10:15");
  });
  it("wraps past midnight and ignores blank input", () => {
    expect(addMinutesToTime("23:50", 15)).toBe("00:05");
    expect(addMinutesToTime("", 15)).toBe("");
  });
});

describe("daySlot", () => {
  it("splits the day at noon", () => {
    expect(daySlot("06:30")).toBe("morning");
    expect(daySlot("11:59")).toBe("morning");
    expect(daySlot("12:00")).toBe("evening");
    expect(daySlot("19:15")).toBe("evening");
  });
});

describe("startDailySession", () => {
  it("carries location, area and environment over from the last training", async () => {
    const prev = newSession({ handlerName: "H", k9Name: "Cooper" });
    prev.locationName = "Home";
    prev.areaSearched = "Living room and kitchen";
    prev.environment = "outdoor";
    prev.status = "completed";
    await saveSessionDraft(prev, db);

    const s = await startDailySession(
      { slot: "morning", handlerName: "H", k9Name: "Cooper" },
      db
    );
    expect(s.locationName).toBe("Home");
    expect(s.areaSearched).toBe("Living room and kitchen");
    expect(s.environment).toBe("outdoor");
    expect(s.status).toBe("draft");
    const exs = await db.exercises.where("sessionId").equals(s.id).toArray();
    expect(exs).toHaveLength(1);
    expect(exs[0].searchTypeId).toBe("outdoor");
    expect(exs[0].kind).toBe("training");
  });

  it("places an after-the-fact entry in the requested slot", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 2, 20, 0));
    const s = await startDailySession({ slot: "morning", handlerName: "H", k9Name: "C" }, db);
    expect(daySlot(s.startTime)).toBe("morning");
    const e = await startDailySession({ slot: "evening", handlerName: "H", k9Name: "C" }, db);
    expect(e.startTime).toBe("20:00");
  });

  it("starts deployments as deployment records with no training exercise", async () => {
    const s = await startDailySession(
      { slot: "evening", deployment: true, handlerName: "H", k9Name: "C" },
      db
    );
    expect(s.activityType).toBe("deployment_training");
    expect(await db.exercises.where("sessionId").equals(s.id).count()).toBe(0);
  });

  it("produces records the existing backup format includes unchanged", async () => {
    const s = await startDailySession({ slot: "morning", handlerName: "H", k9Name: "C" }, db);
    const backup = await createBackup(db);
    const saved = backup.sessions.find((x) => x.id === s.id)!;
    expect(saved).toBeTruthy();
    expect(Object.keys(saved).sort()).toEqual(Object.keys(newSession({ handlerName: "", k9Name: "" })).sort());
  });
});
