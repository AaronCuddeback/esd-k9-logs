import { useEffect, useState } from "react";
import { db, useSettings } from "../hooks";
import { TopBar } from "../components/shell";
import { Field, useToast } from "../components/ui";
import { nowIso } from "../db/db";
import type { AppSettings } from "../db/types";

export default function ProfileScreen() {
  const stored = useSettings();
  const toast = useToast();
  const [s, setS] = useState<AppSettings | null>(null);

  useEffect(() => {
    if (stored.onboarded !== undefined && !s) setS(stored);
  }, [stored, s]);

  if (!s) return null;
  const update = (patch: Partial<AppSettings>) => setS({ ...s, ...patch });

  const save = async () => {
    await db.settings.put({ ...s, updatedAt: nowIso() });
    toast("Profile saved");
  };

  const onLogo = (file: File | null) => {
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast("Logo must be under 1 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update({ agencyLogoDataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };

  return (
    <>
      <TopBar title="K9 & Handler Profile" back="/more" />
      <main className="shell-main">
        <div className="card">
          <h3>Agency</h3>
          <Field label="Agency / organization" htmlFor="p-agency">
            <input id="p-agency" type="text" value={s.agency} onChange={(e) => update({ agency: e.target.value })} />
          </Field>
          <Field label="Unit" htmlFor="p-unit">
            <input id="p-unit" type="text" value={s.unit} onChange={(e) => update({ unit: e.target.value })} />
          </Field>
          <Field label="Agency logo (optional, shown on reports)">
            <input
              type="file"
              accept="image/png,image/jpeg"
              aria-label="Upload agency logo"
              onChange={(e) => onLogo(e.target.files?.[0] ?? null)}
            />
          </Field>
          {s.agencyLogoDataUrl && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <img src={s.agencyLogoDataUrl} alt="Agency logo" style={{ height: 48, borderRadius: 8 }} />
              <button type="button" className="btn small secondary" onClick={() => update({ agencyLogoDataUrl: "" })}>
                Remove logo
              </button>
            </div>
          )}
        </div>

        <div className="card">
          <h3>Handler</h3>
          <Field label="Handler name" htmlFor="p-handler">
            <input id="p-handler" type="text" value={s.handlerName} onChange={(e) => update({ handlerName: e.target.value })} />
          </Field>
          <Field label="ID / employee number (optional)" htmlFor="p-hid">
            <input id="p-hid" type="text" value={s.handlerId} onChange={(e) => update({ handlerId: e.target.value })} />
          </Field>
        </div>

        <div className="card">
          <h3>K9</h3>
          <div className="row">
            <Field label="K9 name" htmlFor="p-k9">
              <input id="p-k9" type="text" value={s.k9Name} onChange={(e) => update({ k9Name: e.target.value })} />
            </Field>
            <Field label="Breed" htmlFor="p-breed">
              <input id="p-breed" type="text" value={s.k9Breed} onChange={(e) => update({ k9Breed: e.target.value })} />
            </Field>
          </div>
          <div className="row">
            <Field label="Date of birth (optional)" htmlFor="p-dob">
              <input id="p-dob" type="date" value={s.k9Dob} onChange={(e) => update({ k9Dob: e.target.value })} />
            </Field>
            <Field label="K9 ID (optional)" htmlFor="p-k9id">
              <input id="p-k9id" type="text" value={s.k9Id} onChange={(e) => update({ k9Id: e.target.value })} />
            </Field>
          </div>
          <Field label="Trained target odor / material" htmlFor="p-odor">
            <input id="p-odor" type="text" value={s.targetOdor} onChange={(e) => update({ targetOdor: e.target.value })} />
          </Field>
        </div>

        <div className="card">
          <h3>Training & certification</h3>
          <Field label="Trainer / training organization" htmlFor="p-org">
            <input id="p-org" type="text" value={s.trainerOrg} onChange={(e) => update({ trainerOrg: e.target.value })} />
          </Field>
          <Field label="Initial certification date" htmlFor="p-cert0">
            <input id="p-cert0" type="date" value={s.initialCertDate} onChange={(e) => update({ initialCertDate: e.target.value })} />
          </Field>
          <div className="row">
            <Field label="Current certification" htmlFor="p-cert1">
              <input id="p-cert1" type="date" value={s.currentCertDate} onChange={(e) => update({ currentCertDate: e.target.value })} />
            </Field>
            <Field label="Expires" htmlFor="p-cert2">
              <input id="p-cert2" type="date" value={s.certExpirationDate} onChange={(e) => update({ certExpirationDate: e.target.value })} />
            </Field>
          </div>
        </div>

        <button type="button" className="btn block" onClick={save}>
          Save profile
        </button>
      </main>
    </>
  );
}
