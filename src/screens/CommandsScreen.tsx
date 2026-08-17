/**
 * Command / obedience mastery tracking (inspired by JDK9 Logs).
 * Each command has a proficiency rating, a last-practiced date, and notes.
 * "Practiced today" is a one-tap update.
 */
import { useState } from "react";
import { db, useLiveQuery, useSettings } from "../hooks";
import { TopBar } from "../components/shell";
import { ConfirmSheet, EmptyState, Field, RatingBar, Sheet, useToast } from "../components/ui";
import { nowIso, uuid } from "../db/db";
import { fmtDate, localDateIso } from "../lib/format";
import { daysSince } from "../lib/stats";
import type { CommandRecord, Rating } from "../db/types";

const CATEGORIES = ["Obedience", "Detection", "Control", "Other"];

const STARTER_COMMANDS: { name: string; category: string }[] = [
  { name: "Sit", category: "Obedience" },
  { name: "Down", category: "Obedience" },
  { name: "Stay", category: "Obedience" },
  { name: "Heel", category: "Obedience" },
  { name: "Recall (come)", category: "Control" },
  { name: "Seek / search", category: "Detection" },
  { name: "Show me", category: "Detection" },
  { name: "Leave it / out", category: "Control" },
  { name: "Place / kennel", category: "Obedience" }
];

export default function CommandsScreen() {
  const settings = useSettings();
  const toast = useToast();
  const [editing, setEditing] = useState<CommandRecord | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Obedience");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const commands = useLiveQuery(
    async () =>
      (await db.commands.toArray())
        .filter((c) => !c.archived)
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    []
  );

  const add = async (name: string, category: string) => {
    const ts = nowIso();
    await db.commands.add({
      id: uuid(),
      name: name.trim(),
      category,
      proficiency: 0,
      lastPracticed: "",
      notes: "",
      archived: false,
      createdAt: ts,
      updatedAt: ts
    });
  };

  const loadStarters = async () => {
    for (const c of STARTER_COMMANDS) await add(c.name, c.category);
    toast("Starter command list added");
  };

  const practicedToday = async (c: CommandRecord) => {
    await db.commands.put({ ...c, lastPracticed: localDateIso(), updatedAt: nowIso() });
  };

  const saveEdit = async () => {
    if (!editing) return;
    await db.commands.put({ ...editing, updatedAt: nowIso() });
    setEditing(null);
    toast("Command updated");
  };

  return (
    <>
      <TopBar title="Command Tracking" back="/more" />
      <main className="shell-main">
        <p style={{ color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>
          Track {settings.k9Name ? `${settings.k9Name}'s` : "your K9's"} command mastery:
          rate proficiency 1–5, tap ✓ when practiced, and keep notes on progress.
        </p>

        {commands && commands.length === 0 && (
          <>
            <EmptyState icon="🎓" title="No commands yet" sub="Start from a standard list or add your own." />
            <button type="button" className="btn secondary block" onClick={loadStarters}>
              Add starter command list
            </button>
          </>
        )}

        {commands?.map((c) => {
          const days = daysSince(c.lastPracticed);
          const stale = days !== null && days > 7;
          return (
            <div key={c.id} className="list-item" style={{ cursor: "default" }}>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Mark ${c.name} practiced today`}
                title="Practiced today"
                onClick={() => practicedToday(c)}
                style={{ color: "var(--accent)", fontSize: "1.2rem" }}
              >
                ✓
              </button>
              <button
                type="button"
                className="grow"
                style={{ all: "unset", cursor: "pointer", flex: 1, minWidth: 0 }}
                onClick={() => setEditing({ ...c })}
                aria-label={`Edit ${c.name}`}
              >
                <div className="primary" style={{ fontWeight: 600 }}>
                  {c.name}
                  {c.proficiency > 0 && (
                    <span style={{ color: "var(--accent)", marginLeft: 8, fontSize: "var(--fs-sm)" }}>
                      {"●".repeat(c.proficiency)}
                      <span style={{ opacity: 0.25 }}>{"●".repeat(5 - c.proficiency)}</span>
                    </span>
                  )}
                </div>
                <div className="secondary" style={{ color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>
                  {c.category}
                  {c.lastPracticed
                    ? ` · practiced ${days !== null && days <= 0 ? "today" : `${days}d ago`}`
                    : " · never practiced"}
                  {c.notes ? ` · ${c.notes}` : ""}
                </div>
              </button>
              <span
                className="badge"
                style={{
                  background: stale ? "var(--warn-soft)" : "var(--surface-2)",
                  color: stale ? "var(--warn)" : "var(--text-2)"
                }}
              >
                {c.lastPracticed ? (days !== null && days <= 0 ? "today" : `${days}d`) : "—"}
              </span>
            </div>
          );
        })}

        {commands && commands.length > 0 && (
          <button type="button" className="btn secondary block" onClick={() => setAddOpen(true)}>
            ＋ Add command
          </button>
        )}
      </main>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Add command">
        <Field label="Command name" htmlFor="cmd-name">
          <input id="cmd-name" type="text" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
        </Field>
        <Field label="Category">
          <select aria-label="Category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </Field>
        <button
          type="button"
          className="btn block"
          disabled={!newName.trim()}
          onClick={async () => {
            await add(newName, newCategory);
            setNewName("");
            setAddOpen(false);
            toast("Command added");
          }}
        >
          Add
        </button>
      </Sheet>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing?.name ?? ""}>
        {editing && (
          <>
            <RatingBar
              label="Proficiency (1 learning – 5 mastered)"
              value={editing.proficiency}
              onChange={(v) => setEditing({ ...editing, proficiency: v as Rating | 0 })}
            />
            <Field label="Last practiced" htmlFor="cmd-last">
              <input
                id="cmd-last"
                type="date"
                value={editing.lastPracticed}
                onChange={(e) => setEditing({ ...editing, lastPracticed: e.target.value })}
              />
            </Field>
            <Field label="Notes" htmlFor="cmd-notes">
              <textarea
                id="cmd-notes"
                value={editing.notes}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
              />
            </Field>
            <div className="row">
              <button type="button" className="btn warn-outline" onClick={() => setDeleteId(editing.id)}>
                Remove
              </button>
              <button type="button" className="btn" onClick={saveEdit}>
                Save
              </button>
            </div>
          </>
        )}
      </Sheet>

      <ConfirmSheet
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) {
            const c = await db.commands.get(deleteId);
            if (c) await db.commands.put({ ...c, archived: true, updatedAt: nowIso() });
          }
          setEditing(null);
          toast("Command removed");
        }}
        title="Remove this command?"
        message="The command is archived (kept in backups) and disappears from this list."
        confirmLabel="Remove"
      />
    </>
  );
}
