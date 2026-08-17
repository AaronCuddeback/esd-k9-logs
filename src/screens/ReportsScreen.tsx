/**
 * Report & export center. Select scope (range/preset), pick format
 * (3 PDF report types, XLSX workbook, CSV, JSON), then share or download.
 */
import { useMemo, useState } from "react";
import { db, useLiveQuery } from "../hooks";
import { TopBar, OfflineBanner } from "../components/shell";
import { Field, Segmented, useToast } from "../components/ui";
import { getSettings } from "../db/db";
import type { ExportDataset } from "../lib/exportXlsx";
import { exportSessionsCsv, exportXlsxBlob } from "../lib/exportXlsx";
import {
  buildCondensedLog,
  buildDetailedReport,
  buildSummaryReport,
  pdfBlob,
  type SessionBundle
} from "../lib/exportPdf";
import { createBackup, shareOrDownload } from "../lib/backup";
import { fmtDate, localDateIso } from "../lib/format";

type Preset = "30" | "90" | "365" | "all" | "custom";

export default function ReportsScreen() {
  const toast = useToast();
  const [preset, setPreset] = useState<Preset>("90");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const range = useMemo(() => {
    if (preset === "custom") return { from, to };
    if (preset === "all") return { from: "", to: "" };
    const d = new Date();
    d.setDate(d.getDate() - Number(preset));
    return { from: localDateIso(d), to: "" };
  }, [preset, from, to]);

  const sessions = useLiveQuery(async () => {
    let list = await db.sessions.orderBy("date").reverse().toArray();
    if (range.from) list = list.filter((s) => s.date >= range.from);
    if (range.to) list = list.filter((s) => s.date <= range.to);
    if (!includeDrafts) list = list.filter((s) => s.status !== "draft");
    return list;
  }, [range.from, range.to, includeDrafts]);

  const gatherData = async (): Promise<{ data: ExportDataset; bundles: SessionBundle[] }> => {
    const settings = await getSettings();
    const searchTypes = await db.searchTypes.toArray();
    const list = sessions ?? [];
    const ids = list.map((s) => s.id);
    const exercises = await db.exercises.where("sessionId").anyOf(ids).toArray();
    const hides = await db.hides.where("sessionId").anyOf(ids).toArray();
    const attachments = settings.includeAttachmentsInExports
      ? await db.attachments.where("sessionId").anyOf(ids).toArray()
      : [];
    const bundles: SessionBundle[] = list.map((session) => ({
      session,
      exercises: exercises.filter((e) => e.sessionId === session.id).sort((a, b) => a.order - b.order),
      hides: hides.filter((h) => h.sessionId === session.id),
      attachmentRefs: attachments
        .filter((a) => a.sessionId === session.id)
        .map((a) => ({ caption: a.caption, kind: a.kind, createdAt: a.createdAt }))
    }));
    return { data: { settings, sessions: list, exercises, hides, searchTypes }, bundles };
  };

  const run = async (kind: string, fn: () => Promise<{ name: string; blob: Blob; mime: string }>) => {
    if (busy) return;
    if (!sessions || sessions.length === 0) {
      toast("No sessions in the selected range");
      return;
    }
    setBusy(kind);
    try {
      const { name, blob, mime } = await fn();
      const result = await shareOrDownload(name, blob, mime);
      if (result !== "cancelled")
        toast(result === "shared" ? "Export shared" : "Export saved to downloads");
    } catch (e) {
      toast(`Export failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const stamp = new Date().toISOString().slice(0, 10);
  const rangeLabel = sessions?.length
    ? `${sessions.length} session${sessions.length === 1 ? "" : "s"}${range.from ? ` from ${fmtDate(range.from)}` : ""}${range.to ? ` to ${fmtDate(range.to)}` : ""}`
    : "No sessions in range";

  return (
    <>
      <TopBar title="Reports & Export" />
      <main className="shell-main">
        <OfflineBanner />
        <div className="card">
          <h3>1. Choose records</h3>
          <Field label="Date range">
            <Segmented<Preset>
              ariaLabel="Date range preset"
              value={preset}
              options={[
                { value: "30", label: "30 days" },
                { value: "90", label: "90 days" },
                { value: "365", label: "1 year" },
                { value: "all", label: "All" },
                { value: "custom", label: "Custom" }
              ]}
              onChange={setPreset}
            />
          </Field>
          {preset === "custom" && (
            <div className="row">
              <Field label="From" htmlFor="r-from">
                <input id="r-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="To" htmlFor="r-to">
                <input id="r-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </Field>
            </div>
          )}
          <label style={{ display: "flex", gap: 10, alignItems: "center", minHeight: 44 }}>
            <input
              type="checkbox"
              checked={includeDrafts}
              onChange={(e) => setIncludeDrafts(e.target.checked)}
              style={{ width: 22, height: 22 }}
            />
            Include draft records
          </label>
          <p className="hint">{rangeLabel}</p>
        </div>

        <div className="card">
          <h3>2. PDF reports</h3>
          <button
            type="button"
            className="btn block"
            disabled={!!busy}
            onClick={() =>
              run("pdf-detail", async () => {
                const { data, bundles } = await gatherData();
                return {
                  name: `ESD-K9-detailed-${stamp}.pdf`,
                  blob: pdfBlob(buildDetailedReport(data, bundles)),
                  mime: "application/pdf"
                };
              })
            }
          >
            {busy === "pdf-detail" ? "Building…" : "Detailed session report"}
          </button>
          <button
            type="button"
            className="btn block"
            style={{ marginTop: 8 }}
            disabled={!!busy}
            onClick={() =>
              run("pdf-log", async () => {
                const { data, bundles } = await gatherData();
                return {
                  name: `ESD-K9-training-log-${stamp}.pdf`,
                  blob: pdfBlob(buildCondensedLog(data, bundles)),
                  mime: "application/pdf"
                };
              })
            }
          >
            {busy === "pdf-log" ? "Building…" : "Condensed chronological log"}
          </button>
          <button
            type="button"
            className="btn block"
            style={{ marginTop: 8 }}
            disabled={!!busy}
            onClick={() =>
              run("pdf-summary", async () => {
                const { data, bundles } = await gatherData();
                return {
                  name: `ESD-K9-summary-${stamp}.pdf`,
                  blob: pdfBlob(buildSummaryReport(data, bundles)),
                  mime: "application/pdf"
                };
              })
            }
          >
            {busy === "pdf-summary" ? "Building…" : "Summary with statistics"}
          </button>
        </div>

        <div className="card">
          <h3>3. Spreadsheet &amp; data</h3>
          <button
            type="button"
            className="btn block"
            disabled={!!busy}
            onClick={() =>
              run("xlsx", async () => {
                const { data } = await gatherData();
                return {
                  name: `ESD-K9-records-${stamp}.xlsx`,
                  blob: await exportXlsxBlob(data),
                  mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                };
              })
            }
          >
            {busy === "xlsx" ? "Building…" : "Excel workbook (XLSX)"}
          </button>
          <p className="hint" style={{ marginTop: 6 }}>
            Worksheets: Sessions, Exercises, Hides, Outcomes, Summary, Data Dictionary.
          </p>
          <button
            type="button"
            className="btn secondary block"
            style={{ marginTop: 8 }}
            disabled={!!busy}
            onClick={() =>
              run("csv", async () => {
                const { data } = await gatherData();
                return {
                  name: `ESD-K9-sessions-${stamp}.csv`,
                  blob: exportSessionsCsv(data),
                  mime: "text/csv"
                };
              })
            }
          >
            Session list (CSV)
          </button>
          <button
            type="button"
            className="btn secondary block"
            style={{ marginTop: 8 }}
            disabled={!!busy}
            onClick={() =>
              run("json", async () => {
                const backup = await createBackup();
                return {
                  name: `ESD-K9-data-${stamp}.json`,
                  blob: new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
                  mime: "application/json"
                };
              })
            }
          >
            Complete data (JSON)
          </button>
        </div>

        <p style={{ color: "var(--text-3)", fontSize: "var(--fs-sm)" }}>
          Exports are generated on this device and shared only where you choose to
          send them. Nothing is transmitted automatically.
        </p>
      </main>
    </>
  );
}
