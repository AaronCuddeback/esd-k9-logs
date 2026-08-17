/**
 * Backup / restore round-trip tests, including validation of corrupt files
 * and merge vs replace semantics.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EsdK9Db, ensureSearchTypes, uuid } from "../src/db/db";
import { createBackup, restoreBackup, validateBackup } from "../src/lib/backup";
import { seedDatabase } from "../src/db/seed";
import { newSession } from "../src/db/factories";
import { saveSessionDraft } from "../src/db/repo";

let source: EsdK9Db;
let target: EsdK9Db;

beforeEach(async () => {
  source = new EsdK9Db(`src-${uuid()}`);
  target = new EsdK9Db(`tgt-${uuid()}`);
  await ensureSearchTypes(source);
  await seedDatabase(source);
});
afterEach(async () => {
  await source.delete();
  await target.delete();
});

describe("backup round-trip", () => {
  it("restores every record into an empty database (replace mode)", async () => {
    const backup = await createBackup(source);
    // survive JSON serialization exactly as a file would
    const parsed = JSON.parse(JSON.stringify(backup));
    const result = await restoreBackup(parsed, "replace", target);
    expect(result.sessionsAdded).toBe(backup.sessions.length);
    expect(await target.sessions.count()).toBe(await source.sessions.count());
    expect(await target.exercises.count()).toBe(await source.exercises.count());
    expect(await target.hides.count()).toBe(await source.hides.count());
    expect(await target.revisions.count()).toBe(await source.revisions.count());
    const settings = await target.settings.get("app");
    expect(settings?.k9Name).toBe("Cooper");
  });

  it("merge mode skips sessions that already exist and keeps local records", async () => {
    const backup = await createBackup(source);
    await restoreBackup(JSON.parse(JSON.stringify(backup)), "replace", target);
    // add a local-only session to the target
    const local = newSession({ handlerName: "H", k9Name: "K" });
    local.locationName = "Local only";
    await saveSessionDraft(local, target);
    const result = await restoreBackup(JSON.parse(JSON.stringify(backup)), "merge", target);
    expect(result.sessionsAdded).toBe(0);
    expect(result.sessionsSkipped).toBe(backup.sessions.length);
    expect(await target.sessions.count()).toBe(backup.sessions.length + 1);
    expect(await target.sessions.get(local.id)).toBeDefined();
  });

  it("restore is transactional — no partial data after a bad file", async () => {
    const backup = await createBackup(source);
    const corrupt = JSON.parse(JSON.stringify(backup));
    // orphan exercise: references a session not present in the file
    corrupt.exercises.push({ ...corrupt.exercises[0], id: uuid(), sessionId: uuid() });
    await expect(restoreBackup(corrupt, "replace", target)).rejects.toThrow(/missing session/i);
    expect(await target.sessions.count()).toBe(0);
  });
});

describe("validateBackup", () => {
  it("rejects wrong format markers and missing tables", () => {
    expect(() => validateBackup(null)).toThrow();
    expect(() => validateBackup({ format: "something-else" })).toThrow(/not a valid/i);
    expect(() =>
      validateBackup({ format: "esd-k9-logs-backup", formatVersion: 99 })
    ).toThrow(/version/i);
    expect(() =>
      validateBackup({
        format: "esd-k9-logs-backup",
        formatVersion: 1,
        sessions: [],
        exercises: "not-an-array"
      })
    ).toThrow(/exercises|missing/i);
  });

  it("rejects hides that reference missing exercises", async () => {
    const backup = JSON.parse(JSON.stringify(await createBackup(source)));
    backup.hides.push({ ...backup.hides[0], id: uuid(), exerciseId: uuid() });
    expect(() => validateBackup(backup)).toThrow(/missing exercise/i);
  });
});
