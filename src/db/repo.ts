/**
 * Repository layer: every multi-table write runs inside a Dexie transaction
 * so records can never be half-saved. Finalized records are protected —
 * edits after finalization must go through recordCorrection() which
 * captures a field-level before/after audit entry.
 */
import { db, nowIso, uuid, type EsdK9Db } from "./db";
import type {
  Exercise,
  Hide,
  RecordStatus,
  RevisionEntry,
  TrainingSession
} from "./types";

// ---------- session lifecycle ----------

export async function saveSessionDraft(
  session: TrainingSession,
  database: EsdK9Db = db
): Promise<void> {
  session.updatedAt = nowIso();
  await database.sessions.put(session);
}

export async function loadFullSession(sessionId: string, database: EsdK9Db = db) {
  return database.transaction(
    "r",
    [database.sessions, database.exercises, database.hides],
    async () => {
      const session = await database.sessions.get(sessionId);
      if (!session) return null;
      const exercises = await database.exercises
        .where("sessionId")
        .equals(sessionId)
        .sortBy("order");
      const hides = await database.hides
        .where("sessionId")
        .equals(sessionId)
        .toArray();
      return { session, exercises, hides };
    }
  );
}

/** Generic field-level diff between two record snapshots, for the audit trail. */
export function diffFlat(
  before: unknown,
  after: unknown
): { field: string; before: string; after: string }[] {
  const changes: { field: string; before: string; after: string }[] = [];
  const skip = new Set(["updatedAt", "modifiedBy", "createdAt"]);
  const flatten = (obj: unknown, prefix = ""): Record<string, string> => {
    const out: Record<string, string> = {};
    if (obj === null || obj === undefined) return out;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (skip.has(key)) continue;
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        Object.assign(out, flatten(v, key));
      } else {
        out[key] = v === null || v === undefined ? "" : String(Array.isArray(v) ? v.join(", ") : v);
      }
    }
    return out;
  };
  const a = flatten(before);
  const b = flatten(after);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if ((a[k] ?? "") !== (b[k] ?? "")) {
      changes.push({ field: k, before: a[k] ?? "", after: b[k] ?? "" });
    }
  }
  return changes;
}

export const diffSessions = (before: TrainingSession, after: TrainingSession) =>
  diffFlat(before, after);

/**
 * Record a correction made to a child record (exercise or hide) of a
 * finalized session. The revision entry preserves before/after values.
 */
export async function recordChildCorrection(
  sessionId: string,
  person: string,
  reason: string,
  label: string,
  changes: { field: string; before: string; after: string }[],
  database: EsdK9Db = db
): Promise<void> {
  if (!reason.trim()) throw new Error("A correction reason is required");
  if (changes.length === 0) return;
  await database.revisions.add({
    id: uuid(),
    sessionId,
    timestamp: nowIso(),
    person,
    reason,
    changes: changes.map((c) => ({ ...c, field: `${label}: ${c.field}` })),
    kind: "correction"
  });
}

export async function finalizeSession(
  sessionId: string,
  person: string,
  database: EsdK9Db = db
): Promise<void> {
  await database.transaction(
    "rw",
    [database.sessions, database.revisions, database.followUps],
    async () => {
      const s = await database.sessions.get(sessionId);
      if (!s) throw new Error("Session not found");
      if (s.status !== "draft") throw new Error("Only drafts can be finalized");
      const ts = nowIso();
      s.status = "completed";
      s.handlerAcknowledged = true;
      s.handlerAcknowledgedAt = ts;
      s.updatedAt = ts;
      s.modifiedBy = person;
      await database.sessions.put(s);
      await database.revisions.add({
        id: uuid(),
        sessionId,
        timestamp: ts,
        person,
        reason: "Record finalized by handler",
        changes: [{ field: "status", before: "draft", after: "completed" }],
        kind: "finalize"
      });
      // Auto-create a follow-up item when corrective training was flagged
      if (s.correctiveFollowUp.trim()) {
        const existing = await database.followUps
          .where("sessionId")
          .equals(sessionId)
          .first();
        if (!existing) {
          await database.followUps.add({
            id: uuid(),
            sessionId,
            text: s.correctiveFollowUp.trim(),
            done: false,
            createdAt: ts,
            completedAt: ""
          });
        }
      }
    }
  );
}

/**
 * Correct a finalized record. Original values are preserved in the
 * revision entry; the record itself is updated. Requires a reason.
 * This is an auditability feature — it does not by itself establish
 * legal chain of custody.
 */
export async function recordCorrection(
  updated: TrainingSession,
  person: string,
  reason: string,
  database: EsdK9Db = db
): Promise<void> {
  if (!reason.trim()) throw new Error("A correction reason is required");
  await database.transaction("rw", [database.sessions, database.revisions], async () => {
    const before = await database.sessions.get(updated.id);
    if (!before) throw new Error("Session not found");
    if (before.status === "locked")
      throw new Error("Locked records cannot be modified");
    const changes = diffSessions(before, updated);
    if (changes.length === 0) return;
    const ts = nowIso();
    updated.updatedAt = ts;
    updated.modifiedBy = person;
    await database.sessions.put(updated);
    await database.revisions.add({
      id: uuid(),
      sessionId: updated.id,
      timestamp: ts,
      person,
      reason,
      changes,
      kind: "correction"
    });
  });
}

