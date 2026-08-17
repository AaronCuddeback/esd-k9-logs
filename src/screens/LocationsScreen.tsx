import { useState } from "react";
import { db, useLiveQuery } from "../hooks";
import { TopBar } from "../components/shell";
import { ConfirmSheet, EmptyState, Field, Sheet, useToast } from "../components/ui";
import { nowIso, uuid } from "../db/db";

export default function LocationsScreen() {
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [kind, setKind] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const locations = useLiveQuery(
    async () =>
      (await db.locations.toArray()).sort(
        (a, b) =>
          Number(b.favorite) - Number(a.favorite) ||
          b.lastUsedAt.localeCompare(a.lastUsedAt)
      ),
    []
  );

  const add = async () => {
    if (!name.trim()) return;
    await db.locations.add({
      id: uuid(),
      name: name.trim(),
      address: address.trim(),
      kind: kind.trim(),
      favorite: false,
      useCount: 0,
      lastUsedAt: "",
      createdAt: nowIso()
    });
    setName("");
    setAddress("");
    setKind("");
    setAddOpen(false);
    toast("Location added");
  };

  const toggleFavorite = async (id: string) => {
    const loc = await db.locations.get(id);
    if (loc) await db.locations.put({ ...loc, favorite: !loc.favorite });
  };

  return (
    <>
      <TopBar title="Locations" back="/more" />
      <main className="shell-main">
        <p style={{ color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>
          Favorites appear first when starting a new session. Locations are added
          automatically as you use them.
        </p>
        {locations && locations.length === 0 && (
          <EmptyState icon="📍" title="No locations yet" />
        )}
        {locations?.map((l) => (
          <div key={l.id} className="list-item" style={{ cursor: "default" }}>
            <button
              type="button"
              className="icon-btn"
              aria-label={l.favorite ? `Unfavorite ${l.name}` : `Favorite ${l.name}`}
              aria-pressed={l.favorite}
              onClick={() => toggleFavorite(l.id)}
              style={{ color: l.favorite ? "var(--warn)" : "var(--text-3)" }}
            >
              {l.favorite ? "★" : "☆"}
            </button>
            <div className="grow">
              <div className="primary">{l.name}</div>
              <div className="secondary">
                {[l.kind, l.address, l.useCount ? `used ${l.useCount}×` : "not used yet"]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Delete location ${l.name}`}
              onClick={() => setDeleteId(l.id)}
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="btn secondary block" onClick={() => setAddOpen(true)}>
          ＋ Add location
        </button>
      </main>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Add location">
        <Field label="Name" htmlFor="l-name">
          <input id="l-name" type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Address / area (optional)" htmlFor="l-addr">
          <input id="l-addr" type="text" value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label="Type (optional)" htmlFor="l-kind">
          <input id="l-kind" type="text" value={kind} placeholder="Office building, park…" onChange={(e) => setKind(e.target.value)} />
        </Field>
        <button type="button" className="btn block" disabled={!name.trim()} onClick={add}>
          Add location
        </button>
      </Sheet>

      <ConfirmSheet
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) await db.locations.delete(deleteId);
          toast("Location removed");
        }}
        title="Remove this location?"
        message="Past training records keep their location text — only the reusable shortcut is removed."
        confirmLabel="Remove"
        danger
      />
    </>
  );
}
