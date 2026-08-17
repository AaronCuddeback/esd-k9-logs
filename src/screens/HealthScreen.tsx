/**
 * K9 Health: vaccination records with due dates, weight log, vet contact,
 * and standing health notes. This is a readiness reference for the handler,
 * not a veterinary record system.
 */
import { useState } from "react";
import { db, useLiveQuery, useSettings } from "../hooks";
import { TopBar } from "../components/shell";
import { ConfirmSheet, Field, NumInput, Sheet, useToast } from "../components/ui";
import { nowIso, updateSettings, uuid } from "../db/db";
import { fmtDate, localDateIso } from "../lib/format";
import type { AppSettings, VaccinationRecord } from "../db/types";

const COMMON_VACCINES = ["Rabies", "DHPP", "Bordetella", "Leptospirosis", "Canine influenza"];

function dueStatus(nextDueDate: string): { label: string; tone: "ok" | "warn" | "error" } | null {
  if (!nextDueDate) return null;
  const days = Math.round(
    (new Date(nextDueDate + "T00:00:00").getTime() - new Date(localDateIso() + "T00:00:00").getTime()) / 86400000
  );
  if (days < 0) return { label: `overdue ${-days}d`, tone: "error" };
  if (days <= 30) return { label: `due in ${days}d`, tone: "warn" };
  return { label: `due ${nextDueDate}`, tone: "ok" };
}

