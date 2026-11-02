/**
 * The K9's day at a glance: a morning and an evening training slot plus any
 * deployments. Each training is still its own record (own times, own hides,
 * own certification) so exports and court reports are unchanged — this card
 * only groups them by day and starts the next one in a single tap.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db, useLiveQuery, useSettings } from "../hooks";
import { startDailySession } from "../db/repo";
import type { TrainingSession } from "../db/types";
import {
  daySlot,
  draftEditorPath,
  isDeployment,
  localDateIso,
  SLOT_LABELS,
  type DaySlot
} from "../lib/format";

const SLOT_ICONS: Record<DaySlot, string> = { morning: "🌅", evening: "🌙" };

function recordPath(s: TrainingSession) {
  return s.status === "draft" ? draftEditorPath(s.id, s.activityType) : `/record/${s.id}`;
}

function timeRange(s: TrainingSession) {
  return s.endTime ? `${s.startTime}–${s.endTime}` : s.startTime || "No time";
}

export function TodayCard() {
  const navigate = useNavigate();
  const settings = useSettings();
  const [busy, setBusy] = useState(false);
  const today = localDateIso();

  const data = useLiveQuery(async () => {
    const from = new Date();
    from.setDate(from.getDate() - 6);
    const week = await db.sessions.where("date").between(localDateIso(from), today, true, true).toArray();
    return week;
  }, [today]);

  if (!data) return null;

  const todays = data
    .filter((s) => s.date === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const training = todays.filter((s) => !isDeployment(s.activityType));
  const deployments = todays.filter((s) => isDeployment(s.activityType));

  const start = async (slot: DaySlot, deployment = false) => {
    if (busy) return;
    setBusy(true);
    try {
      const s = await startDailySession({
        slot,
        deployment,
        handlerName: settings.handlerName,
        k9Name: settings.k9Name
      });
      navigate(draftEditorPath(s.id, s.activityType));
    } finally {
      setBusy(false);
    }
  };

  const nowSlot: DaySlot = new Date().getHours() < 12 ? "morning" : "evening";

  // last 7 days, oldest first, for the consistency strip
  const days: { iso: string; label: string; am: boolean; pm: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = localDateIso(d);
    const done = data.filter((s) => s.date === iso && s.status !== "draft");
    days.push({
      iso,
      label: d.toLocaleDateString(undefined, { weekday: "narrow" }),
      am: done.some((s) => daySlot(s.startTime) === "morning"),
      pm: done.some((s) => daySlot(s.startTime) === "evening")
    });
  }

  return (
    <section className="today" aria-label="Today">
      <div className="today-head">
        <div>
          <div className="today-eyebrow">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric"
            })}
          </div>
          <h2 className="today-title">
            {settings.k9Name ? `${settings.k9Name}'s day` : "Today"}
          </h2>
        </div>
        <div className="week-strip" aria-label="Morning and evening sessions, last 7 days">
          {days.map((d) => (
            <div
              key={d.iso}
              className={`wk-day${d.iso === today ? " is-today" : ""}`}
              title={`${d.iso}: ${d.am ? "AM ✓" : "AM —"} ${d.pm ? "PM ✓" : "PM —"}`}
            >
              <span className={`wk-dot${d.am ? " on" : ""}`} />
              <span className={`wk-dot${d.pm ? " on" : ""}`} />
              <span className="wk-label">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="slots">
        {(["morning", "evening"] as DaySlot[]).map((slot) => {
          const recs = training.filter((s) => daySlot(s.startTime) === slot);
          const coveredBy = deployments.find((s) => daySlot(s.startTime) === slot);
          return (
            <div key={slot} className={`slot${recs.length ? " has-record" : ""}`}>
              <div className="slot-label">
                <span aria-hidden="true">{SLOT_ICONS[slot]}</span> {SLOT_LABELS[slot]}
              </div>
              {recs.map((s) => (
                <Link key={s.id} to={recordPath(s)} className="slot-record">
                  <span className={`slot-check ${s.status === "draft" ? "draft" : "done"}`} aria-hidden="true">
                    {s.status === "draft" ? "…" : "✓"}
                  </span>
                  <span className="grow">
                    <span className="sr-primary">
                      {s.status === "draft" ? "Draft — tap to finish" : "Logged"}
                    </span>
                    <span className="sr-secondary">
                      {timeRange(s)} · {s.locationName || "No location"}
                    </span>
                  </span>
                </Link>
              ))}
              {recs.length === 0 && coveredBy && (
                <div className="slot-note">🚔 Deployment this {slot}</div>
              )}
              {recs.length === 0 && (
                <button
                  type="button"
                  className={`btn block ${slot === nowSlot && !coveredBy ? "" : "secondary"}`}
                  disabled={busy}
                  onClick={() => start(slot)}
                >
                  ＋ {SLOT_LABELS[slot]} training
                </button>
              )}
            </div>
          );
        })}
      </div>

      {deployments.map((s) => (
        <Link key={s.id} to={recordPath(s)} className="slot-record deploy">
          <span className="slot-check deploy" aria-hidden="true">🚔</span>
          <span className="grow">
            <span className="sr-primary">
              Deployment{s.caseNumber ? ` · ${s.caseNumber}` : ""}
              {s.status === "draft" ? " (draft)" : ""}
            </span>
            <span className="sr-secondary">
              {timeRange(s)} · {s.locationName || "No location"}
            </span>
          </span>
        </Link>
      ))}

      <div className="today-actions">
        <button
          type="button"
          className="btn small secondary"
          disabled={busy}
          onClick={() => start(nowSlot, true)}
        >
          🚔 Log deployment
        </button>
        <Link to="/new" className="btn small ghost" style={{ textDecoration: "none" }}>
          Other record…
        </Link>
      </div>
    </section>
  );
}
