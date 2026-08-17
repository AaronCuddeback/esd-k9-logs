import { useMemo, useState } from "react";
import { db, useLiveQuery } from "../hooks";
import { TopBar } from "../components/shell";
import { Segmented, Stat, EmptyState } from "../components/ui";
import { computeStats, daysSince } from "../lib/stats";
import { BLINDNESS_LABELS, fmtDate, fmtMinutes, localDateIso, pct } from "../lib/format";

type Window = "30" | "90" | "365" | "all";

export default function StatsScreen() {
  const [win, setWin] = useState<Window>("90");

  const data = useLiveQuery(async () => {
    let sessions = await db.sessions.orderBy("date").toArray();
    sessions = sessions.filter((s) => s.status !== "draft");
    if (win !== "all") {
      const d = new Date();
      d.setDate(d.getDate() - Number(win));
      const cut = localDateIso(d);
      sessions = sessions.filter((s) => s.date >= cut);
    }
    const ids = sessions.map((s) => s.id);
    const exercises = await db.exercises.where("sessionId").anyOf(ids).toArray();
    const hides = await db.hides.where("sessionId").anyOf(ids).toArray();
    return { sessions, exercises, hides };
  }, [win]);

  const searchTypes = useLiveQuery(() => db.searchTypes.toArray(), []);
  const stats = useMemo(
    () => (data ? computeStats(data.sessions, data.exercises, data.hides) : null),
    [data]
  );

  // simple month buckets for the trend list
  const monthly = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, { sessions: number; finds: number; misses: number; falses: number }>();
    const exBySession = new Map<string, typeof data.exercises>();
    for (const e of data.exercises) {
      const l = exBySession.get(e.sessionId) ?? [];
      l.push(e);
      exBySession.set(e.sessionId, l);
    }
    for (const s of data.sessions) {
      const key = s.date.slice(0, 7);
      const entry = m.get(key) ?? { sessions: 0, finds: 0, misses: 0, falses: 0 };
      entry.sessions++;
      const st = computeStats(
        [s],
        exBySession.get(s.id) ?? [],
        data.hides.filter((h) => h.sessionId === s.id)
      );
      entry.finds += st.confirmedFinds;
      entry.misses += st.misses;
      entry.falses += st.falseResponses;
      m.set(key, entry);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
  }, [data]);

  const typeLabel = (tid: string) => searchTypes?.find((t) => t.id === tid)?.label ?? tid;

  return (
    <>
      <TopBar title="Statistics & Trends" />
      <main className="shell-main">
        <Segmented<Window>
          ariaLabel="Statistics window"
          value={win}
          options={[
            { value: "30", label: "30 days" },
            { value: "90", label: "90 days" },
            { value: "365", label: "1 year" },
            { value: "all", label: "All time" }
          ]}
          onChange={setWin}
        />
        <div style={{ height: 12 }} />

        {stats && stats.sessions === 0 && (
          <EmptyState icon="📊" title="No finalized sessions in this window" sub="Statistics only include finalized (non-draft) records." />
        )}

        {stats && stats.sessions > 0 && (
          <>
            <div className="stat-grid">
              <Stat num={stats.sessions} label="Sessions" />
              <Stat num={fmtMinutes(stats.totalSessionMinutes)} label="Training time" />
              <Stat num={stats.exercises} label="Exercises" />
              <Stat num={stats.hidesPlaced} label="Hides placed" />
              <Stat num={stats.independentFinds} label="Independent finds" />
              <Stat num={stats.assistedFinds} label="Assisted finds" />
              <Stat num={stats.misses} label="Misses" />
              <Stat num={stats.falseResponses} label="False responses" />
              <Stat num={stats.interestOnly} label="Interest only" />
              <Stat num={`${stats.blankCorrect}/${stats.blankSearches}`} label="Blanks cleared" />
              <Stat num={pct(stats.findRate)} label="Find rate" />
              <Stat num={stats.totalRewardCups} label="Reward cups" />
            </div>
            <p className="hint" style={{ marginTop: 8, color: "var(--text-3)" }}>
              Find rate = confirmed finds ÷ searched hides ({stats.confirmedFinds}/{stats.searchedHides}).
              {stats.smallSample && " Small sample — interpret with caution."} These are
              training metrics, not a scientific measure of operational reliability.
            </p>

            <div className="section-label">By search type</div>
            {Object.entries(stats.bySearchType)
              .sort((a, b) => (b[1].lastDate || "").localeCompare(a[1].lastDate || ""))
              .map(([tid, t]) => {
                const days = daysSince(t.lastDate);
                const stale = days !== null && days > 21;
                return (
                  <div key={tid} className="list-item" style={{ cursor: "default" }}>
                    <div className="grow">
                      <div className="primary">{typeLabel(tid)}</div>
                      <div className="secondary">
                        {t.exercises} exercises · {t.hides} hides · {t.finds} finds · {t.misses} missed
                      </div>
                    </div>
                    <span
                      className="badge"
                      style={{
                        background: stale ? "var(--warn-soft)" : "var(--surface-2)",
                        color: stale ? "var(--warn)" : "var(--text-2)"
                      }}
                    >
                      {days === null ? "never" : days <= 0 ? "today" : `${days}d ago`}
                    </span>
                  </div>
                );
              })}

            <div className="section-label">By blindness level</div>
            {Object.entries(stats.byBlindness).map(([b, t]) => (
              <div key={b} className="list-item" style={{ cursor: "default" }}>
                <div className="grow">
                  <div className="primary">{BLINDNESS_LABELS[b as keyof typeof BLINDNESS_LABELS] ?? b}</div>
                  <div className="secondary">{t.hides} hides · {t.finds} finds</div>
                </div>
              </div>
            ))}

            <div className="section-label">Monthly trend</div>
            {monthly.map(([month, m]) => (
              <div key={month} className="list-item" style={{ cursor: "default" }}>
                <div className="grow">
                  <div className="primary">{fmtDate(month + "-01", "MMMM yyyy")}</div>
                  <div className="secondary">
                    {m.sessions} sessions · {m.finds} finds · {m.misses} misses · {m.falses} false responses
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </main>
    </>
  );
}