export async function setSessionStatus(
  sessionId: string,
  status: RecordStatus,
  person: string,
  reason: string,
  database: EsdK9Db = db
): Promise<void> {
  await database.transaction("rw", [database.sessions, database.revisions], async () => {
    const s = await database.sessions.get(sessionId);
    if (!s) throw new Error("Session not found");
    const beforeStatus = s.status;
    if (beforeStatus === status) return;
    const ts = nowIso();
    s.status = status;
    s.updatedAt = ts;
    s.modifiedBy = person;
    await database.sessions.put(s);
    await database.revisions.add({
      id: uuid(),
      sessionId,
      timestamp: ts,
      person,
      reason: reason || `Status changed to ${status}`,
      changes: [{ field: "status", before: beforeStatus, after: status }],
      kind: "status_change"
    });
  });
}

export async function reviewSession(
  sessionId: string,
  reviewerName: string,
  comments: string,
  database: EsdK9Db = db
): Promise<void> {
  await database.transaction("rw", [database.sessions, database.revisions], async () => {
    const s = await database.sessions.get(sessionId);
    if (!s) throw new Error("Session not found");
    if (s.status !== "completed")
      throw new Error("Only completed records can be reviewed");
    const ts = nowIso();
    s.review = { reviewerName, comments, reviewedAt: ts };
    s.status = "reviewed";
    s.updatedAt = ts;
    await database.sessions.put(s);
    await database.revisions.add({
      id: uuid(),
      sessionId,
      timestamp: ts,
      person: reviewerName,
      reason: comments ? `Reviewed: ${comments}` : "Record reviewed",
      changes: [{ field: "status", before: "completed", after: "reviewed" }],
      kind: "review"
    });
  });
}

/** Delete a draft session and all children. Finalized records cannot be deleted. */
export async function deleteDraftSession(
  sessionId: string,
  database: EsdK9Db = db
): Promise<void> {
  await database.transaction(
    "rw",
    [
      database.sessions,
      database.exercises,
      database.hides,
      database.revisions,
      database.attachments,
      database.followUps
    ],
    async () => {
      const s = await database.sessions.get(sessionId);
      if (!s) return;
      if (s.status !== "draft")
        throw new Error("Only draft records can be deleted");
      await database.hides.where("sessionId").equals(sessionId).delete();
      await database.exercises.where("sessionId").equals(sessionId).delete();
      await database.revisions.where("sessionId").equals(sessionId).delete();
      await database.attachments.where("sessionId").equals(sessionId).delete();
      await database.followUps.where("sessionId").equals(sessionId).delete();
      await database.sessions.delete(sessionId);
    }
  );
}

// ---------- exercises & hides ----------

export async function saveExercise(ex: Exercise, database: EsdK9Db = db) {
  ex.updatedAt = nowIso();
  await database.exercises.put(ex);
}

export async function deleteExercise(exerciseId: string, database: EsdK9Db = db) {
  await database.transaction("rw", [database.exercises, database.hides], async () => {
    await database.hides.where("exerciseId").equals(exerciseId).delete();
    await database.exercises.delete(exerciseId);
  });
}

export async function saveHide(hide: Hide, database: EsdK9Db = db) {
  hide.updatedAt = nowIso();
  await database.hides.put(hide);
}

export async function deleteHide(hideId: string, database: EsdK9Db = db) {
  await database.hides.delete(hideId);
}

/** Duplicate a prior session's setup (exercises + hides) as a new draft. */
export async function duplicateSessionSetup(
  sourceSessionId: string,
  fresh: TrainingSession,
  database: EsdK9Db = db
): Promise<string> {
  return database.transaction(
    "rw",
    [database.sessions, database.exercises, database.hides],
    async () => {
      const src = await loadFullSession(sourceSessionId, database);
      if (!src) throw new Error("Source session not found");
      fresh.locationId = src.session.locationId;
      fresh.locationName = src.session.locationName;
      fresh.locationAddress = src.session.locationAddress;
      fresh.environment = src.session.environment;
      fresh.trainerName = src.session.trainerName;
      fresh.objective = src.session.objective;
      fresh.env = { ...src.session.env };
      await database.sessions.put(fresh);
      for (const ex of src.exercises) {
        const newExId = uuid();
        const ts = nowIso();
        await database.exercises.put({
          ...ex,
          id: newExId,
          sessionId: fresh.id,
          searchTimeSeconds: null,
          timeToFirstFindSeconds: null,
          falseResponses: [],
          problems: "",
          correctiveTraining: "",
          result: "",
          comments: "",
          coverage: 0,
          intensity: 0,
          independence: 0,
          focus: 0,
          stamina: 0,
          indicationQuality: 0,
          rewardCups: null,
          rewardedAtSource: null,
          blankCorrect: null,
          createdAt: ts,
          updatedAt: ts
        });
        const hides = await database.hides
          .where("exerciseId")
          .equals(ex.id)
          .toArray();
        for (const h of hides) {
          await database.hides.put({
            ...h,
            id: uuid(),
            exerciseId: newExId,
            sessionId: fresh.id,
            outcome: "",
            notes: "",
            createdAt: nowIso(),
            updatedAt: nowIso()
          });
        }
      }
      return fresh.id;
    }
  );
}

export async function listRevisions(
  sessionId: string,
  database: EsdK9Db = db
): Promise<RevisionEntry[]> {
  const revs = await database.revisions
    .where("sessionId")
    .equals(sessionId)
    .toArray();
  return revs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ---------- locations ----------

export async function touchLocation(
  name: string,
  address: string,
  database: EsdK9Db = db
): Promise<string> {
  const existing = await database.locations
    .where("name")
    .equalsIgnoreCase(name)
    .first();
  if (existing) {
    existing.useCount += 1;
    existing.lastUsedAt = nowIso();
    if (address) existing.address = address;
    await database.locations.put(existing);
    return existing.id;
  }
  const id = uuid();
  await database.locations.add({
    id,
    name,
    address,
    kind: "",
    favorite: false,
    useCount: 1,
    lastUsedAt: nowIso(),
    createdAt: nowIso()
  });
  return id;
}
