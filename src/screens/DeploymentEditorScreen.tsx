/**
 * Deployment record — a real operational search, not a training exercise.
 *
 * A deployment has no placed hides, no blindness level, no reward drill and
 * no "exercises": the handler documents where the K9 searched and what it
 * located. Zero finds is a legitimate and important result (area cleared),
 * so nothing forces a find to exist.
 *
 * Storage note: this writes to the same session/exercise/hide tables as
 * training via a single container exercise, so history, search, exports,
 * revisions and backups keep working for these records unchanged.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { db, useAutosave, useLiveQuery, useSettings } from "../hooks";
import { TopBar, OfflineBanner } from "../components/shell";
import {
  ChipSelect,
  Collapse,
  ConfirmSheet,
  Field,
  OutcomePicker,
  Sheet,
  StatusBadge,
  useToast
} from "../components/ui";
import { AttachmentsCard } from "../components/AttachmentsCard";
import type { Exercise, Hide, HideOutcome, TrainingSession } from "../db/types";
import { newHide } from "../db/factories";
import {
  deleteDraftSession,
  deleteHide,
  getOrCreateDeploymentExercise,
  recordCorrection,
  saveExercise,
  saveHide,
  saveSessionDraft,
  touchLocation
} from "../db/repo";
import { validateSession } from "../lib/validation";
import { DEVICE_LABELS, fmtDate } from "../lib/format";

const SEARCH_AREAS = [
  "Residence",
  "Apartment",
  "Vehicle",
  "Office",
  "Storage unit",
  "Hotel room",
  "Outbuilding",
  "Electronics / media room",
  "Outdoor area",
  "Other"
];

const DEVICE_OPTIONS: Hide["deviceType"][] = [
  "cellphone",
  "usb_drive",
  "sd_card",
  "micro_sd",
  "sim_card",
  "hard_drive",
  "ssd",
  "tablet",
  "laptop",
  "dvr",
  "game_console",
  "other"
];

export default function DeploymentEditorScreen() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const correcting = params.get("correct") === "1";
  const navigate = useNavigate();
  const settings = useSettings();
  const toast = useToast();

  const stored = useLiveQuery(() => db.sessions.get(id!), [id]);
  const finds = useLiveQuery(
    async () =>
      (await db.hides.where("sessionId").equals(id!).toArray()).sort(
        (a, b) => a.number - b.number
      ),
    [id]
  );

  const [session, setSession] = useState<TrainingSession | null>(null);
  const [container, setContainer] = useState<Exercise | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteFindId, setDeleteFindId] = useState<string | null>(null);
  const [reasonSheet, setReasonSheet] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (stored && !session) setSession(stored);
  }, [stored, session]);

  // Ensure the container exercise exists (reuses a legacy one if present).
  useEffect(() => {
    let cancelled = false;
    if (id && stored) {
      void getOrCreateDeploymentExercise(id).then((ex) => {
        if (!cancelled) setContainer(ex);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [id, stored]);

  const isDraft = stored?.status === "draft";
  const editable = isDraft || correcting;

  const { save, flushNow, saving } = useAutosave<TrainingSession>(async (s) => {
    if (isDraft) await saveSessionDraft(s);
  });

  const update = (patch: Partial<TrainingSession>) => {
    if (!session || !editable) return;
    const next = { ...session, ...patch };
    setSession(next);
    if (isDraft) save(next);
  };

  const updateContainer = async (patch: Partial<Exercise>) => {
    if (!container || !editable) return;
    const next = { ...container, ...patch };
    setContainer(next);
    if (isDraft) await saveExercise(next);
  };

  if (!stored || !session || !finds || !container) {
    return (
      <>
        <TopBar title="Deployment" back="/" />
        <main className="shell-main">
          {stored === null ? (
            <div className="empty">
              <div className="big" aria-hidden="true">🔍</div>
              <h3>Record not found</h3>
            </div>
          ) : (
            <p>Loading…</p>
          )}
        </main>
      </>
    );
  }
  if (!isDraft && !correcting) {
    navigate(`/record/${session.id}`, { replace: true });
    return null;
  }

  const issues = validateSession(session);
  const errFor = (f: string) =>
    issues.find((i) => i.field === f && i.severity === "error")?.message;

  const addFind = async () => {
    const h = newHide(container.id, session.id, (finds[finds.length - 1]?.number ?? 0) + 1);
    h.outcome = "found_independent"; // the usual case; one tap changes it
    h.targetMaterial = "Electronic storage device";
    h.handlerKnewLocation = false;
    h.placedBy = "";
    await saveHide(h);
  };

  const patchFind = async (h: Hide, patch: Partial<Hide>) => {
    await saveHide({ ...h, ...patch });
  };

  const saveCorrection = async () => {
    try {
      await recordCorrection(session, settings.handlerName || "Handler", reason);
      toast("Correction saved");
      setReasonSheet(false);
      navigate(`/record/${session.id}`, { replace: true });
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const recovered = finds.filter(
    (f) => f.outcome === "found_independent" || f.outcome === "found_assisted"
  ).length;
  const unconfirmed = finds.filter((f) => f.outcome === "alert_unconfirmed").length;

  return (
    <>
      <TopBar
        title={correcting ? "Correct Deployment" : "Deployment"}
        back={correcting ? `/record/${session.id}` : "/"}
        actions={
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-3)" }} aria-live="polite">
            {isDraft ? (saving ? "Saving…" : "Saved") : ""}
          </span>
        }
      />
      <main className="shell-main">
        <OfflineBanner />
        {correcting && (
          <div className="banner warn" role="status">
            <span aria-hidden="true">✏️</span>
            <span>
              Correcting a finalized record. Original values are kept in the revision
              history and a reason is required.
            </span>
          </div>
        )}

        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10
            }}
          >
            <strong>🚔 {fmtDate(session.date, settings.dateFormat)}</strong>
            <StatusBadge status={stored.status} />
          </div>
          <Field label="Case / warrant #" htmlFor="d-case">
            <input
              id="d-case"
              type="text"
              value={session.caseNumber}
              placeholder="e.g., 2026-CF-1234"
              onChange={(e) => update({ caseNumber: e.target.value })}
            />
          </Field>
          <Field label="Location" htmlFor="d-loc" error={errFor("locationName")}>
            <input
              id="d-loc"
              type="text"
              value={session.locationName}
              placeholder="Address or site"
              onChange={(e) => update({ locationName: e.target.value })}
              onBlur={async () => {
                if (session.locationName.trim() && isDraft) {
                  const locId = await touchLocation(
                    session.locationName.trim(),
                    session.locationAddress
                  );
                  update({ locationId: locId });
                }
              }}
            />
          </Field>
        </div>

        <div className="card">
          <h3>Areas searched</h3>
          <ChipSelect
            ariaLabel="Areas searched"
            values={container.roomTypes}
            options={SEARCH_AREAS.map((a) => ({ value: a, label: a }))}
            onChange={(v) => updateContainer({ roomTypes: v })}
          />
          <Field label="Details (optional)" htmlFor="d-area" >
            <input
              id="d-area"
              type="text"
              value={container.areaDescription}
              placeholder="e.g., Master bedroom, garage, 2 vehicles"
              onChange={(e) => updateContainer({ areaDescription: e.target.value })}
            />
          </Field>
        </div>

        {/* --- finds --- */}
        <div className="card">
          <h3>
            Devices located ({recovered}
            {unconfirmed > 0 ? ` · ${unconfirmed} unconfirmed` : ""})
          </h3>
          {finds.length === 0 && (
            <div className="banner info" role="status" style={{ marginBottom: 12 }}>
              <span aria-hidden="true">ℹ️</span>
              <span>
                No devices recorded yet. If the K9 searched and located nothing, leave
                this empty — a cleared search is a valid, important record.
              </span>
            </div>
          )}
          {finds.map((f) => (
            <div
              key={f.id}
              className="card flat"
              style={{ padding: 12, marginBottom: 12, background: "var(--surface-2)" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <strong style={{ minWidth: 28 }}>#{f.number}</strong>
                <select
                  aria-label={`Device type for find ${f.number}`}
                  value={f.deviceType}
                  onChange={(e) =>
                    patchFind(f, { deviceType: e.target.value as Hide["deviceType"] })
                  }
                  style={{ flex: 1, minHeight: 48 }}
                >
                  {DEVICE_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {DEVICE_LABELS[d]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove find ${f.number}`}
                  onClick={() => setDeleteFindId(f.id)}
                >
                  ✕
                </button>
              </div>
              <Field label="Where it was located" htmlFor={`d-find-${f.id}`}>
                <input
                  id={`d-find-${f.id}`}
                  type="text"
                  value={f.locationDescription}
                  placeholder="e.g., Bedroom closet, inside shoe box"
                  onChange={(e) => patchFind(f, { locationDescription: e.target.value })}
                />
              </Field>
              <OutcomePicker
                mode="deployment"
                label={`Result for find ${f.number}`}
                value={f.outcome}
                onChange={(v) => patchFind(f, { outcome: v as HideOutcome })}
              />
              <Field label="Notes (optional)" htmlFor={`d-notes-${f.id}`}>
                <input
                  id={`d-notes-${f.id}`}
                  type="text"
                  value={f.notes}
                  placeholder="Seized, photographed, tagged…"
                  onChange={(e) => patchFind(f, { notes: e.target.value })}
                />
              </Field>
            </div>
          ))}
          <button type="button" className="btn block" onClick={addFind}>
            ＋ Add device located
          </button>
        </div>

        <div className="card">
          <Field label="Deployment notes" htmlFor="d-summary">
            <textarea
              id="d-summary"
              value={session.summary}
              placeholder="What was searched, K9 behaviour, outcome…"
              onChange={(e) => update({ summary: e.target.value })}
            />
          </Field>
        </div>

        <div className="card flat">
          <Collapse title="⏱ Time & personnel" defaultOpen={settings.showAdvancedFields}>
            <div className="row">
              <Field label="Date" htmlFor="d-date" error={errFor("date")}>
                <input
                  id="d-date"
                  type="date"
                  value={session.date}
                  onChange={(e) => update({ date: e.target.value })}
                />
              </Field>
            </div>
            <div className="row">
              <Field label="Start" htmlFor="d-start">
                <input
                  id="d-start"
                  type="time"
                  value={session.startTime}
                  onChange={(e) => update({ startTime: e.target.value })}
                />
              </Field>
              <Field label="End" htmlFor="d-end">
                <input
                  id="d-end"
                  type="time"
                  value={session.endTime}
                  onChange={(e) => update({ endTime: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Requesting agency / other personnel" htmlFor="d-personnel">
              <input
                id="d-personnel"
                type="text"
                value={session.otherPersonnel}
                onChange={(e) => update({ otherPersonnel: e.target.value })}
              />
            </Field>
            <Field label="Handler" htmlFor="d-handler" error={errFor("handlerName")}>
              <input
                id="d-handler"
                type="text"
                value={session.handlerName}
                onChange={(e) => update({ handlerName: e.target.value })}
              />
            </Field>
          </Collapse>
        </div>

        <AttachmentsCard sessionId={session.id} readOnly={!editable} />

        {isDraft ? (
          <>
            <button
              type="button"
              className="btn block"
              onClick={async () => {
                await flushNow(session);
                navigate(`/session/${session.id}/review`);
              }}
            >
              Finish &amp; save record
            </button>
            <button
              type="button"
              className="btn ghost block"
              style={{ marginTop: 10 }}
              onClick={async () => {
                await flushNow(session);
                toast("Draft saved");
                navigate("/");
              }}
            >
              Save for later
            </button>
            <button
              type="button"
              className="btn warn-outline block"
              style={{ marginTop: 10 }}
              onClick={() => setConfirmDelete(true)}
            >
              Delete draft
            </button>
          </>
        ) : (
          <button type="button" className="btn block" onClick={() => setReasonSheet(true)}>
            Save correction…
          </button>
        )}
      </main>

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteDraftSession(session.id);
          toast("Draft deleted");
          navigate("/", { replace: true });
        }}
        title="Delete this draft?"
        message="The draft deployment and its recorded finds will be permanently removed."
        confirmLabel="Delete draft"
        danger
      />
      <ConfirmSheet
        open={deleteFindId !== null}
        onClose={() => setDeleteFindId(null)}
        onConfirm={async () => {
          if (deleteFindId) await deleteHide(deleteFindId);
          toast("Find removed");
        }}
        title="Remove this device?"
        message="The recorded find will be removed from this deployment."
        confirmLabel="Remove"
        danger
      />
      <Sheet open={reasonSheet} onClose={() => setReasonSheet(false)} title="Reason for correction">
        <Field label="Why is this record being corrected?" htmlFor="dcorr-reason">
          <textarea id="dcorr-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <button type="button" className="btn block" disabled={!reason.trim()} onClick={saveCorrection}>
          Save correction
        </button>
      </Sheet>
    </>
  );
}
