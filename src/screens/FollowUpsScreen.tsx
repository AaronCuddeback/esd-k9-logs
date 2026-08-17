import { useState } from "react";
import { Link } from "react-router-dom";
import { db, useLiveQuery, useSettings } from "../hooks";
import { TopBar } from "../components/shell";
import { EmptyState, Field, useToast } from "../components/ui";
import { nowIso, uuid } from "../db/db";
import { fmtDate } from "../lib/format";

export default function FollowUpsScreen() {
  const settings = useSettings();
  const toast = useToast();
  const [text, setText] = useState("");

  const items = useLiveQuery(
    async () =>
      (await db.followUps.toArray()).sort(
        (a, b) => Number(a.done) - Number(b.done) || b.createdAt.localeCompare(a.createdAt)
      ),
    []
  );
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  const sessionDate = (sid: string | null) =>
    sid ? sessions?.find((s) => s.id === sid)?.date ?? "" : "";

  const add = async () => {
    if (!text.trim()) return;
    await db.followUps.add({
      id: uuid(),
      sessionId: null,
      text: text.trim(),
      done: false,
      createdAt: nowIso(),
      completedAt: ""
    });
    setText("");
    toast("Follow-up added");
  };

  const toggle = async (id: string) => {
    const item = await db.followUps.get(id);
    if (!item) return;
    await db.followUps.put({
      ...item,
      done: !item.done,
      completedAt: !item.done ? nowIso() : ""
    });
  };

  return (
    <>
      <TopBar title="Follow-up Training" back="/more" />
      <main className="shell-main">
        <div className="card">
          <Field label="Add a follow-up item" htmlFor="fu-text">
            <div className="row">
              <input
                id="fu-text"
                type="text"
                value={text}
                placeholder="e.g., Repeat elevated hides"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
              />
              <button type="button" className="btn" style={{ flex: "0 0 auto" }} onClick={add}>
                Add
              </button>
            </div>
          </Field>
          <p className="hint">
            Items are also created automatically when a session records "corrective
            action / follow-up training needed."
          </p>
        </div>

        {items && items.length === 0 && (
          <EmptyState icon="🎯" title="No follow-up items" sub="Flagged training needs will collect here." />
        )}
        {items?.map((f) => (
          <div key={f.id} className="list-item" style={{ cursor: "default" }}>
            <input
              type="checkbox"
              checked={f.done}
              onChange={() => toggle(f.id)}
              aria-label={`Mark "${f.text}" ${f.done ? "not done" : "done"}`}
              style={{ width: 24, height: 24 }}
            />
            <div className="grow">
              <div className="primary" style={{ textDecoration: f.done ? "line-through" : "none", whiteSpace: "normal" }}>
                {f.text}
              </div>
              <div className="secondary">
                {f.sessionId ? (
                  <Link to={`/record/${f.sessionId}`}>
                    From session {fmtDate(sessionDate(f.sessionId), settings.dateFormat)}
                  </Link>
                ) : (
                  `Added ${fmtDate(f.createdAt.slice(0, 10), settings.dateFormat)}`
                )}
              </div>
            </div>
          </div>
        ))}
      </main>
    </>
  );
}
