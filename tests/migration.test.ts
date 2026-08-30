/**
 * Upgrade safety for real handler data.
 *
 * Builds a database in the OLD (v1.1 / schema v2) shape — no `kind` on
 * exercises, no `showAdvancedFields` in settings — with a realistic volume
 * of records, then opens it with the current app class and proves nothing
 * was lost, renamed, or re-interpreted.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Dexie from "dexie";
import { EsdK9Db, uuid } from "../src/db/db";
import { computeStats } from "../src/lib/stats";
import { createBackup, restoreBackup } from "../src/lib/backup";
import { buildWorkbook } from "../src/lib/exportXlsx";
import { buildCondensedLog } from "../src/lib/exportPdf";
import type { BackupFile } from "../src/db/types";

const DB_NAME = () => `legacy-${uuid()}`;

/** Opens a Dexie handle using exactly the pre-upgrade (v2) schema. */
function openLegacy(name: string) {
  const d = new Dexie(name);
  d.version(1).stores({
    settings: "id",
    sessions: "id, date, status, locationName, trainerName, updatedAt",
    exercises: "id, sessionId, searchTypeId, [sessionId+order]",
    hides: "id, exerciseId, sessionId, outcome",
    locations: "id, name, favorite, lastUsedAt",
    searchTypes: "id, label",
    revisions: "id, sessionId, timestamp",
    attachments: "id, sessionId, exerciseId",
    followUps: "id, sessionId, done, createdAt"
  });
  d.version(2).stores({
    commands: "id, name, archived",
    vaccinations: "id, name, nextDueDate",
    weights: "id, date"
  });
  return d;
}

const SESSION_COUNT = 33;
const MINUTES_PER_SESSION = 27; // 33 x 27 min ≈ 15 hours

