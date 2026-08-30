/**
 * Deployment records: a real operational search, not a training exercise.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EsdK9Db, uuid } from "../src/db/db";
import { newHide, newSession } from "../src/db/factories";
import {
  finalizeSession,
  getOrCreateDeploymentExercise,
  listDeploymentFinds,
  saveExercise,
  saveHide,
  saveSessionDraft
} from "../src/db/repo";
import { newExercise } from "../src/db/factories";
import { validateForFinalize } from "../src/lib/validation";
import { hasErrors } from "../src/lib/validation";
import { tallyHides } from "../src/lib/stats";
import { isDeployment, draftEditorPath } from "../src/lib/format";

let db: EsdK9Db;

beforeEach(() => {
  db = new EsdK9Db(`dep-${uuid()}`);
});
afterEach(async () => {
  await db.delete();
});

async function makeDeployment() {
  const s = newSession({ handlerName: "Det. C", k9Name: "Ranger" });
  s.activityType = "deployment_training";
  s.locationName = "123 Elm St";
  s.caseNumber = "2026-CF-1234";
  await saveSessionDraft(s, db);
  const container = await getOrCreateDeploymentExercise(s.id, db);
  return { s, container };
}

describe("deployment container", () => {
  it("creates exactly one container exercise marked as a deployment", async () => {
    const { s, container } = await makeDeployment();
    expect(container.kind).toBe("deployment");
    // nobody knows device locations on a real search
    expect(container.blindness).toBe("double_blind");
    const again = await getOrCreateDeploymentExercise(s.id, db);
    expect(again.id).toBe(container.id);
    expect(await db.exercises.where("sessionId").equals(s.id).count()).toBe(1);
  });

  it("reuses a legacy exercise instead of orphaning it", async () => {
    // A deployment logged before v1.2 already has a training-shaped exercise.
    const s = newSession({ handlerName: "Det. C", k9Name: "Ranger" });
    s.activityType = "deployment_training";
    s.locationName = "Legacy site";
    await saveSessionDraft(s, db);
    const legacy = newExercise(s.id, 1);
    legacy.areaDescription = "Master bedroom";
    await saveExercise(legacy, db);
    const legacyHide = newHide(legacy.id, s.id, 1);
    legacyHide.outcome = "found_independent";
    await saveHide(legacyHide, db);

    const container = await getOrCreateDeploymentExercise(s.id, db);
    expect(container.id).toBe(legacy.id);
    expect(container.areaDescription).toBe("Master bedroom");
    expect(await db.exercises.where("sessionId").equals(s.id).count()).toBe(1);
    expect((await listDeploymentFinds(s.id, db)).length).toBe(1);
  });
});

describe("deployment finds", () => {
  it("records recovered devices and unconfirmed alerts distinctly", async () => {
    const { s, container } = await makeDeployment();
    const recovered = newHide(container.id, s.id, 1);
    recovered.outcome = "found_independent";
    recovered.locationDescription = "Closet shoe box";
    await saveHide(recovered, db);

    const unconfirmed = newHide(container.id, s.id, 2);
    unconfirmed.outcome = "alert_unconfirmed";
    unconfirmed.locationDescription = "Desk drawer";
    await saveHide(unconfirmed, db);

    const finds = await listDeploymentFinds(s.id, db);
    expect(finds.map((f) => f.number)).toEqual([1, 2]);

    const t = tallyHides(finds);
    expect(t.confirmedFinds).toBe(1);
    expect(t.unconfirmedAlerts).toBe(1);
    // an unconfirmed field alert is never counted as a training miss
    expect(t.misses).toBe(0);
    expect(t.searchedHides).toBe(1);
  });
});

describe("deployment finalization", () => {
  it("saves with zero finds — a cleared search is a valid record", async () => {
    const { s, container } = await makeDeployment();
    const issues = validateForFinalize(s, [container], new Map());
    expect(hasErrors(issues)).toBe(false);
    await finalizeSession(s.id, "Det. C", db);
    expect((await db.sessions.get(s.id))!.status).toBe("completed");
  });

  it("does not demand training-only fields", async () => {
    const { s, container } = await makeDeployment();
    // No blank-search result, no hides, no ratings — none of it applies.
    const issues = validateForFinalize(s, [container], new Map([[container.id, []]]));
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("still requires a result on each recorded find", async () => {
    const { s, container } = await makeDeployment();
    const find = newHide(container.id, s.id, 1);
    find.outcome = "";
    await saveHide(find, db);
    const issues = validateForFinalize(s, [container], new Map([[container.id, [find]]]));
    expect(hasErrors(issues)).toBe(true);
  });
});

describe("routing", () => {
  it("sends deployments to the deployment editor and training to the session editor", () => {
    expect(isDeployment("deployment_training")).toBe(true);
    expect(isDeployment("training")).toBe(false);
    expect(draftEditorPath("abc", "deployment_training")).toBe("/deployment/abc");
    expect(draftEditorPath("abc", "training")).toBe("/session/abc");
    expect(draftEditorPath("abc", "certification")).toBe("/session/abc");
  });
});
