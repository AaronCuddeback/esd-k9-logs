/**
 * Start a record in as few taps as possible: pick what you are logging
 * (training or a real deployment), then tap a location. Date, time,
 * handler and K9 fill themselves in.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, useLiveQuery, useSettings } from "../hooks";
import { TopBar } from "../components/shell";
import { BigChoice, Collapse, Field, useToast } from "../components/ui";
import { newSession } from "../db/factories";
import { duplicateSessionSetup, saveSessionDraft, touchLocation } from "../db/repo";
import type { ActivityType } from "../db/types";
import { fmtDate } from "../lib/format";

type Mode = "training" | "deployment";

export default function NewSessionScreen() {
  const navigate = useNavigate();
  const settings = useSettings();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("training");
  const [otherActivity, setOtherActivity] = useState<ActivityType | null>(null);
  const [locationName, setLocationName] = useState("");
  const [busy, setBusy] = useState(false);

  const locations = useLiveQuery(async () => {
    const all = await db.locations.toArray();
    return all
      .sort(
        (a, b) =>
          Number(b.favorite) - Number(a.favorite) ||
          b.lastUsedAt.localeCompare(a.lastUsedAt)
      )
      .slice(0, 6);
  }, []);

  const lastTraining = useLiveQuery(
    async () =>
      (await db.sessions.orderBy("date").reverse().limit(15).toArray()).find(
        (s) => s.status !== "draft" && s.activityType !== "deployment_training"
      ),
    []
  );

  const activityType: ActivityType =
    otherActivity ?? (mode === "deployment" ? "deployment_training" : "training");

  const start = async (loc: { name: string; address: string } | null) => {
    if (busy) return;
    setBusy(true);
    try {
      const session = newSession({
        handlerName: settings.handlerName,
        k9Name: settings.k9Name
      });
      session.activityType = activityType;
      if (loc) {
        session.locationName = loc.name;
        session.locationAddress = loc.address;
        session.locationId = await touchLocation(loc.name, loc.address);
      }
      await saveSessionDraft(session);
      navigate(
        activityType === "deployment_training"
          ? `/deployment/${session.id}`
          : `/session/${session.id}`,
        { replace: true }
      );
    } finally {
      setBusy(false);
    }
  };

  const repeatLast = async () => {
    if (!lastTraining || busy) return;
    setBusy(true);
    try {
      const fresh = newSession({
        handlerName: settings.handlerName,
        k9Name: settings.k9Name
      });
      await duplicateSessionSetup(lastTraining.id, fresh);
      toast("Copied last setup — results cleared");
      navigate(`/session/${fresh.id}`, { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TopBar title="New Record" back="/" />
      <main className="shell-main">
        <div className="section-label">What are you logging?</div>
        <BigChoice
          icon="🎯"
          title="Training"
          sub="Exercises with placed hides"
          pressed={mode === "training" && !otherActivity}
          onClick={() => {
            setMode("training");
            setOtherActivity(null);
          }}
        />
        <BigChoice
          icon="🚔"
          title="Deployment"
          sub="A real search — record devices found"
          pressed={mode === "deployment" && !otherActivity}
          onClick={() => {
            setMode("deployment");
            setOtherActivity(null);
          }}
        />
        <Collapse title="Something else (certification, demo, remedial)">
          <div className="chips" style={{ marginBottom: 12 }}>
            {(
              [
                ["certification", "Certification"],
                ["remedial", "Remedial"],
                ["demonstration", "Demonstration"],
                ["other", "Other"]
              ] as [ActivityType, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="chip"
                aria-pressed={otherActivity === value}
                onClick={() => setOtherActivity(otherActivity === value ? null : value)}
              >
                {label}
              </button>
            ))}
          </div>
        </Collapse>

        <div className="section-label">Where?</div>
        {locations?.map((l) => (
          <button
            key={l.id}
            type="button"
            className="list-item"
            disabled={busy}
            onClick={() => start({ name: l.name, address: l.address })}
          >
            <span aria-hidden="true" style={{ fontSize: "1.3rem" }}>
              {l.favorite ? "⭐" : "📍"}
            </span>
            <div className="grow">
              <div className="primary">{l.name}</div>
              {l.address && <div className="secondary">{l.address}</div>}
            </div>
            <span aria-hidden="true" style={{ color: "var(--text-3)" }}>
              ›
            </span>
          </button>
        ))}

        <div className="card">
          <Field label="New location" htmlFor="new-loc">
            <input
              id="new-loc"
              type="text"
              value={locationName}
              placeholder="e.g., Training annex"
              onChange={(e) => setLocationName(e.target.value)}
            />
          </Field>
          <button
            type="button"
            className="btn block"
            disabled={busy}
            onClick={() =>
              start(
                locationName.trim()
                  ? { name: locationName.trim(), address: "" }
                  : null
              )
            }
          >
            Start {activityType === "deployment_training" ? "deployment" : "session"}
          </button>
        </div>

        {lastTraining && mode === "training" && !otherActivity && (
          <button
            type="button"
            className="btn secondary block"
            disabled={busy}
            onClick={repeatLast}
          >
            ↻ Repeat {fmtDate(lastTraining.date, settings.dateFormat)} setup
          </button>
        )}
      </main>
    </>
  );
}
