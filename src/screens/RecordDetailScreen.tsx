/**
 * Read-only view of a finalized (or draft) record with actions:
 * correction, review, lock, revision history, single-session PDF export.
 */
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { db, useLiveQuery, useSettings } from "../hooks";
import { TopBar } from "../components/shell";
import { ConfirmSheet, Field, Sheet, StatusBadge, useToast } from "../components/ui";
import { reviewSession, setSessionStatus } from "../db/repo";
import { getSettings } from "../db/db";
import { computeStats, sessionMinutes, tallyHides } from "../lib/stats";
import {
  ACTIVITY_LABELS, BLINDNESS_LABELS, DEVICE_LABELS, OUTCOME_LABELS,
  fmtDate, fmtDateTime, fmtMinutes, fmtSeconds
} from "../lib/format";
import { AttachmentsCard } from "../components/AttachmentsCard";
import { buildDetailedReport, pdfBlob } from "../lib/exportPdf";
import { shareOrDownload } from "../lib/backup";

export default function RecordDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const settings = useSettings();
  const toast = useToast();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewer, setReviewer] = useState("");
  const [reviewComments, setReviewComments] = useState("");
  const [lockConfirm, setLockConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);

  const session = useLiveQuery(() => db.sessions.get(id!), [id]);
  const exercises = useLiveQuery(
    () => db.exercises.where("sessionId").equals(id!).sortBy("order"),
    [id]
  );
  const hides = useLiveQuery(() => db.hides.where("sessionId").equals(id!).toArray(), [id]);
  const revisions = useLiveQuery(
    () => db.revisions.where("sessionId").equals(id!).count(),
    [id]
  );
  const searchTypes = useLiveQuery(() => db.searchTypes.toArray(), []);

  if (!session || !exercises || !hides) {
    return (
      <>
        <TopBar title="Record" back="/history" />
        <main className="shell-main"><p>Loading…</p></main>
      </>
    );
  }

  const stats = computeStats([session], exercises, hides);
  const typeLabel = (tid: string) => searchTypes?.find((t) => t.id === tid)?.label ?? tid;
  const editable = session.status !== "locked";

  const exportPdf = async () => {
    setExporting(true);
    try {
      const s = await getSettings();
      const doc = buildDetailedReport(
        { settings: s, sessions: [session], exercises, hides, searchTypes: searchTypes ?? [] },
        [{ session, exercises, hides }]
      );
      const result = await shareOrDownload(
        `ESD-K9-session-${session.date}.pdf`,
        pdfBlob(doc),
        "application/pdf"
      );
      if (result !== "cancelled") toast(result === "shared" ? "PDF shared" : "PDF downloaded");
    } catch (e) {
      toast(`Export failed: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <TopBar title="Training Record" back="/history" />
      <main className="shell-main">
        <div className="card">
          <h2 style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span>{fmtDate(session.date, settings.dateFormat)}</span>
            <StatusBadge status={session.status} />
          </h2>
          <dl className="kv">
            <dt>Record ID</dt><dd style={{ fontFamily: "monospace", fontSize: "var(--fs-xs)" }}>{session.id}</dd>
            <dt>Location</dt><dd>{session.locationName}{session.locationAddress ? `, ${session.locationAddress}` : ""} ({session.environment})</dd>
            <dt>Time</dt><dd>{session.startTime || "—"}–{session.endTime || "—"} ({fmtMinutes(sessionMinutes(session))})</dd>
            <dt>Activity</dt><dd>{ACTIVITY_LABELS[session.activityType]}{session.activityOther ? ` — ${session.activityOther}` : ""}</dd>
            <dt>Handler / K9</dt><dd>{session.handlerName} / {session.k9Name}</dd>
            {session.trainerName && (<><dt>Trainer</dt><dd>{session.trainerName}</dd></>)}
            {session.otherPersonnel && (<><dt>Personnel</dt><dd>{session.otherPersonnel}</dd></>)}
            {session.objective && (<><dt>Objective</dt><dd>{session.objective}</dd></>)}
            {session.summary && (<><dt>Summary</dt><dd>{session.summary}</dd></>)}
            {session.overallAssessment > 0 && (<><dt>Overall</dt><dd>{session.overallAssessment} / 5</dd></>)}
            {session.correctiveFollowUp && (<><dt>Follow-up</dt><dd>{session.correctiveFollowUp}</dd></>)}
            {session.nextFocus && (<><dt>Next focus</dt><dd>{session.nextFocus}</dd></>)}
            <dt>Created</dt><dd>{fmtDateTime(session.createdAt)} by {session.createdBy}</dd>
            <dt>Modified</dt><dd>{fmtDateTime(session.updatedAt)} by {session.modifiedBy}</dd>
            {session.handlerAcknowledged && (
              <><dt>Acknowledged</dt><dd>{fmtDateTime(session.handlerAcknowledgedAt)}</dd></>
            )}
            {session.review && (
              <><dt>Reviewed</dt><dd>{session.review.reviewerName}, {fmtDateTime(session.review.reviewedAt)}{session.review.comments ? ` — ${session.review.comments}` : ""}</dd></>
            )}
          </dl>
        </div>

        {(session.env.temperatureF != null || session.env.weather || session.env.notes) && (
          <div className="card">
            <h3>Environment</h3>
            <dl className="kv">
              {session.env.temperatureF != null && (<><dt>Temperature</dt><dd>{session.env.temperatureF}°F</dd></>)}
              {session.env.weather && (<><dt>Weather</dt><dd>{session.env.weather}</dd></>)}
              {session.env.wind && (<><dt>Wind</dt><dd>{session.env.wind}</dd></>)}
              {session.env.distractorOdors && (<><dt>Distractors</dt><dd>{session.env.distractorOdors}</dd></>)}
              {session.env.notes && (<><dt>Notes</dt><dd>{session.env.notes}</dd></>)}
            </dl>
          </div>
        )}

        {exercises.map((ex) => {
          const exHides = hides.filter((h) => h.exerciseId === ex.id).sort((a, b) => a.number - b.number);
          const t = tallyHides(exHides);
          return (
            <div key={ex.id} className="card">
              <h3>
                {ex.order}. {typeLabel(ex.searchTypeId)}
                {ex.isBlankSearch ? " (blank search)" : ""}
              </h3>
              <dl className="kv">
                <dt>Blindness</dt><dd>{BLINDNESS_LABELS[ex.blindness]}</dd>
                {ex.areaDescription && (<><dt>Area</dt><dd>{ex.areaDescription}{ex.roomTypes.length ? ` (${ex.roomTypes.join(", ")})` : ""}</dd></>)}
                <dt>Result</dt>
                <dd>
                  {ex.isBlankSearch
                    ? ex.blankCorrect
                      ? "Correctly cleared — no false response"
                      : ex.blankCorrect === false
                        ? "False response given"
                        : "Not recorded"
                    : `${t.hidesPlaced} hides · ${t.independentFinds} independent, ${t.assistedFinds} assisted, ${t.misses} missed, ${t.interestOnly} interest-only · ${ex.falseResponses.length} false response(s)`}
                </dd>
                {ex.searchTimeSeconds != null && (
                  <><dt>Time</dt><dd>{fmtSeconds(ex.searchTimeSeconds)}{ex.timeToFirstFindSeconds != null ? ` (first find ${fmtSeconds(ex.timeToFirstFindSeconds)})` : ""}</dd></>
                )}
                {ex.rewardType && (<><dt>Reward</dt><dd>{ex.rewardType}{ex.rewardCups != null ? `, ${ex.rewardCups} cups` : ""}{ex.rewardedAtSource ? ", at source" : ""}</dd></>)}
                {ex.result && (<><dt>Outcome</dt><dd>{ex.result.replace("_", " ")}</dd></>)}
                {ex.problems && (<><dt>Problems</dt><dd>{ex.problems}</dd></>)}
                {ex.correctiveTraining && (<><dt>Corrective</dt><dd>{ex.correctiveTraining}</dd></>)}
                {ex.comments && (<><dt>Comments</dt><dd>{ex.comments}</dd></>)}
              </dl>
              {exHides.map((h) => (
                <div key={h.id} className="list-item" style={{ cursor: "default", marginTop: 6 }}>
                  <div className="grow">
                    <div className="primary">
                      #{h.number} {h.deviceType === "other" ? h.deviceTypeOther : DEVICE_LABELS[h.deviceType]} — {h.outcome ? OUTCOME_LABELS[h.outcome] : "no outcome"}
                    </div>
                    <div className="secondary">
                      {h.locationDescription}
                      {h.notes ? ` · ${h.notes}` : ""}
                    </div>
                  </div>
                </div>
              ))}
              {ex.falseResponses.map((f) => (
                <div key={f.id} className="list-item" style={{ cursor: "default", marginTop: 6, borderColor: "var(--danger)" }}>
                  <div className="grow">
                    <div className="primary">False response — {f.locationDescription}</div>
                    {f.suspectedCause && <div className="secondary">Suspected cause: {f.suspectedCause}</div>}
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        <AttachmentsCard sessionId={session.id} readOnly={session.status === "locked"} />

        <div className="section-label">Actions</div>
        <button type="button" className="btn block" disabled={exporting} onClick={exportPdf}>
          {exporting ? "Building PDF…" : "Export this session to PDF"}
        </button>
        <Link
          to={`/record/${session.id}/revisions`}
          className="btn secondary block"
          style={{ marginTop: 8, textDecoration: "none" }}
        >
          Revision history ({revisions ?? 0})
        </Link>
        {session.status === "draft" && (
          <Link to={`/session/${session.id}`} className="btn secondary block" style={{ marginTop: 8, textDecoration: "none" }}>
            Continue editing draft
          </Link>
        )}
        {editable && session.status !== "draft" && (
          <>
            <Link
              to={`/session/${session.id}?correct=1`}
              className="btn secondary block"
              style={{ marginTop: 8, textDecoration: "none" }}
            >
              Make a documented correction
            </Link>
            {session.status === "completed" && (
              <button type="button" className="btn secondary block" style={{ marginTop: 8 }} onClick={() => setReviewOpen(true)}>
                Record supervisor review
              </button>
            )}
            <button type="button" className="btn warn-outline block" style={{ marginTop: 8 }} onClick={() => setLockConfirm(true)}>
              Lock record (read-only)
            </button>
          </>
        )}
        {session.status === "locked" && (
          <div className="banner info" role="status" style={{ marginTop: 8 }}>
            <span aria-hidden="true">🔒</span>
            <span>This record is locked and can no longer be modified.</span>
          </div>
        )}
      </main>

      <Sheet open={reviewOpen} onClose={() => setReviewOpen(false)} title="Supervisor / trainer review">
        <Field label="Reviewer name" htmlFor="rv-name">
          <input id="rv-name" type="text" value={reviewer} onChange={(e) => setReviewer(e.target.value)} />
        </Field>
        <Field label="Comments (optional)" htmlFor="rv-comments">
          <textarea id="rv-comments" value={reviewComments} onChange={(e) => setReviewComments(e.target.value)} />
        </Field>
        <button
          type="button"
          className="btn block"
          disabled={!reviewer.trim()}
          onClick={async () => {
            try {
              await reviewSession(session.id, reviewer.trim(), reviewComments.trim());
              toast("Review recorded");
              setReviewOpen(false);
            } catch (e) {
              toast((e as Error).message);
            }
          }}
        >
          Save review
        </button>
      </Sheet>

      <ConfirmSheet
        open={lockConfirm}
        onClose={() => setLockConfirm(false)}
        onConfirm={async () => {
          await setSessionStatus(session.id, "locked", settings.handlerName || "Handler", "Record locked");
          toast("Record locked");
        }}
        title="Lock this record?"
        message="A locked record becomes permanently read-only in the app. Use this once a record has been finalized and reviewed. This cannot be undone from the interface."
        confirmLabel="Lock record"
      />
    </>
  );
}
