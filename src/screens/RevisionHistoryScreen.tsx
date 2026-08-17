import { useParams } from "react-router-dom";
import { db, useLiveQuery } from "../hooks";
import { TopBar } from "../components/shell";
import { EmptyState } from "../components/ui";
import { fmtDateTime } from "../lib/format";

const KIND_LABELS: Record<string, string> = {
  finalize: "Finalized",
  correction: "Correction",
  status_change: "Status change",
  review: "Review"
};

export default function RevisionHistoryScreen() {
  const { id } = useParams<{ id: string }>();
  const revisions = useLiveQuery(
    async () =>
      (await db.revisions.where("sessionId").equals(id!).toArray()).sort((a, b) =>
        b.timestamp.localeCompare(a.timestamp)
      ),
    [id]
  );

  return (
    <>
      <TopBar title="Revision History" back={`/record/${id}`} />
      <main className="shell-main">
        <p style={{ color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>
          Every finalization, correction, review, and status change is recorded here
          with the original values. Entries cannot be edited or deleted from the app.
        </p>
        {revisions && revisions.length === 0 && (
          <EmptyState icon="📜" title="No revisions" sub="This record has not been finalized or corrected yet." />
        )}
        {revisions?.map((r) => (
          <div key={r.id} className="card">
            <h3 style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span>{KIND_LABELS[r.kind] ?? r.kind}</span>
              <span style={{ fontWeight: 400, color: "var(--text-3)", fontSize: "var(--fs-sm)" }}>
                {fmtDateTime(r.timestamp)}
              </span>
            </h3>
            <p style={{ marginBottom: 6 }}>
              <strong>{r.person}</strong> — {r.reason}
            </p>
            {r.changes.length > 0 && (
              <dl className="kv">
                {r.changes.map((c, i) => (
                  <div key={i} style={{ display: "contents" }}>
                    <dt>{c.field}</dt>
                    <dd>
                      {c.before !== "" && (
                        <s style={{ color: "var(--text-3)" }}>{truncate(c.before)}</s>
                      )}
                      {c.before !== "" && " → "}
                      <span>{truncate(c.after) || "(cleared)"}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </main>
    </>
  );
}

function truncate(s: string, n = 160) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
