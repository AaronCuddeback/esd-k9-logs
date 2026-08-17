/**
 * Backup / restore. The backup is a single self-contained JSON file that
 * includes every table plus base64-encoded attachments. Restore is
 * all-or-nothing inside one transaction; "merge" keeps existing records
 * and adds missing ones by id, "replace" clears the database first.
 */
import { APP_VERSION, db, type EsdK9Db } from "../db/db";
import type { Attachment, BackupFile } from "../db/types";

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBlob(b64: string, mimeType: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export async function createBackup(database: EsdK9Db = db): Promise<BackupFile> {
  const [settings, sessions, exercises, hides, locations, searchTypes, revisions, followUps, commands, vaccinations, weights, attachments] =
    await Promise.all([
      database.settings.get("app"),
      database.sessions.toArray(),
      database.exercises.toArray(),
      database.hides.toArray(),
      database.locations.toArray(),
      database.searchTypes.toArray(),
      database.revisions.toArray(),
      database.followUps.toArray(),
      database.commands.toArray(),
      database.vaccinations.toArray(),
      database.weights.toArray(),
      database.attachments.toArray()
    ]);
  const encodedAttachments = [];
  for (const a of attachments) {
    const { blob, ...rest } = a;
    encodedAttachments.push({ ...rest, dataBase64: await blobToBase64(blob) });
  }
  return {
    format: "esd-k9-logs-backup",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    settings: settings ?? null,
    sessions,
    exercises,
    hides,
    locations,
    searchTypes,
    revisions,
    followUps,
    commands,
    vaccinations,
    weights,
    attachments: encodedAttachments
  };
}

export function validateBackup(data: unknown): asserts data is BackupFile {
  const d = data as Partial<BackupFile>;
  if (!d || d.format !== "esd-k9-logs-backup")
    throw new Error("Not a valid ESD K9 Logs backup file.");
  if (d.formatVersion !== 1)
    throw new Error(`Unsupported backup version: ${d.formatVersion}`);
  for (const key of ["sessions", "exercises", "hides", "locations", "searchTypes", "revisions", "followUps", "attachments"] as const) {
    if (!Array.isArray(d[key])) throw new Error(`Backup is missing "${key}".`);
  }
  // These tables were added in app v1.1 — older backups legitimately omit them
  for (const key of ["commands", "vaccinations", "weights"] as const) {
    if (d[key] !== undefined && !Array.isArray(d[key]))
      throw new Error(`Backup field "${key}" is malformed.`);
  }
  // Referential integrity: every exercise/hide must point at a session in the file
  const sessionIds = new Set(d.sessions!.map((s) => s.id));
  for (const ex of d.exercises!) {
    if (!sessionIds.has(ex.sessionId))
      throw new Error(`Exercise ${ex.id} references a missing session.`);
  }
  const exerciseIds = new Set(d.exercises!.map((e) => e.id));
  for (const h of d.hides!) {
    if (!exerciseIds.has(h.exerciseId))
      throw new Error(`Hide ${h.id} references a missing exercise.`);
  }
}

export async function restoreBackup(
  data: BackupFile,
  mode: "merge" | "replace",
  database: EsdK9Db = db
): Promise<{ sessionsAdded: number; sessionsSkipped: number }> {
  validateBackup(data);
  let added = 0;
  let skipped = 0;
  await database.transaction(
    "rw",
    [
      database.settings,
      database.sessions,
      database.exercises,
      database.hides,
      database.locations,
      database.searchTypes,
      database.revisions,
      database.followUps,
      database.commands,
      database.vaccinations,
      database.weights,
      database.attachments
    ],
    async () => {
      if (mode === "replace") {
        await Promise.all([
          database.sessions.clear(),
          database.exercises.clear(),
          database.hides.clear(),
          database.locations.clear(),
          database.searchTypes.clear(),
          database.revisions.clear(),
          database.followUps.clear(),
          database.commands.clear(),
          database.vaccinations.clear(),
          database.weights.clear(),
          database.attachments.clear()
        ]);
        if (data.settings) await database.settings.put(data.settings);
      }
      const existingIds = new Set(
        mode === "merge" ? (await database.sessions.toCollection().primaryKeys()) as string[] : []
      );
      const importSessionIds = new Set<string>();
      for (const s of data.sessions) {
        if (existingIds.has(s.id)) {
          skipped++;
          continue;
        }
        importSessionIds.add(s.id);
        await database.sessions.put(s);
        added++;
      }
      for (const ex of data.exercises) {
        if (importSessionIds.has(ex.sessionId)) await database.exercises.put(ex);
      }
      for (const h of data.hides) {
        if (importSessionIds.has(h.sessionId)) await database.hides.put(h);
      }
      for (const r of data.revisions) {
        if (importSessionIds.has(r.sessionId)) await database.revisions.put(r);
      }
      for (const f of data.followUps) {
        if (!f.sessionId || importSessionIds.has(f.sessionId)) {
          const exists = await database.followUps.get(f.id);
          if (!exists) await database.followUps.put(f);
        }
      }
      for (const loc of data.locations) {
        const exists = await database.locations.get(loc.id);
        if (!exists) await database.locations.put(loc);
      }
      for (const st of data.searchTypes) {
        const exists = await database.searchTypes.get(st.id);
        if (!exists) await database.searchTypes.put(st);
      }
      for (const c of data.commands ?? []) {
        const exists = await database.commands.get(c.id);
        if (!exists) await database.commands.put(c);
      }
      for (const v of data.vaccinations ?? []) {
        const exists = await database.vaccinations.get(v.id);
        if (!exists) await database.vaccinations.put(v);
      }
      for (const w of data.weights ?? []) {
        const exists = await database.weights.get(w.id);
        if (!exists) await database.weights.put(w);
      }
      for (const a of data.attachments) {
        if (!importSessionIds.has(a.sessionId)) continue;
        const { dataBase64, ...rest } = a;
        const attachment: Attachment = {
          ...rest,
          blob: base64ToBlob(dataBase64, a.mimeType)
        };
        await database.attachments.put(attachment);
      }
      if (mode === "merge" && data.settings) {
        const current = await database.settings.get("app");
        if (!current || !current.onboarded) await database.settings.put(data.settings);
      }
    }
  );
  return { sessionsAdded: added, sessionsSkipped: skipped };
}

export function downloadFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function shareOrDownload(filename: string, blob: Blob, mimeType: string) {
  const file = new File([blob], filename, { type: mimeType });
  const nav = navigator as Navigator & {
    canShare?: (d: { files: File[] }) => boolean;
    share?: (d: { files: File[]; title?: string }) => Promise<void>;
  };
  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return "shared" as const;
    } catch (err) {
      if ((err as Error).name === "AbortError") return "cancelled" as const;
      // fall through to download
    }
  }
  downloadFile(filename, blob);
  return "downloaded" as const;
}
