/**
 * Sample-file generator (not part of the regular suite — run explicitly):
 *   npx vitest run tools/samples.test.ts
 * Writes sample exports built from the fictional Cooper dataset to samples/.
 */
import { it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EsdK9Db, ensureSearchTypes, uuid } from "../src/db/db";
import { seedDatabase } from "../src/db/seed";
import { createBackup } from "../src/lib/backup";
import { buildWorkbook, type ExportDataset } from "../src/lib/exportXlsx";
import {
  buildCondensedLog,
  buildDetailedReport,
  buildSummaryReport,
  type SessionBundle
} from "../src/lib/exportPdf";

it("generates sample export files", async () => {
  const dir = join(process.cwd(), "samples");
  mkdirSync(dir, { recursive: true });

  const db = new EsdK9Db(`samples-${uuid()}`);
  await ensureSearchTypes(db);
  await seedDatabase(db);

  const settings = (await db.settings.get("app"))!;
  const sessions = await db.sessions.orderBy("date").reverse().toArray();
  const exercises = await db.exercises.toArray();
  const hides = await db.hides.toArray();
  const searchTypes = await db.searchTypes.toArray();
  const data: ExportDataset = { settings, sessions, exercises, hides, searchTypes };
  const bundles: SessionBundle[] = sessions.map((session) => ({
    session,
    exercises: exercises.filter((e) => e.sessionId === session.id).sort((a, b) => a.order - b.order),
    hides: hides.filter((h) => h.sessionId === session.id)
  }));

  const wb = await buildWorkbook(data);
  writeFileSync(join(dir, "sample-records.xlsx"), Buffer.from(await wb.xlsx.writeBuffer()));

  writeFileSync(
    join(dir, "sample-detailed-report.pdf"),
    Buffer.from(buildDetailedReport(data, bundles.slice(0, 3)).output("arraybuffer"))
  );
  writeFileSync(
    join(dir, "sample-condensed-log.pdf"),
    Buffer.from(buildCondensedLog(data, bundles).output("arraybuffer"))
  );
  writeFileSync(
    join(dir, "sample-summary-report.pdf"),
    Buffer.from(buildSummaryReport(data, bundles).output("arraybuffer"))
  );

  const backup = await createBackup(db);
  writeFileSync(join(dir, "sample-backup.json"), JSON.stringify(backup, null, 2));

  await db.delete();
}, 60000);