export default function HealthScreen() {
  const settings = useSettings();
  const toast = useToast();
  const [vaxSheet, setVaxSheet] = useState(false);
  const [editingVax, setEditingVax] = useState<VaccinationRecord | null>(null);
  const [deleteVaxId, setDeleteVaxId] = useState<string | null>(null);
  const [weightSheet, setWeightSheet] = useState(false);
  const [newWeight, setNewWeight] = useState<number | null>(null);
  const [newWeightDate, setNewWeightDate] = useState(localDateIso());
  const [deleteWeightId, setDeleteWeightId] = useState<string | null>(null);

  const vaccinations = useLiveQuery(
    async () =>
      (await db.vaccinations.toArray()).sort((a, b) =>
        (a.nextDueDate || "9999").localeCompare(b.nextDueDate || "9999")
      ),
    []
  );
  const weights = useLiveQuery(
    async () => (await db.weights.toArray()).sort((a, b) => b.date.localeCompare(a.date)),
    []
  );

  const saveVax = async (v: VaccinationRecord) => {
    await db.vaccinations.put({ ...v, updatedAt: nowIso() });
    setEditingVax(null);
    setVaxSheet(false);
    toast("Vaccination saved");
  };

  const addWeight = async () => {
    if (newWeight == null || newWeight <= 0 || newWeight > 300) {
      toast("Enter a weight between 0 and 300 lb");
      return;
    }
    await db.weights.add({
      id: uuid(),
      date: newWeightDate,
      weightLb: newWeight,
      notes: "",
      createdAt: nowIso()
    });
    setNewWeight(null);
    setWeightSheet(false);
    toast("Weight recorded");
  };

  const latest = weights?.[0];
  const previous = weights?.[1];
  const delta =
    latest && previous ? Math.round((latest.weightLb - previous.weightLb) * 10) / 10 : null;

  return (
    <>
      <TopBar title="K9 Health" back="/more" />
      <main className="shell-main">
        <div className="card">
          <h3>Certification</h3>
          <p style={{ color: "var(--text-2)", fontSize: "var(--fs-sm)", marginBottom: 6 }}>
            {settings.certExpirationDate
              ? `Current certification ${settings.currentCertDate ? `dated ${fmtDate(settings.currentCertDate, settings.dateFormat)}, ` : ""}expires ${fmtDate(settings.certExpirationDate, settings.dateFormat)}. Certification is typically required annually — the Home screen warns 60 days out.`
              : "No certification expiration on file — set it in the K9 & handler profile to get annual renewal reminders."}
          </p>
        </div>

        <div className="card">
          <h3>Vaccinations</h3>
          {vaccinations && vaccinations.length === 0 && (
            <p style={{ color: "var(--text-2)" }}>
              Track rabies, DHPP, Bordetella, and other vaccines with their next-due dates.
            </p>
          )}
          {vaccinations?.map((v) => {
            const status = dueStatus(v.nextDueDate);
            return (
              <button
                key={v.id}
                type="button"
                className="list-item"
                onClick={() => {
                  setEditingVax({ ...v });
                  setVaxSheet(true);
                }}
              >
                <div className="grow">
                  <div className="primary">{v.name}</div>
                  <div className="secondary">
                    {v.dateGiven ? `given ${fmtDate(v.dateGiven, settings.dateFormat)}` : "date not recorded"}
                    {v.administeredBy ? ` · ${v.administeredBy}` : ""}
                  </div>
                </div>
                {status && (
                  <span
                    className="badge"
                    style={{
                      background:
                        status.tone === "error" ? "var(--danger-soft)" : status.tone === "warn" ? "var(--warn-soft)" : "var(--surface-2)",
                      color:
                        status.tone === "error" ? "var(--danger)" : status.tone === "warn" ? "var(--warn)" : "var(--text-2)"
                    }}
                  >
                    {status.label}
                  </span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            className="btn secondary block"
            onClick={() => {
              setEditingVax({
                id: uuid(),
                name: "",
                dateGiven: localDateIso(),
                nextDueDate: "",
                administeredBy: "",
                notes: "",
                createdAt: nowIso(),
                updatedAt: nowIso()
              });
              setVaxSheet(true);
            }}
          >
            ＋ Add vaccination
          </button>
        </div>

        <div className="card">
          <h3>Weight log</h3>
          {latest && (
            <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--accent)", marginBottom: 4 }}>
              {latest.weightLb} lb
              {delta !== null && (
                <span style={{ fontSize: "var(--fs-sm)", color: delta > 0 ? "var(--warn)" : "var(--text-2)", marginLeft: 8 }}>
                  {delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : "no change"} since {fmtDate(previous!.date, settings.dateFormat)}
                </span>
              )}
            </p>
          )}
          {weights?.slice(0, 8).map((w) => (
            <div key={w.id} className="toggle-row">
              <div>
                <span className="label">{w.weightLb} lb</span>{" "}
                <span className="sub">{fmtDate(w.date, settings.dateFormat)}</span>
              </div>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Delete weight entry from ${w.date}`}
                onClick={() => setDeleteWeightId(w.id)}
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn secondary block" onClick={() => setWeightSheet(true)}>
            ＋ Record weight
          </button>
        </div>

        <div className="card">
          <h3>Vet & standing notes</h3>
          <div className="row">
            <Field label="Veterinarian / clinic" htmlFor="vet-name">
              <input id="vet-name" type="text" value={settings.vetName} onChange={(e) => updateSettings({ vetName: e.target.value })} />
            </Field>
            <Field label="Phone" htmlFor="vet-phone">
              <input id="vet-phone" type="tel" value={settings.vetPhone} onChange={(e) => updateSettings({ vetPhone: e.target.value })} />
            </Field>
          </div>
          <Field
            label="Health notes"
            htmlFor="health-notes"
            hint="Allergies, medications, standing conditions that affect work. Session-day condition goes in each session's welfare check."
          >
            <textarea
              id="health-notes"
              value={settings.k9HealthNotes}
              onChange={(e) => updateSettings({ k9HealthNotes: e.target.value })}
            />
          </Field>
        </div>
      </main>

      <Sheet
        open={vaxSheet}
        onClose={() => {
          setVaxSheet(false);
          setEditingVax(null);
        }}
        title={editingVax?.createdAt === editingVax?.updatedAt ? "Add vaccination" : "Edit vaccination"}
      >
        {editingVax && (
          <>
            <Field label="Vaccine">
              <div className="chips" role="group" aria-label="Common vaccines">
                {COMMON_VACCINES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="chip"
                    aria-pressed={editingVax.name === n}
                    onClick={() => setEditingVax({ ...editingVax, name: n })}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Or type a name" htmlFor="vax-name">
              <input
                id="vax-name"
                type="text"
                value={editingVax.name}
                onChange={(e) => setEditingVax({ ...editingVax, name: e.target.value })}
              />
            </Field>
            <div className="row">
              <Field label="Date given" htmlFor="vax-given">
                <input
                  id="vax-given"
                  type="date"
                  value={editingVax.dateGiven}
                  onChange={(e) => setEditingVax({ ...editingVax, dateGiven: e.target.value })}
                />
              </Field>
              <Field label="Next due" htmlFor="vax-due">
                <input
                  id="vax-due"
                  type="date"
                  value={editingVax.nextDueDate}
                  onChange={(e) => setEditingVax({ ...editingVax, nextDueDate: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Administered by (optional)" htmlFor="vax-by">
              <input
                id="vax-by"
                type="text"
                value={editingVax.administeredBy}
                onChange={(e) => setEditingVax({ ...editingVax, administeredBy: e.target.value })}
              />
            </Field>
            <div className="row">
              <button type="button" className="btn warn-outline" onClick={() => setDeleteVaxId(editingVax.id)}>
                Remove
              </button>
              <button
                type="button"
                className="btn"
                disabled={!editingVax.name.trim()}
                onClick={() => saveVax(editingVax)}
              >
                Save
              </button>
            </div>
          </>
        )}
      </Sheet>

      <Sheet open={weightSheet} onClose={() => setWeightSheet(false)} title="Record weight">
        <div className="row">
          <Field label="Weight (lb)" htmlFor="w-lb">
            <NumInput id="w-lb" value={newWeight} min={1} max={300} step={0.1} onChange={setNewWeight} />
          </Field>
          <Field label="Date" htmlFor="w-date">
            <input id="w-date" type="date" value={newWeightDate} onChange={(e) => setNewWeightDate(e.target.value)} />
          </Field>
        </div>
        <button type="button" className="btn block" onClick={addWeight}>
          Save weight
        </button>
      </Sheet>

      <ConfirmSheet
        open={deleteVaxId !== null}
        onClose={() => setDeleteVaxId(null)}
        onConfirm={async () => {
          if (deleteVaxId) await db.vaccinations.delete(deleteVaxId);
          setEditingVax(null);
          setVaxSheet(false);
          toast("Vaccination removed");
        }}
        title="Remove this vaccination record?"
        message="The record will be permanently removed from this device."
        confirmLabel="Remove"
        danger
      />
      <ConfirmSheet
        open={deleteWeightId !== null}
        onClose={() => setDeleteWeightId(null)}
        onConfirm={async () => {
          if (deleteWeightId) await db.weights.delete(deleteWeightId);
          toast("Weight entry removed");
        }}
        title="Remove this weight entry?"
        message="The entry will be permanently removed."
        confirmLabel="Remove"
        danger
      />
    </>
  );
}
