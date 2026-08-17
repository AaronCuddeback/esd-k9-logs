/**
 * Export verification: the XLSX is parsed back with ExcelJS and its
 * worksheets, headers, row counts, dates, and summary math are checked.
 * The PDFs are parsed with pdfjs-dist and their text content verified.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { EsdK9Db, ensureSearchTypes, uuid } from "../src/db/db";
import { seedDatabase } from "../src/db/seed";
import { buildWorkbook, exportSessionsCsv, type ExportDataset } from "../src/lib/exportXlsx";
import {
  buildCondensedLog,
  buildDetailedReport,
  buildSummaryReport,
  type SessionBundle
} from "../src/lib/exportPdf";
import { computeStats } from "../src/lib/stats";

let db: EsdK9Db;
let data: ExportDataset;
let bundles: SessionBundle[];

beforeEach(async () => {
  db = new EsdK9Db(`exp-${uuid()}`);
  await ensureSearchTypes(db);
  await seedDatabase(db);
  const settings = (await db.settings.get("app"))!;
  const sessions = await db.sessions.orderBy("date").reverse().toArray();
  const exercises = await db.exercises.toArray();
  const hides = await db.hides.toArray();
  const searchTypes = await db.searchTypes.toArray();
  data = { settings, sessions, exercises, hides, searchTypes };
  bundles = sessions.map((session) => ({
    session,
    exercises: exercises.filter((e) => e.sessionId === session.id),
    hides: hides.filter((h) => h.sessionId === session.id)
  }));
});
afterEach(async () => {
  await db.delete();
});

describe("XLSX workbook", () => {
  it("produces a valid workbook with all six worksheets and correct row counts", async () => {
    const wb = await buildWorkbook(data);
    const buf = await wb.xlsx.writeBuffer();
    expect(buf.byteLength).toBeGreaterThan(5000);

    const readBack = new ExcelJS.Workbook();
    await readBack.xlsx.load(buf as ArrayBuffer);
    const names = readBack.worksheets.map((w) => w.name);
    expect(names).toEqual([
      "Sessions", "Exercises", "Hides", "Outcomes", "Summary", "Data Dictionary"
    ]);
    expect(readBack.getWorksheet("Sessions")!.rowCount - 1).toBe(data.sessions.length);
    expect(readBack.getWorksheet("Exercises")!.rowCount - 1).toBe(data.exercises.length);
    expect(readBack.getWorksheet("Hides")!.rowCount - 1).toBe(data.hides.length);
  });

  it("stores real Excel date values, not strings", async () => {
    const wb = await buildWorkbook(data);
    const buf = await wb.xlsx.writeBuffer();
    const readBack = new ExcelJS.Workbook();
    await readBack.xlsx.load(buf as ArrayBuffer);
    const cell = readBack.getWorksheet("Sessions")!.getRow(2).getCell(2); // Date column
    expect(cell.value).toBeInstanceOf(Date);
  });

  it("freezes and filters the header row of every sheet", async () => {
    const wb = await buildWorkbook(data);
    for (const ws of wb.worksheets) {
      const view = ws.views?.[0] as { state?: string; ySplit?: number } | undefined;
      expect(view?.state).toBe("frozen");
      expect(view?.ySplit).toBe(1);
      expect(ws.autoFilter).toBeTruthy();
    }
  });

  it("record IDs link the Exercises sheet to the Sessions sheet", async () => {
    const wb = await buildWorkbook(data);
    const buf = await wb.xlsx.writeBuffer();
    const readBack = new ExcelJS.Workbook();
    await readBack.xlsx.load(buf as ArrayBuffer);
    const sessionIds = new Set<string>();
    readBack.getWorksheet("Sessions")!.eachRow((row, n) => {
      if (n > 1) sessionIds.add(String(row.getCell(1).value));
    });
    readBack.getWorksheet("Exercises")!.eachRow((row, n) => {
      if (n > 1) expect(sessionIds.has(String(row.getCell(2).value))).toBe(true);
    });
  });

  it("summary sheet math matches computeStats", async () => {
    const stats = computeStats(data.sessions, data.exercises, data.hides);
    const wb = await buildWorkbook(data);
    const ws = wb.getWorksheet("Summary")!;
    const rows = new Map<string, ExcelJS.CellValue>();
    ws.eachRow((row, n) => {
      if (n > 1) rows.set(String(row.getCell(1).value), row.getCell(2).value);
    });
    expect(rows.get("Confirmed finds")).toBe(stats.confirmedFinds);
    expect(rows.get("Misses")).toBe(stats.misses);
    expect(rows.get("False responses")).toBe(stats.falseResponses);
    expect(rows.get("Hides placed")).toBe(stats.hidesPlaced);
  });

  it("does not lose long notes", async () => {
    const long = "Long note ".repeat(200).trim();
    data.sessions[0].summary = long;
    const wb = await buildWorkbook(data);
    const buf = await wb.xlsx.writeBuffer();
    const readBack = new ExcelJS.Workbook();
    await readBack.xlsx.load(buf as ArrayBuffer);
    let found = false;
    readBack.getWorksheet("Sessions")!.eachRow((row) => {
      if (String(row.getCell(13).value) === long) found = true;
    });
    expect(found).toBe(true);
  });

  it("withholds identity when the setting is off", async () => {
    data.settings = { ...data.settings, includeIdentityInExports: false };
    const wb = await buildWorkbook(data);
    const row = wb.getWorksheet("Sessions")!.getRow(2);
    expect(row.getCell(9).value).toBe("[withheld]"); // Handler column
  });
});

describe("CSV export", () => {
  it("escapes quotes, commas, and newlines correctly", async () => {
    data.sessions[0].summary = 'He said "clear", then\nmoved on';
    const blob = exportSessionsCsv(data);
    // jsdom's Blob lacks .text(); read through FileReader as a browser would
    const text = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsText(blob);
    });
    expect(text).toContain('"He said ""clear"", then\nmoved on"');
    // header + one line per session (newline inside quotes doesn't add rows)
    const rows = text.split("\r\n");
    expect(rows[0].startsWith("session_id,date")).toBe(true);
  });
});

describe("PDF reports", () => {
  async function pdfText(doc: { output: (t: "arraybuffer") => ArrayBuffer }) {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = getDocument({ data: new Uint8Array(doc.output("arraybuffer")), disableWorker: true } as never);
    const pdf = await task.promise;
    let text = "";
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      text += content.items.map((i) => ("str" in i ? i.str : "")).join(" ") + "\n";
    }
    return { text, pages: pdf.numPages };
  }

  it("detailed report contains session details, hide outcomes, and page numbers", async () => {
    const doc = buildDetailedReport(data, bundles.slice(0, 2));
    const { text, pages } = await pdfText(doc);
    expect(pages).toBeGreaterThanOrEqual(2);
    expect(text).toContain("Detailed Training Session Report");
    expect(text).toContain("Cooper");
    expect(text).toContain(bundles[0].session.locationName);
    expect(text).toContain("Record ID");
    expect(text).toMatch(/Page 1 of \d+/);
    expect(text).toContain("Found — independent");
  });

  it("condensed log lists every session in the range", async () => {
    const doc = buildCondensedLog(data, bundles);
    const { text } = await pdfText(doc);
    expect(text).toContain("Condensed Daily Training Log");
    for (const b of bundles) {
      expect(text).toContain(b.session.locationName);
    }
  });

  it("summary report statistics match computeStats", async () => {
    const stats = computeStats(data.sessions, data.exercises, data.hides);
    const doc = buildSummaryReport(data, bundles);
    const { text } = await pdfText(doc);
    expect(text).toContain("Training Summary Report");
    expect(text).toContain(`${stats.confirmedFinds}`);
    expect(text).toContain("False responses");
    expect(text).toContain("not an operational reliability estimate");
  });

  it("withholds identity in PDFs when the setting is off", async () => {
    data.settings = { ...data.settings, includeIdentityInExports: false };
    const doc = buildCondensedLog(data, bundles.slice(0, 1));
    const { text } = await pdfText(doc);
    expect(text).toContain("Identifying information withheld");
  });
});