/** Writes a realistic handler dataset in the legacy record shape. */
async function seedLegacy(name: string) {
  const d = openLegacy(name);
  await d.open();
  const sessions: Record<string, unknown>[] = [];
  const exercises: Record<string, unknown>[] = [];
  const hides: Record<string, unknown>[] = [];
  const revisions: Record<string, unknown>[] = [];

  for (let i = 0; i < SESSION_COUNT; i++) {
    const sid = uuid();
    const day = String((i % 28) + 1).padStart(2, "0");
    const isDeployment = i % 11 === 0; // a few real deployments in the history
    sessions.push({
      id: sid,
      date: `2026-0${(i % 6) + 1}-${day}`,
      startTime: "08:00",
      endTime: "08:27",
      activityType: isDeployment ? "deployment_training" : "training",
      activityOther: "",
      locationId: null,
      locationName: `Site ${i + 1}`,
      locationAddress: "",
      gps: null,
      caseNumber: isDeployment ? `2026-CF-${1000 + i}` : "",
      environment: "indoor",
      handlerName: "Det. A. Cuddeback",
      k9Name: "Ranger",
      trainerName: "Sgt. Delgado",
      otherPersonnel: "",
      objective: "Maintenance training",
      summary: `Session ${i + 1} notes`,
      overallAssessment: 4,
      correctiveFollowUp: "",
      nextFocus: "",
      env: {
        temperatureF: 70,
        weather: "",
        wind: "",
        airflow: "",
        lighting: "",
        noiseDistractions: "",
        surface: "",
        areaSize: "",
        clutterLevel: 0,
        accessibilityDifficulty: 0,
        familiarLocation: null,
        peoplePresent: "",
        animalsPresent: "",
        distractorOdors: "",
        notes: ""
      },
      welfare: null,
      status: "completed",
      review: null,
      handlerAcknowledged: true,
      handlerAcknowledgedAt: "2026-01-01T08:30:00.000Z",
      createdAt: "2026-01-01T08:00:00.000Z",
      updatedAt: "2026-01-01T08:30:00.000Z",
      createdBy: "Det. A. Cuddeback",
      modifiedBy: "Det. A. Cuddeback"
      // NOTE: deliberately no `kind` anywhere — that is the point of the test
    });
    revisions.push({
      id: uuid(),
      sessionId: sid,
      timestamp: "2026-01-01T08:30:00.000Z",
      person: "Det. A. Cuddeback",
      reason: "Record finalized by handler",
      changes: [{ field: "status", before: "draft", after: "completed" }],
      kind: "finalize"
    });

    const exId = uuid();
    exercises.push({
      id: exId,
      sessionId: sid,
      order: 1,
      searchTypeId: i % 2 === 0 ? "boxes" : "room",
      roomTypes: [],
      blindness: "single_blind",
      isBlankSearch: false,
      blankCorrect: null,
      areaDescription: "12-box line",
      searchTimeSeconds: 300,
      timeToFirstFindSeconds: 45,
      offLeash: false,
      coverage: 4,
      intensity: 5,
      independence: 4,
      focus: 4,
      stamina: 4,
      indicationQuality: 5,
      finalResponseType: "Sit (passive)",
      handlerCueing: "None",
      handlerStrategy: "",
      rewardType: "food",
      rewardCups: 2,
      rewardedAtSource: true,
      falseResponses: i % 7 === 0 ? [{ id: uuid(), locationDescription: "Shelf", suspectedCause: "Residual", handlerResponse: "No reward" }] : [],
      problems: "",
      correctiveTraining: "",
      result: "successful",
      comments: "",
      envOverride: "",
      createdAt: "2026-01-01T08:00:00.000Z",
      updatedAt: "2026-01-01T08:10:00.000Z"
    });

    for (let h = 1; h <= 3; h++) {
      hides.push({
        id: uuid(),
        exerciseId: exId,
        sessionId: sid,
        number: h,
        targetMaterial: "Electronic storage device",
        aidInventoryId: "",
        deviceType: "cellphone",
        deviceTypeOther: "",
        locationDescription: `Hide ${h}`,
        heightDescription: "waist",
        concealment: "fully concealed",
        accessible: true,
        difficulty: 3,
        placedTime: "",
        ageMinutes: 30,
        placedBy: "Sgt. Delgado",
        handlerKnewLocation: false,
        outcome: h === 3 && i % 5 === 0 ? "missed" : "found_independent",
        notes: "",
        createdAt: "2026-01-01T08:00:00.000Z",
        updatedAt: "2026-01-01T08:10:00.000Z"
      });
    }
  }

  await d.table("sessions").bulkAdd(sessions);
  await d.table("exercises").bulkAdd(exercises);
  await d.table("hides").bulkAdd(hides);
  await d.table("revisions").bulkAdd(revisions);
  await d.table("settings").put({
    id: "app",
    onboarded: true,
    agency: "Test County SO",
    unit: "Digital Forensics",
    handlerName: "Det. A. Cuddeback",
    handlerId: "4471",
    k9Name: "Ranger",
    k9Breed: "Labrador Retriever",
    k9Dob: "2022-03-14",
    k9Id: "K9-07",
    targetOdor: "TPPO (electronic storage devices)",
    trainerOrg: "Jordan Detection K9",
    initialCertDate: "2023-11-02",
    currentCertDate: "2025-11-05",
    certExpirationDate: "2026-11-05",
    agencyLogoDataUrl: "",
    k9PhotoDataUrl: "",
    vetName: "Fairview Vet",
    vetPhone: "555-0148",
    k9HealthNotes: "None",
    theme: "dark",
    dateFormat: "MM/dd/yyyy",
    reportHeader: "Test County SO",
    reportFooter: "Training record",
    includeIdentityInExports: true,
    includeAttachmentsInExports: false,
    appPin: "a".repeat(64),
    autoLockMinutes: 15,
    updatedAt: "2026-01-01T08:00:00.000Z"
    // NOTE: no showAdvancedFields — added by the v3 upgrade
  });
  d.close();
  return { sessions, exercises, hides };
}

let name: string;
let upgraded: EsdK9Db;

beforeEach(() => {
  name = DB_NAME();
});
afterEach(async () => {
  if (upgraded) await upgraded.delete();
});

