import { useRef, useState } from "react";
import { db, useLiveQuery } from "../hooks";
import { TopBar, OfflineBanner } from "../components/shell";
import { Segmented, useToast } from "../components/ui";
import { createBackup, restoreBackup, shareOrDownload, validateBackup } from "../lib/backup";
import type { BackupFile } from "../db/types";

export default function BackupScreen() {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [pendingRestore, setPendingRestore] = useState<BackupFile | null>(null);
  const [busy, setBusy] = useState(false);

  const counts = useLiveQuery(async () => ({
    sessions: await db.sessions.count(),
    exercises: await db.exercises.count(),
    hides: await db.hides.count(),
    attachments: await db.attachments.count()
  }), []);

  const doBackup = async () => {
    setBusy(true);
    try {
      const backup = await createBackup();
      const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
      const name = `ESD-K9-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const result = await shareOrDownload(name, blob, "application/json");
      if (result !== "cancelled")
        toast(result === "shared" ? "Backup shared" : "Backup downloaded");
    } catch (e) {
      toast(`Backup failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as unknown;
      validateBackup(data);
      setPendingRestore(data);
    } catch (e) {
      toast(`Invalid backup file: ${(e as Error).message}`);
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const doRestore = async () => {
    if (!pendingRestore || busy) return;
    setBusy(true);
    try {
      const result = await restoreBackup(pendingRestore, mode);
      toast(
        `Restore complete: ${result.sessionsAdded} session(s) added${result.sessionsSkipped ? `, ${result.sessionsSkipped} already present` : ""}`
      );
      setPendingRestore(null);
    } catch (e) {
      toast(`Restore failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TopBar title="Backup & Restore" back="/more" />
      <main className="shell-main">
        <OfflineBanner />
        <div className="card">
          <h3>Current data</h3>
          <dl className="kv">
            <dt>Sessions</dt><dd>{counts?.sessions ?? "…"}</dd>
            <dt>Exercises</dt><dd>{counts?.exercises ?? "…"}</dd>
            <dt>Hides</dt><dd>{counts?.hides ?? "…"}</dd>
            <dt>Attachments</dt><dd>{counts?.attachments ?? "…"}</dd>
          </dl>
        </div>

        <div className="card">
          <h3>Create backup</h3>
          <p style={{ color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>
            A single JSON file containing every record, setting, and attachment.
            Store it somewhere safe — a backup is the only way to recover data if
            this device is lost, damaged, or the browser's storage is cleared.
          </p>
          <button type="button" className="btn block" disabled={busy} onClick={doBackup}>
            {busy ? "Working…" : "Create backup file"}
          </button>
        </div>

        <div className="card">
          <h3>Restore from backup</h3>
          <div className="field">
            <label>Restore mode</label>
            <Segmented
              ariaLabel="Restore mode"
              value={mode}
              options={[
                { value: "merge", label: "Merge (keep existing)" },
                { value: "replace", label: "Replace everything" }
              ]}
              onChange={(v) => setMode(v as "merge" | "replace")}
            />
            <div className="hint">
              Merge adds sessions that aren't already on this device (matched by
              record ID). Replace erases current data first.
            </div>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            aria-label="Choose backup file"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {pendingRestore && (
          <div className="card" style={{ borderColor: "var(--warn)" }}>
            <h3>Confirm restore</h3>
            <dl className="kv">
              <dt>Backup created</dt>
              <dd>{new Date(pendingRestore.exportedAt).toLocaleString()}</dd>
              <dt>Sessions</dt><dd>{pendingRestore.sessions.length}</dd>
              <dt>Exercises</dt><dd>{pendingRestore.exercises.length}</dd>
              <dt>Hides</dt><dd>{pendingRestore.hides.length}</dd>
              <dt>Mode</dt>
              <dd>{mode === "merge" ? "Merge with existing data" : "REPLACE all existing data"}</dd>
            </dl>
            {mode === "replace" && (
              <div className="banner warn" role="alert">
                <span aria-hidden="true">⚠️</span>
                <span>All current records on this device will be erased and replaced.</span>
              </div>
            )}
            <div className="row">
              <button type="button" className="btn secondary" onClick={() => setPendingRestore(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${mode === "replace" ? "danger" : ""}`}
                disabled={busy}
                onClick={doRestore}
              >
                {busy ? "Restoring…" : "Restore now"}
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
