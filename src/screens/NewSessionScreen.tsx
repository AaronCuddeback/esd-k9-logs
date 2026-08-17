/**
 * New session quick-start: pre-fills date/time/handler/K9, offers recent &
 * favorite locations and "repeat last setup" duplication, then drops the
 * user into the session draft editor.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, useLiveQuery, useSettings } from "../hooks";
import { TopBar } from "../components/shell";
import { Field, useToast } from "../components/ui";
import { newSession } from "../db/factories";
import { duplicateSessionSetup, saveSessionDraft, touchLocation } from "../db/repo";
import { fmtDate } from "../lib/format";

export default function NewSessionScreen() {
  const navigate = useNavigate();
  const settings = useSettings();
  const toast = useToast();
  const [locationName, setLocationName] = useState("");
  const [busy, setBusy] = useState(false);

  const locations = useLiveQuery(async () => {
    const all = await db.locations.toArray();
    return all
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.lastUsedAt.localeCompare(a.lastUsedAt))
      .slice(0, 6);
  }, []);
  const lastSession = useLiveQuery(
    async () =>
      (await db.sessions.orderBy("date").reverse().limit(10).toArray()).find(
        (s) => s.status !== "draft"
      ),
    []
  );

  const start = async (loc: { name: string; address: string } | null) => {
    if (busy) return;
    setBusy(true);
    try {
      const session = newSession({
        handlerName: settings.handlerName,
        k9Name: settings.k9Name
      });
      if (loc) {
        session.locationName = loc.name;
        session.locationAddress = loc.address;
        session.locationId = await touchLocation(loc.name, loc.address);
      }
      await saveSessionDraft(session);
      navigate(`/session/${session.id}`, { replace: true });
    } finally {
      setBusy(false);
    }
  };

  const repeatLast = async () => {
    if (!lastSession || busy) return;
    setBusy(true);
    try {
      const fresh = newSession({
        handlerName: settings.handlerName,
        k9Name: settings.k9Name
      });
      await duplicateSessionSetup(lastSession.id, fresh);
      toast("Copied last session's setup — outcomes cleared");
      navigate(`/session/${fresh.id}`, { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TopBar title="New Training Session" back="/" />
      <main className="shell-main">
        <div className="card">
          <h3>Start at a recent location</h3>
          {locations && locations.length === 0 && (
            <p style={{ color: "var(--text-2)" }}>
              Locations you use will appear here for one-tap starts.
            </p>
          )}
          {locations?.map((l) => (
            <button
              key={l.id}
              type="button"
              className="list-item"
              disabled={busy}
              onClick={() => start({ name: l.name, address: l.address })}
            >
              <span aria-hidden="true">{l.favorite ? "⭐" : "📍"}</span>
              <div className="grow">
                <div className="primary">{l.name}</div>
                {l.address && <div className="secondary">{l.address}</div>}
              </div>
            </button>
          ))}
        </div>

        <div className="card">
          <h3>Or a new location</h3>
          <Field label="Location name" htmlFor="new-loc">
            <input
              id="new-loc"
              type="text"
              value={locationName}
              placeholder="e.g., Training annex, 2nd floor"
              onChange={(e) => setLocationName(e.target.value)}
            />
          </Field>
          <button
            type="button"
            className="btn block"
            disabled={busy}
            onClick={() =>
              start(locationName.trim() ? { name: locationName.trim(), address: "" } : null)
            }
          >
            Start session
          </button>
          <p className="hint" style={{ marginTop: 8 }}>
            Date, time, handler, and K9 are filled in automatically. You can change
            everything in the next step. Location can also be added later.
          </p>
        </div>

        {lastSession && (
          <div className="card">
            <h3>Repeat a previous setup</h3>
            <p style={{ color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>
              Copies the exercises and hide placements from{" "}
              <strong>
                {fmtDate(lastSession.date, settings.dateFormat)} — {lastSession.locationName}
              </strong>{" "}
              with all results cleared.
            </p>
            <button type="button" className="btn secondary block" disabled={busy} onClick={repeatLast}>
              Repeat last session's setup
            </button>
          </div>
        )}
      </main>
    </>
  );
}
