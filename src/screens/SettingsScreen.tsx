import { useState } from "react";
import { db, useLiveQuery, useSettings } from "../hooks";
import { TopBar } from "../components/shell";
import { Field, Segmented, Sheet, ToggleRow, useToast } from "../components/ui";
import { updateSettings, uuid } from "../db/db";
import { hashPin, lockNow, markUnlocked } from "../lib/lock";
import type { AppSettings } from "../db/types";

export default function SettingsScreen() {
  const s = useSettings();
  const toast = useToast();
  const [pinSheet, setPinSheet] = useState(false);
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [typeSheet, setTypeSheet] = useState(false);
  const [newType, setNewType] = useState("");

  const searchTypes = useLiveQuery(() => db.searchTypes.toArray(), []);

  // Merge-based write: never sends a UI snapshot, so a toggle tapped before
  // the settings row finishes loading cannot clobber unrelated fields.
  const update = async (patch: Partial<AppSettings>) => {
    await updateSettings(patch);
  };

  const setPin = async () => {
    if (pin1.length < 4) {
      toast("PIN must be at least 4 digits");
      return;
    }
    if (pin1 !== pin2) {
      toast("PINs do not match");
      return;
    }
    await update({ appPin: await hashPin(pin1) });
    markUnlocked();
    setPin1("");
    setPin2("");
    setPinSheet(false);
    toast("PIN enabled");
  };

  const addType = async () => {
    if (!newType.trim()) return;
    await db.searchTypes.add({ id: uuid(), label: newType.trim(), builtIn: false, archived: false });
    setNewType("");
    setTypeSheet(false);
    toast("Search type added");
  };

  return (
    <>
      <TopBar title="Settings" back="/more" />
      <main className="shell-main">
        <div className="card">
          <h3>Appearance</h3>
          <Field label="Theme">
            <Segmented
              ariaLabel="Theme"
              value={s.theme}
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" }
              ]}
              onChange={(v) => update({ theme: v as AppSettings["theme"] })}
            />
          </Field>
          <Field label="Date format">
            <Segmented
              ariaLabel="Date format"
              value={s.dateFormat}
              options={[
                { value: "MM/dd/yyyy", label: "MM/DD/YYYY" },
                { value: "dd/MM/yyyy", label: "DD/MM/YYYY" },
                { value: "yyyy-MM-dd", label: "YYYY-MM-DD" }
              ]}
              onChange={(v) => update({ dateFormat: v as AppSettings["dateFormat"] })}
            />
          </Field>
        </div>

        <div className="card">
          <h3>Security</h3>
          {s.appPin ? (
            <>
              <ToggleRow
                label="App PIN enabled"
                sub="Required when the app opens"
                checked={true}
                onChange={async () => {
                  await update({ appPin: "" });
                  toast("PIN removed");
                }}
              />
              <Field label="Auto-lock after inactivity">
                <Segmented
                  ariaLabel="Auto-lock"
                  value={String(s.autoLockMinutes)}
                  options={[
                    { value: "0", label: "Never" },
                    { value: "5", label: "5 min" },
                    { value: "15", label: "15 min" },
                    { value: "60", label: "1 hr" }
                  ]}
                  onChange={(v) => update({ autoLockMinutes: Number(v) })}
                />
              </Field>
              <button type="button" className="btn secondary block" onClick={() => { lockNow(); window.location.reload(); }}>
                Lock now
              </button>
            </>
          ) : (
            <>
              <p style={{ color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>
                Add a PIN so opening the app requires a code. Combine with your
                phone's screen lock and device encryption for stored-data protection.
              </p>
              <button type="button" className="btn secondary block" onClick={() => setPinSheet(true)}>
                Enable app PIN
              </button>
            </>
          )}
        </div>

        <div className="card">
          <h3>Reports &amp; exports</h3>
          <Field label="Report header" htmlFor="set-header">
            <input id="set-header" type="text" value={s.reportHeader} placeholder="Agency name shown on reports" onChange={(e) => update({ reportHeader: e.target.value })} />
          </Field>
          <Field label="Report footer" htmlFor="set-footer">
            <input id="set-footer" type="text" value={s.reportFooter} onChange={(e) => update({ reportFooter: e.target.value })} />
          </Field>
          <ToggleRow
            label="Include identifying info in exports"
            sub="Handler, K9, and trainer names"
            checked={s.includeIdentityInExports}
            onChange={(v) => update({ includeIdentityInExports: v })}
          />
          <ToggleRow
            label="Reference attachments in exports"
            sub="Lists attachment captions in PDF reports"
            checked={s.includeAttachmentsInExports}
            onChange={(v) => update({ includeAttachmentsInExports: v })}
          />
        </div>

        <div className="card">
          <h3>Search types</h3>
          <p style={{ color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>
            Custom search types appear alongside the built-in ones in the exercise editor.
          </p>
          {searchTypes?.map((t) => (
            <div key={t.id} className="toggle-row">
              <div className="label">
                {t.label}
                {t.builtIn ? "" : " (custom)"}
              </div>
              {!t.builtIn && (
                <button
                  type="button"
                  className="btn small secondary"
                  onClick={async () => {
                    await db.searchTypes.update(t.id, { archived: !t.archived });
                  }}
                >
                  {t.archived ? "Restore" : "Archive"}
                </button>
              )}
            </div>
          ))}
          <button type="button" className="btn secondary block" onClick={() => setTypeSheet(true)}>
            ＋ Add custom search type
          </button>
        </div>
      </main>

      <Sheet open={pinSheet} onClose={() => setPinSheet(false)} title="Set app PIN">
        <Field label="New PIN (4+ digits)" htmlFor="pin1">
          <input id="pin1" type="password" inputMode="numeric" value={pin1} onChange={(e) => setPin1(e.target.value)} />
        </Field>
        <Field label="Confirm PIN" htmlFor="pin2">
          <input id="pin2" type="password" inputMode="numeric" value={pin2} onChange={(e) => setPin2(e.target.value)} />
        </Field>
        <button type="button" className="btn block" onClick={setPin}>
          Enable PIN
        </button>
      </Sheet>

      <Sheet open={typeSheet} onClose={() => setTypeSheet(false)} title="Add search type">
        <Field label="Name" htmlFor="nt-name">
          <input id="nt-name" type="text" value={newType} placeholder="e.g., Aircraft search" onChange={(e) => setNewType(e.target.value)} autoFocus />
        </Field>
        <button type="button" className="btn block" disabled={!newType.trim()} onClick={addType}>
          Add
        </button>
      </Sheet>
    </>
  );
}
