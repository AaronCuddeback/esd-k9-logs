import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../hooks";
import { Field, useToast } from "../components/ui";
import { getSettings, nowIso } from "../db/db";
import { seedDatabase } from "../db/seed";

export default function OnboardingScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [agency, setAgency] = useState("");
  const [handlerName, setHandlerName] = useState("");
  const [k9Name, setK9Name] = useState("");
  const [k9Breed, setK9Breed] = useState("");
  const [busy, setBusy] = useState(false);

  const finish = async (withSample: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (withSample) {
        await seedDatabase();
      } else {
        const s = await getSettings();
        await db.settings.put({
          ...s,
          onboarded: true,
          agency: agency.trim(),
          handlerName: handlerName.trim(),
          k9Name: k9Name.trim(),
          k9Breed: k9Breed.trim(),
          updatedAt: nowIso()
        });
      }
      toast(withSample ? "Sample data loaded — explore freely" : "Welcome!");
      navigate("/", { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="shell-main" style={{ paddingTop: 32, paddingBottom: 32, maxWidth: 480 }}>
      <div className="progress-steps" aria-hidden="true">
        <span className={step >= 0 ? "done" : ""} />
        <span className={step >= 1 ? "done" : ""} />
      </div>

      {step === 0 && (
        <>
          <div style={{ textAlign: "center", margin: "16px 0 20px" }}>
            <div style={{ fontSize: "3rem" }} aria-hidden="true">🐕‍🦺</div>
            <h1>ESD K9 Training Logs</h1>
            <p style={{ color: "var(--text-2)" }}>
              Fast, defensible training documentation for Electronic Storage Device
              Detection K9 teams. Works fully offline — every record stays on this
              device until you export it.
            </p>
          </div>
          <div className="card">
            <ul style={{ margin: 0, paddingLeft: 20, color: "var(--text-2)" }}>
              <li>Log sessions, exercises, and hides in seconds</li>
              <li>Distinct outcomes: finds, misses, false responses, blanks</li>
              <li>Professional PDF & Excel exports</li>
              <li>Full revision history on finalized records</li>
            </ul>
          </div>
          <button type="button" className="btn block" onClick={() => setStep(1)}>
            Set up my team
          </button>
          <button
            type="button"
            className="btn ghost block"
            style={{ marginTop: 8 }}
            disabled={busy}
            onClick={() => finish(true)}
          >
            {busy ? "Loading…" : "Explore with sample data (K9 Cooper)"}
          </button>
        </>
      )}

      {step === 1 && (
        <>
          <h1>Your team</h1>
          <p style={{ color: "var(--text-2)" }}>
            Everything can be changed later in the profile. Nothing is required.
          </p>
          <div className="card">
            <Field label="Handler name" htmlFor="ob-handler">
              <input id="ob-handler" type="text" value={handlerName} onChange={(e) => setHandlerName(e.target.value)} autoFocus />
            </Field>
            <Field label="K9 name" htmlFor="ob-k9">
              <input id="ob-k9" type="text" value={k9Name} onChange={(e) => setK9Name(e.target.value)} />
            </Field>
            <Field label="K9 breed" htmlFor="ob-breed">
              <input id="ob-breed" type="text" value={k9Breed} onChange={(e) => setK9Breed(e.target.value)} />
            </Field>
            <Field label="Agency / organization" htmlFor="ob-agency">
              <input id="ob-agency" type="text" value={agency} onChange={(e) => setAgency(e.target.value)} />
            </Field>
          </div>
          <button type="button" className="btn block" disabled={busy} onClick={() => finish(false)}>
            {busy ? "Setting up…" : "Start using the app"}
          </button>
          <button type="button" className="btn ghost block" style={{ marginTop: 8 }} onClick={() => setStep(0)}>
            Back
          </button>
        </>
      )}
    </main>
  );
}
