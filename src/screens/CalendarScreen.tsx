import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db, useLiveQuery, useSettings } from "../hooks";
import { TopBar } from "../components/shell";
import { StatusBadge } from "../components/ui";
import { fmtDate, localDateIso } from "../lib/format";

export default function CalendarScreen() {
  const settings = useSettings();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based
  const [selected, setSelected] = useState<string | null>(null);

  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-31`;
  const sessions = useLiveQuery(
    () => db.sessions.where("date").between(monthStart, monthEnd, true, true).toArray(),
    [monthStart, monthEnd]
  );

  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions ?? []) m.set(s.date, (m.get(s.date) ?? 0) + 1);
    return m;
  }, [sessions]);

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length) weeks.push([...week, ...Array(7 - week.length).fill(null)]);

  const dayIso = (d: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const todayIso = localDateIso(today);
  const monthName = new Date(year, month, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric"
  });
  const selectedSessions = (sessions ?? []).filter((s) => s.date === selected);

  return (
    <>
      <TopBar title="Calendar" back="/history" />
      <main className="shell-main">
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <button
              type="button"
              className="icon-btn"
              aria-label="Previous month"
              onClick={() => {
                setSelected(null);
                if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1);
              }}
            >
              ‹
            </button>
            <strong>{monthName}</strong>
            <button
              type="button"
              className="icon-btn"
              aria-label="Next month"
              onClick={() => {
                setSelected(null);
                if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1);
              }}
            >
              ›
            </button>
          </div>
          <table className="calendar">
            <thead>
              <tr>
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                  <th key={d} scope="col">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((w, i) => (
                <tr key={i}>
                  {w.map((d, j) => (
                    <td key={j}>
                      {d && (
                        <button
                          type="button"
                          className={`day${byDay.has(dayIso(d)) ? " has-session" : ""}${dayIso(d) === todayIso ? " today" : ""}`}
                          aria-label={`${monthName} ${d}${byDay.has(dayIso(d)) ? `, ${byDay.get(dayIso(d))} session(s)` : ""}`}
                          onClick={() => setSelected(dayIso(d))}
                        >
                          {d}
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && (
          <>
            <div className="section-label">{fmtDate(selected, settings.dateFormat)}</div>
            {selectedSessions.length === 0 && (
              <p style={{ color: "var(--text-3)" }}>No sessions on this day.</p>
            )}
            {selectedSessions.map((s) => (
              <Link
                key={s.id}
                className="list-item"
                to={s.status === "draft" ? `/session/${s.id}` : `/record/${s.id}`}
              >
                <div className="grow">
                  <div className="primary">{s.locationName || "Unnamed"}</div>
                  <div className="secondary">{s.objective || s.summary}</div>
                </div>
                <StatusBadge status={s.status} />
              </Link>
            ))}
          </>
        )}
      </main>
    </>
  );
}