describe("upgrading a real handler database (33 sessions, ~15 hours)", () => {
  it("keeps every record, with counts and totals unchanged", async () => {
    const legacy = await seedLegacy(name);

    upgraded = new EsdK9Db(name);
    await upgraded.open();

    expect(await upgraded.sessions.count()).toBe(SESSION_COUNT);
    expect(await upgraded.exercises.count()).toBe(legacy.exercises.length);
    expect(await upgraded.hides.count()).toBe(legacy.hides.length);
    expect(await upgraded.revisions.count()).toBe(SESSION_COUNT);

    const sessions = await upgraded.sessions.toArray();
    const totalMinutes = sessions.length * MINUTES_PER_SESSION;
    const stats = computeStats(
      sessions,
      await upgraded.exercises.toArray(),
      await upgraded.hides.toArray()
    );
    expect(stats.sessions).toBe(SESSION_COUNT);
    expect(stats.totalSessionMinutes).toBe(totalMinutes);
    expect(Math.round(totalMinutes / 60)).toBe(15); // ~15 hours, as reported
    expect(stats.hidesPlaced).toBe(SESSION_COUNT * 3);
    expect(stats.confirmedFinds).toBeGreaterThan(0);
    expect(stats.misses).toBeGreaterThan(0);
  });

  it("labels every pre-existing exercise as training, changing no meaning", async () => {
    await seedLegacy(name);
    upgraded = new EsdK9Db(name);
    await upgraded.open();
    const exercises = await upgraded.exercises.toArray();
    expect(exercises.length).toBeGreaterThan(0);
    expect(exercises.every((e) => e.kind === "training")).toBe(true);
  });

  it("preserves settings and adds the new preference without touching the rest", async () => {
    await seedLegacy(name);
    upgraded = new EsdK9Db(name);
    await upgraded.open();
    const s = (await upgraded.settings.get("app"))!;
    expect(s.showAdvancedFields).toBe(false);
    // nothing else may be disturbed by the upgrade
    expect(s.onboarded).toBe(true);
    expect(s.handlerName).toBe("Det. A. Cuddeback");
    expect(s.k9Name).toBe("Ranger");
    expect(s.appPin).toBe("a".repeat(64));
    expect(s.theme).toBe("dark");
    expect(s.autoLockMinutes).toBe(15);
    expect(s.certExpirationDate).toBe("2026-11-05");
  });

  it("keeps legacy field values byte-for-byte on a sampled record", async () => {
    const legacy = await seedLegacy(name);
    upgraded = new EsdK9Db(name);
    await upgraded.open();
    const before = legacy.exercises[0] as Record<string, unknown>;
    const after = (await upgraded.exercises.get(before.id as string))!;
    for (const key of Object.keys(before)) {
      expect({ key, value: JSON.stringify((after as never)[key]) }).toEqual({
        key,
        value: JSON.stringify(before[key])
      });
    }
  });

  it("still exports and backs up after the upgrade", async () => {
    await seedLegacy(name);
    upgraded = new EsdK9Db(name);
    await upgraded.open();

    const settings = (await upgraded.settings.get("app"))!;
    const sessions = await upgraded.sessions.toArray();
    const exercises = await upgraded.exercises.toArray();
    const hides = await upgraded.hides.toArray();
    const searchTypes = await upgraded.searchTypes.toArray();
    const data = { settings, sessions, exercises, hides, searchTypes };

    const wb = await buildWorkbook(data);
    const buf = await wb.xlsx.writeBuffer();
    expect(buf.byteLength).toBeGreaterThan(5000);
    expect(wb.getWorksheet("Sessions")!.rowCount - 1).toBe(SESSION_COUNT);

    const bundles = sessions.map((session) => ({
      session,
      exercises: exercises.filter((e) => e.sessionId === session.id),
      hides: hides.filter((h) => h.sessionId === session.id)
    }));
    expect(buildCondensedLog(data, bundles).getNumberOfPages()).toBeGreaterThan(0);

    const backup = JSON.parse(JSON.stringify(await createBackup(upgraded))) as BackupFile;
    expect(backup.sessions.length).toBe(SESSION_COUNT);
  });

  it("restores a backup taken before the upgrade", async () => {
    // A backup file saved from v1.1 has no `kind` on its exercises.
    await seedLegacy(name);
    const source = new EsdK9Db(name);
    await source.open();
    const backup = JSON.parse(JSON.stringify(await createBackup(source))) as BackupFile;
    for (const ex of backup.exercises) delete (ex as Partial<typeof ex>).kind;
    source.close();

    upgraded = new EsdK9Db(DB_NAME());
    await upgraded.open();
    const result = await restoreBackup(backup, "replace", upgraded);
    expect(result.sessionsAdded).toBe(SESSION_COUNT);
    expect(await upgraded.exercises.count()).toBe(SESSION_COUNT);
    // the app treats a missing kind as training everywhere it matters
    const stats = computeStats(
      await upgraded.sessions.toArray(),
      await upgraded.exercises.toArray(),
      await upgraded.hides.toArray()
    );
    expect(stats.hidesPlaced).toBe(SESSION_COUNT * 3);
  });
});
