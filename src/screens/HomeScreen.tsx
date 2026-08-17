import { Link, useNavigate } from "react-router-dom";
import { db, useLiveQuery, useSettings } from "../hooks";
import { TopBar, OfflineBanner } from "../components/shell";
import { Stat, StatusBadge, EmptyState } from "../components/ui";
import { computeStats, daysSince } from "../lib/stats";
import { fmtDate, fmtMinutes, localDateIso } from "../lib/format";
import { seedDatabase, isDatabaseEmpty } from "../db/seed";
import { useState } from "react";

export default function HomeScreen() {
  const navigate = useNavigate();
  const settings = useSettings();
  const [seeding, setSeeding] = useState(false);

  const recent = useLiveQuery(
    () => db.sessions.orderBy("date").reverse().limit(5).toArray(),
    []
  );
  const drafts = useLiveQuery(
    () => db.sessions.where("status").equals("draft").toArray(),
    []
  );
  const last30 = useLiveQuery(async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffIso = localDateIso(cutoff);
    const sessions = await db.sessions.where("date").aboveOrEqual(cutoffIso).toArray();
    const ids = sessions.map((s) => s.id);
    const exercises = await db.exercises.where("sessionId").anyOf(ids).toArray();
    const hides = await db.hides.where("sessionId").anyOf(ids).toArray();
    return computeStats(sessions, exercises, hides);
  }, []);
  const openFollowUps = useLiveQuery(
    async () => (await db.followUps.toArray()).filter((f) => !f.done).length,
    []
  );
  const empty = useLiveQuery(() => isDatabaseEmpty(), []);
  const searchTypes = useLiveQuery(() => db.searchTypes.toArray(), []);

  const staleTypes = last30
    ? Object.entries(last30.bySearchType)
        .map(([id, t]) => ({
          label: searchTypes?.find((st) => st.id === id)?.label ?? id,
          days: daysSince(t.lastDate)
        }))
        .filter((t) => t.days !== null && t.days > 21)
    : [];

  return (
    <>
      <TopBar title={settings.k9Name ? `K9 ${settings.k9Name}` : "ESD K9 Logs"} />
      <main className="shell-main">
        <OfflineBanner />

        {drafts && drafts.length > 0 && (
          <div className="card" style={{ borderColor: "var(--warn)" }}>
            <h3>Unfinished draft{drafts.length > 1 ? "s" : ""}</h3>
            {drafts.map((d) => (
              <Link key={d.id} className="list-item flat" to={`/session/${d.id}`}>
                <div className="grow">
                  <div className="primary">
                    {fmtDate(d.date, settings.dateFormat)} — {d.locationName || "No location yet"}
                  </div>
                  <div className="secondary">Tap to continue where you left off</div>
                </div>
                <StatusBadge status="draft" />
              </Link>
            ))}
          </div>
        )}

        <div className="section-label">Last 30 days</div>
        <div className="stat-grid">
          <Stat num={last30?.sessions ?? "…"} label="Sessions" />
          <Stat num={last30 ? fmtMinutes(last30.totalSessionMinutes) : "…"} label="Training time" />
          <Stat num={last30?.confirmedFinds ?? "…"} label="Confirmed finds" />
          <Stat
            num={
              last30
                ? `${last30.misses} / ${last30.falseResponses}`
                : "…"
            }
            label="Misses / false resp."
          />
        </div>
        {last30 && last30.smallSample && last30.searchedHides > 0 && (
          <p className="hint" style={{ marginTop: 6, color: "var(--text-3)", fontSize: "var(--fs-xs)" }}>
            Small sample ({last30.searchedHides} searched hides) — interpret rates with caution.
          </p>
        )}

        {(openFollowUps ?? 0) > 0 && (
          <Link to="/followups" className="list-item" style={{ marginTop: 12 }}>
            <span aria-hidden="true">🎯</span>
            <div className="grow">
              <div className="primary">{openFollowUps} open follow-up item{openFollowUps === 1 ? "" : "s"}</div>
              <div className="secondary">Training areas flagged for extra work</div>
            </div>
          </Link>
        )}

        {staleTypes.length > 0 && (
          <div className="banner warn" role="status">
            <span aria-hidden="true">⏳</span>
            <span>
              Not practiced in 3+ weeks:{" "}
              {staleTypes.map((t) => t.label).join(", ")}. Consider scheduling these.
            </span>
          </div>
        )}

        <div className="section-label">Recent sessions</div>
        {recent && recent.length === 0 && (
          <>
            <EmptyState
              icon="🐾"
              title="No training records yet"
              sub="Start your first session, or load the fictional sample data to explore the app."
            />
            <button
              type="button"
              className="btn secondary block"
              disabled={seeding || !empty}
              onClick={async () => {
                setSeeding(true);
                await seedDatabase();
                setSeeding(false);
              }}
            >
              {seeding ? "Loading sample data…" : "Load sample data (K9 Cooper)"}
            </button>
          </>
        )}
        {recent?.map((s) => (
          <Link
            key={s.id}
            className="list-item"
            to={s.status === "draft" ? `/session/${s.id}` : `/record/${s.id}`}
          >
            <div className="grow">
              <div className="primary">
                {fmtDate(s.date, settings.dateFormat)} — {s.locationName || "Unnamed"}
              </div>
              <div className="secondary">{s.objective || s.summary || "No objective recorded"}</div>
            </div>
            <StatusBadge status={s.status} />
          </Link>
        ))}

        <Link
          to="/calendar"
          className="btn ghost block"
          style={{ textDecoration: "none", marginTop: 4 }}
        >
          Open calendar view
        </Link>
      </main>
      <button type="button" className="fab" onClick={() => navigate("/new")}>
        <span aria-hidden="true" style={{ fontSize: "1.3rem", lineHeight: 1 }}>＋</span>
        New Session
      </button>
    </>
  );
}
