/**
 * Pre-finalize review: auto-generated summary, validation gate, and the
 * handler acknowledgment that converts a draft into a completed record.
 */
import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { db, useLiveQuery, useSettings } from "../hooks";
import { TopBar } from "../components/shell";
import { Stat, useToast } from "../components/ui";
import { finalizeSession } from "../db/repo";
import { computeStats } from "../lib/stats";
import { validateForFinalize, hasErrors } from "../lib/validation";
import { fmtDate, fmtMinutes, BLINDNESS_LABELS } from "../lib/format";
import { sessionMinutes } from "../lib/stats";

export default function ReviewFinalizeScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const settings = useSettings();
  const toast = useToast();
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);

  const session = useLiveQuery(() => db.sessions.get(id!), [id]);
  const exercises = useLiveQuery(
    () => db.exercises.where("sessionId").equals(id!).sortBy("order"),
    [id]
  );
  const hides = useLiveQuery(() => db.hides.where("sessionId").equals(id!).toArray(), [id]);
  const searchTypes = useLiveQuery(() => db.searchTypes.toArray(), []);

  if (!session || !exercises || !hides) {
    return (
      <>
        <TopBar title="Review & Finalize" back={`/session/${id}`} />
        <main className="shell-main"><p>Loading…</p></main>
      </>
    );
  }

  const hidesByEx = new Map<string, typeof hides>();
  for (const h of hides) {
    const l = hidesByEx.get(h.exerciseId) ?? [];
    l.push(h);
    hidesByEx.set(h.exerciseId, l);
  }
  const issues = validateForFinalize(session, exercises, hidesByEx);
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const stats = computeStats([session], exercises, hides);
  const typeLabel = (tid: string) => searchTypes?.find((t) => t.id === tid)?.label ?? tid;

  const finalize = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await finalizeSession(session.id, settings.handlerName || session.handlerName);
      toast("Record finalized");
      navigate(`/record/${session.id}`, { replace: true });
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TopBar title="Review & Finalize" back={`/session/${id}`} />
      <main className="shell-main">
        <div className="card">
          <h2>
            {fmtDate(session.date, settings.dateFormat)} — {session.locationName || "No location"}
          </h2>
          <p style={{ color: "var(--text-2)" }}>
            {session.startTime || "—"} to {session.endTime || "—"} ·{" "}
            {fmtMinutes(sessionMinutes(session))} · {session.handlerName} with K9 {session.k9Name}
          </p>
          {session.objective && <p>{session.objective}</p>}
        </div>

        <div className="stat-grid">
          <Stat num={stats.exercises} label="Exercises" />
          <Stat num={stats.hidesPlaced} label="Hides" />
          <Stat num={stats.confirmedFinds} label="Confirmed finds" />
          <Stat num={`${stats.misses} / ${stats.falseResponses}`} label="Miss / false" />
        </div>

        <div className="section-label">Exercises</div>
        {exercises.map((ex) => {
          const t = computeStats([session], [ex], hidesByEx.get(ex.id) ?? []);
          return (
            <div key={ex.id} className="list-item" style={{ cursor: "default" }}>
              <div className="grow">
                <div className="primary">
                  {ex.order}. {typeLabel(ex.searchTypeId)}
                  {ex.isBlankSearch ? " (blank)" : ""} — {BLINDNESS_LABELS[ex.blindness]}
                </div>
                <div className="secondary">
                  {ex.isBlankSearch
                    ? ex.blankCorrect
                      ? "Correctly cleared"
                      : ex.blankCorrect === false
                        ? "False response"
                        : "No result recorded"
                    : `${t.hidesPlaced} hides, ${t.confirmedFinds} finds, ${t.misses} missed, ${ex.falseResponses.length} false`}
                </div>
              </div>
            </div>
          );
        })}

        {errors.length > 0 && (
          <div className="banner error" role="alert">
            <span aria-hidden="true">⚠️</span>
            <div>
              <strong>Fix before finalizing:</strong>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {errors.map((e, i) => (
                  <li key={i}>{e.message}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="banner warn" role="status">
            <span aria-hidden="true">ℹ️</span>
            <div>
              {warnings.map((w, i) => (
                <div key={i}>{w.message}</div>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <label style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              style={{ width: 24, height: 24, marginTop: 2 }}
            />
            <span>
              I, <strong>{settings.handlerName || session.handlerName}</strong>, certify this
              record accurately reflects the training conducted. Finalizing makes it
              read-only; later changes require a documented correction.
            </span>
          </label>
        </div>

        <button
          type="button"
          className="btn block"
          disabled={hasErrors(issues) || !ack || busy}
          onClick={finalize}
        >
          {busy ? "Finalizing…" : "Finalize record"}
        </button>
        <Link to={`/session/${id}`} className="btn ghost block" style={{ marginTop: 8, textDecoration: "none" }}>
          Keep editing
        </Link>
      </main>
    </>
  );
}
