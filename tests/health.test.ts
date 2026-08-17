/**
 * v1.1 feature tests: schema v2 tables, backup round-trip for commands /
 * vaccinations / weights, backward compatibility with v1.0 backups, and
 * GPS/case-number persistence on sessions.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EsdK9Db, ensureSearchTypes, nowIso, uuid } from "../src/db/db";
import { seedDatabase } from "../src/db/seed";
import { createBackup, restoreBackup, validateBackup } from "../src/lib/backup";
import { newSession } from "../src/db/factories";
import { saveSessionDraft } from "../src/db/repo";
import type { BackupFile } from "../src/db/types";

let db: EsdK9Db;
let target: EsdK9Db;

beforeEach(async () => {
  db = new EsdK9Db(`h-${uuid()}`);
  target = new EsdK9Db(`ht-${uuid()}`);
  await ensureSearchTypes(db);
  await seedDatabase(db);
});
afterEach(async () => {
  await db.delete();
  await target.delete();
});

describe("v1.1 data (commands, vaccinations, weights)", () => {
  it("seeds commands, vaccinations, and weights for Cooper", async () => {
    expect(await db.commands.count()).toBeGreaterThanOrEqual(9);
    expect(await db.vaccinations.count()).toBeGreaterThanOrEqual(4);
    expect(await db.weights.count()).toBeGreaterThanOrEqual(4);
    const rabies = await db.vaccinations.where("name").equals("Rabies").first();
    expect(rabies?.nextDueDate).toBeTruthy();
  });

  it("round-trips the new tables through backup and restore", async () => {
    const backup = JSON.parse(JSON.stringify(await createBackup(db))) as BackupFile;
    expect(backup.commands!.length).toBeGreaterThan(0);
    expect(backup.vaccinations!.length).toBeGreaterThan(0);
    expect(backup.weights!.length).toBeGreaterThan(0);
    await restoreBackup(backup, "replace", target);
    expect(await target.commands.count()).toBe(await db.commands.count());
    expect(await target.vaccinations.count()).toBe(await db.vaccinations.count());
    expect(await target.weights.count()).toBe(await db.weights.count());
  });

  it("accepts v1.0 backups that lack the new tables", async () => {
    const backup = JSON.parse(JSON.stringify(await createBackup(db))) as BackupFile;
    delete backup.commands;
    delete backup.vaccinations;
    delete backup.weights;
    expect(() => validateBackup(backup)).not.toThrow();
    await restoreBackup(backup, "replace", target);
    expect(await target.sessions.count()).toBe(backup.sessions.length);
    expect(await target.commands.count()).toBe(0);
  });

  it("rejects malformed new-table fields", async () => {
    const backup = JSON.parse(JSON.stringify(await createBackup(db))) as Record<string, unknown>;
    backup.vaccinations = "nope";
    expect(() => validateBackup(backup)).toThrow(/vaccinations/i);
  });
});

describe("session GPS and case number", () => {
  it("persists a GPS point and case number on a session", async () => {
    const s = newSession({ handlerName: "H", k9Name: "K" });
    s.locationName = "Test";
    s.gps = { lat: 39.4721, lon: -84.2153, accuracyM: 8, capturedAt: nowIso() };
    s.caseNumber = "2026-CF-1234";
    await saveSessionDraft(s, db);
    const loaded = await db.sessions.get(s.id);
    expect(loaded?.gps?.lat).toBe(39.4721);
    expect(loaded?.caseNumber).toBe("2026-CF-1234");
  });

  it("seed includes a GPS-tagged session that survives backup round-trip", async () => {
    const withGps = (await db.sessions.toArray()).filter((s) => s.gps !== null && s.gps !== undefined);
    expect(withGps.length).toBeGreaterThanOrEqual(1);
    const backup = JSON.parse(JSON.stringify(await createBackup(db))) as BackupFile;
    await restoreBackup(backup, "replace", target);
    const restored = await target.sessions.get(withGps[0].id);
    expect(restored?.gps?.lat).toBe(withGps[0].gps!.lat);
  });
});
