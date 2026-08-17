import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db, useLiveQuery, useSettings } from "../hooks";
import { TopBar } from "../components/shell";
import { EmptyState, Field, Sheet, StatusBadge } from "../components/ui";
import { fmtDate } from "../lib/format";
import type { RecordStatus } from "../db/types";

export default function HistoryScreen() {
  const settings = useSettings();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [status, setStatus] = useState<RecordStatus | "all">("all");
  const [type, setType] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [trainer, setTrainer] = useState("");
  const [needsFollowUp, setNeedsFollowUp] = useState(false);

  const sessions = useLiveQuery(() => db.sessions.orderBy("date").reverse().toArray(), []);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const searchTypes = useLiveQuery(() => db.searchTypes.toArray(), []);

  const typesBySession = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of exercises ?? []) {
      const s = m.get(e.sessionId) ?? new Set();
      s.add(e.searchTypeId);
      m.set(e.sessionId, s);
    }
    return m;
  }, [exercises]);

  const filtered = useMemo(() => {
    if (!sessions) return undefined;
    const q = query.trim().toLowerCase();
    return sessions.filter((s) => {
      if (status !== "all" && s.status !== status) return false;
      if (from && s.date < from) return false;
      if (to && s.date > to) return false;
      if (trainer && !s.trainerName.toLowerCase().includes(trainer.toLowerCase())) return false;
      if (needsFollowUp && !s.correctiveFollowUp.trim()) return false;
      if (type !== "all" && !typesBySession.get(s.id)?.has(type)) return false;
      if (q) {
        const hay = [s.locationName, s.objective, s.summary, s.trainerName, s.nextFocus, s.correctiveFollowUp]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sessions, query, status, type, from, to, trainer, needsFollowUp, typesBySession]);

  const activeFilters =
    (status !== "all" ? 1 : 0) + (type !== "all" ? 1 : 0) + (from ? 1 : 0) + (to ? 1 : 0) +
    (trainer ? 1 : 0) + (needsFollowUp ? 1 : 0);

  return (
    <>
      <TopBar
        title="Training History"
        actions={
          <Link to="/calendar" className="icon-btn" aria-label="Calendar view">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
          </Link>
        }
      />
      <main className="shell-main">
        <div className="row" style={{ marginBottom: 10 }}>
          <input
            type="search"
            aria-label="Search sessions"
            placeholder="Search location, objective, notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            className="btn secondary"
            style={{ flex: "0 0 auto" }}
            onClick={() => setFilterOpen(true)}
          >
            Filters{activeFilters > 0 ? ` (${activeFilters})` : ""}
          </button>
        </div>

        {filtered && filtered.length === 0 && (
          <EmptyState
            icon="🗂️"
            title="No matching records"
            sub={sessions?.length ? "Try adjusting the search or filters." : "Training sessions will appear here."}
          />
        )}
        {filtered?.map((s) => (
          <Link
            key={s.id}
            className="list-item"
            to={s.status === "draft" ? `/session/${s.id}` : `/record/${s.id}`}
          >
            <div className="grow">
              <div className="primary">
                {fmtDate(s.date, settings.dateFormat)} — {s.locationName || "Unnamed"}
              </div>
              <div className="secondary">
                {[...(typesBySession.get(s.id) ?? [])]
                  .map((tid) => searchTypes?.find((t) => t.id === tid)?.label ?? tid)
                  .join(", ") || "No exercises"}
                {s.correctiveFollowUp ? " · needs follow-up" : ""}
              </div>
            </div>
            <StatusBadge status={s.status} />
          </Link>
        ))}
      </main>

      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Filters">
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as RecordStatus | "all")} aria-label="Status filter">
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="completed">Completed</option>
            <option value="reviewed">Reviewed</option>
            <option value="locked">Locked</option>
          </select>
        </Field>
        <Field label="Search type">
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Search type filter">
            <option value="all">All search types</option>
            {searchTypes?.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </Field>
        <div className="row">
          <Field label="From" htmlFor="f-from">
            <input id="f-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To" htmlFor="f-to">
            <input id="f-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <Field label="Trainer / evaluator" htmlFor="f-trainer">
          <input id="f-trainer" type="text" value={trainer} onChange={(e) => setTrainer(e.target.value)} />
        </Field>
        <label style={{ display: "flex", gap: 10, alignItems: "center", minHeight: 44 }}>
          <input
            type="checkbox"
            checked={needsFollowUp}
            onChange={(e) => setNeedsFollowUp(e.target.checked)}
            style={{ width: 22, height: 22 }}
          />
          Only records needing follow-up
        </label>
        <div className="row" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              setStatus("all");
              setType("all");
              setFrom("");
              setTo("");
              setTrainer("");
              setNeedsFollowUp(false);
            }}
          >
            Clear all
          </button>
          <button type="button" className="btn" onClick={() => setFilterOpen(false)}>
            Show results
          </button>
        </div>
      </Sheet>
      <button type="button" className="fab" onClick={() => navigate("/new")}>
        <span aria-hidden="true" style={{ fontSize: "1.3rem", lineHeight: 1 }}>＋</span>
        New Session
      </button>
    </>
  );
}
