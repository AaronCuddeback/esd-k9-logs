/**
 * Training session editor.
 *
 * Only what a handler needs for a routine morning session is on screen:
 * location, exercises, notes, finish. Everything else — people, objective,
 * environment, welfare, GPS, follow-up — lives in collapsed sections so a
 * 15-minute box drill takes a handful of taps, while the full detail is
 * still there for certification or court-facing records.
 *
 * Autosaves continuously while status = draft. For finalized records opened
 * in correction mode (?correct=1) edits are held locally and saved through
 * recordCorrection() with a required reason.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { db, useAutosave, useLiveQuery, useSettings } from "../hooks";
import { TopBar, OfflineBanner } from "../components/shell";
import {
  Collapse,
  ConfirmSheet,
  Field,
  NumInput,
  RatingBar,
  Segmented,
  Sheet,
  StatusBadge,
  ToggleRow,
  useToast
} from "../components/ui";
import { AttachmentsCard } from "../components/AttachmentsCard";
import type { ActivityType, Environment, TrainingSession } from "../db/types";
import { emptyWelfare, newExercise } from "../db/factories";
import {
  deleteDraftSession,
  deleteExercise,
  recordCorrection,
  saveSessionDraft,
  touchLocation
} from "../db/repo";
import { tallyHides } from "../lib/stats";
import { validateSession } from "../lib/validation";
import { BLINDNESS_LABELS, fmtDate } from "../lib/format";

export default function SessionEditorScreen() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const correcting = params.get("correct") === "1";
  const navigate = useNavigate();
  const settings = useSettings();
  const toast = useToast();

  const stored = useLiveQuery(() => db.sessions.get(id!), [id]);
  const exercises = useLiveQuery(
    () => db.exercises.where("sessionId").equals(id!).sortBy("order"),
    [id]
  );
  const hides = useLiveQuery(() => db.hides.where("sessionId").equals(id!).toArray(), [id]);
  const searchTypes = useLiveQuery(() => db.searchTypes.toArray(), []);

  const [session, setSession] = useState<TrainingSession | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reasonSheet, setReasonSheet] = useState(false);
  const [reason, setReason] = useState("");
  const [deleteExId, setDeleteExId] = useState<string | null>(null);

  useEffect(() => {
    if (stored && !session) setSession(stored);
  }, [stored, session]);

  // Deployments have their own editor; finalized records are read-only.
  useEffect(() => {
    if (!stored) return;
    if (stored.activityType === "deployment_training") {
      navigate(`/deployment/${stored.id}${correcting ? "?correct=1" : ""}`, { replace: true });
    } else if (stored.status !== "draft" && !correcting) {
      navigate(`/record/${stored.id}`, { replace: true });
    }
  }, [stored, correcting, navigate]);

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

  if (!stored || !session || !exercises || !hides) {
    return (
      <>
        <TopBar title="Session" back="/" />
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
  if (!isDraft && !correcting) return null;

  const issues = validateSession(session);
  const errFor = (f: string) =>
    issues.find((i) => i.field === f && i.severity === "error")?.message;
  const typeLabel = (tid: string) => searchTypes?.find((t) => t.id === tid)?.label ?? tid;

  const addExercise = async () => {
    await flushNow(session);
    const ex = newExercise(session.id, (exercises[exercises.length - 1]?.order ?? 0) + 1);
    // reuse the previous exercise's setup — most sessions repeat the pattern
    const prev = exercises[exercises.length - 1];
    if (prev) {
      ex.searchTypeId = prev.searchTypeId;
      ex.blindness = prev.blindness;
      ex.roomTypes = [...prev.roomTypes];
    }
    await db.exercises.put(ex);
    navigate(`/session/${session.id}/exercise/${ex.id}${correcting ? "?correct=1" : ""}`);
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

  const showAdvanced = settings.showAdvancedFields;

  return (
    <>
      <TopBar
        title={correcting ? "Correct Record" : "Training Session"}
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

        {/* --- essentials --- */}
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10
            }}
          >
            <strong>{fmtDate(session.date, settings.dateFormat)}</strong>
            <StatusBadge status={stored.status} />
          </div>
          <Field label="Location" htmlFor="s-loc" error={errFor("locationName")}>
            <input
              id="s-loc"
              type="text"
              value={session.locationName}
              placeholder="Where are you training?"
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
          <Field
            label="Area searched (optional)"
            htmlFor="s-area"
            hint="Which part of the location — bedroom, garage, back yard…"
          >
            <input
              id="s-area"
              type="text"
              value={session.areaSearched ?? ""}
              placeholder="e.g., Master bedroom and garage"
              onChange={(e) => update({ areaSearched: e.target.value })}
            />
          </Field>
        </div>

        {/* --- exercises: the main event --- */}
        <div className="card">
          <h3>Exercises ({exercises.length})</h3>
          {exercises.length === 0 && (
            <p style={{ color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>
              Add each search problem you ran — box drill, room search, vehicle line.
            </p>
          )}
          {exercises.map((ex) => {
            const t = tallyHides(hides.filter((h) => h.exerciseId === ex.id));
            return (
              <div key={ex.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Link
                  className="list-item"
                  style={{ flex: 1, marginBottom: 10 }}
                  to={`/session/${session.id}/exercise/${ex.id}${correcting ? "?correct=1" : ""}`}
                >
                  <div className="grow">
                    <div className="primary">
                      {ex.order}. {typeLabel(ex.searchTypeId)}
                      {ex.isBlankSearch ? " (blank)" : ""}
                    </div>
                    <div className="secondary">
                      {ex.isBlankSearch
                        ? ex.blankCorrect === true
                          ? "Cleared correctly"
                          : ex.blankCorrect === false
                            ? "False response"
                            : "No result yet"
                        : `${t.confirmedFinds}/${t.hidesPlaced} found${t.misses ? ` · ${t.misses} missed` : ""}${
                            ex.falseResponses.length ? ` · ${ex.falseResponses.length} false` : ""
                          }`}
                      {" · "}
                      {BLINDNESS_LABELS[ex.blindness]}
                    </div>
                  </div>
                </Link>
                {isDraft && (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Delete exercise ${ex.order}`}
                    onClick={() => setDeleteExId(ex.id)}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
          <button type="button" className="btn block" onClick={addExercise}>
            ＋ Add exercise
          </button>
        </div>

        {/* --- notes --- */}
        <div className="card">
          <Field
            label="Session notes (optional)"
            htmlFor="s-summary"
            hint="Use the keyboard microphone to dictate."
          >
            <textarea
              id="s-summary"
              value={session.summary}
              onChange={(e) => update({ summary: e.target.value })}
            />
          </Field>
        </div>

        {/* --- everything optional, collapsed by default --- */}
        <div className="card flat">
          <Collapse title="⏱ Time, type & case number" defaultOpen={showAdvanced}>
            <div className="row">
              <Field label="Date" htmlFor="s-date" error={errFor("date")}>
                <input
                  id="s-date"
                  type="date"
                  value={session.date}
                  onChange={(e) => update({ date: e.target.value })}
                />
              </Field>
            </div>
            <div className="row">
              <Field label="Start" htmlFor="s-start" error={errFor("startTime")}>
                <input
                  id="s-start"
                  type="time"
                  value={session.startTime}
                  onChange={(e) => update({ startTime: e.target.value })}
                />
              </Field>
              <Field label="End" htmlFor="s-end" error={errFor("endTime")}>
                <input
                  id="s-end"
                  type="time"
                  value={session.endTime}
                  onChange={(e) => update({ endTime: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Activity type">
              <Segmented<ActivityType>
                ariaLabel="Activity type"
                value={session.activityType}
                options={[
                  { value: "training", label: "Training" },
                  { value: "certification", label: "Certification" },
                  { value: "remedial", label: "Remedial" },
                  { value: "other", label: "Other" }
                ]}
                onChange={(v) => update({ activityType: v })}
              />
            </Field>
            {session.activityType !== "training" && (
              <Field label="Case / reference #" htmlFor="s-case">
                <input
                  id="s-case"
                  type="text"
                  value={session.caseNumber}
                  onChange={(e) => update({ caseNumber: e.target.value })}
                />
              </Field>
            )}
            <Field label="Environment">
              <Segmented<Environment>
                ariaLabel="Environment"
                value={session.environment}
                options={[
                  { value: "indoor", label: "Indoor" },
                  { value: "outdoor", label: "Outdoor" },
                  { value: "mixed", label: "Mixed" }
                ]}
                onChange={(v) => update({ environment: v })}
              />
            </Field>
            <Field label="Address / area" htmlFor="s-addr">
              <input
                id="s-addr"
                type="text"
                value={session.locationAddress}
                onChange={(e) => update({ locationAddress: e.target.value })}
              />
            </Field>
            <GpsField session={session} update={update} />
          </Collapse>

          <Collapse title="👤 People & objective" defaultOpen={showAdvanced}>
            <div className="row">
              <Field label="Handler" htmlFor="s-handler" error={errFor("handlerName")}>
                <input
                  id="s-handler"
                  type="text"
                  value={session.handlerName}
                  onChange={(e) => update({ handlerName: e.target.value })}
                />
              </Field>
              <Field label="K9" htmlFor="s-k9" error={errFor("k9Name")}>
                <input
                  id="s-k9"
                  type="text"
                  value={session.k9Name}
                  onChange={(e) => update({ k9Name: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Trainer / evaluator / hide placer" htmlFor="s-trainer">
              <input
                id="s-trainer"
                type="text"
                value={session.trainerName}
                onChange={(e) => update({ trainerName: e.target.value })}
              />
            </Field>
            <Field label="Other personnel or agencies" htmlFor="s-personnel">
              <input
                id="s-personnel"
                type="text"
                value={session.otherPersonnel}
                onChange={(e) => update({ otherPersonnel: e.target.value })}
              />
            </Field>
            <Field label="Training objective" htmlFor="s-objective">
              <textarea
                id="s-objective"
                value={session.objective}
                onChange={(e) => update({ objective: e.target.value })}
              />
            </Field>
          </Collapse>

          <Collapse title="⭐ Assessment & follow-up" defaultOpen={showAdvanced}>
            <RatingBar
              label="Overall performance"
              value={session.overallAssessment}
              onChange={(v) =>
                update({ overallAssessment: v as TrainingSession["overallAssessment"] })
              }
            />
            <Field
              label="Follow-up training needed"
              htmlFor="s-followup"
              hint="Becomes a checklist item when you finish the record."
            >
              <textarea
                id="s-followup"
                value={session.correctiveFollowUp}
                onChange={(e) => update({ correctiveFollowUp: e.target.value })}
              />
            </Field>
            <Field label="Next training focus" htmlFor="s-next">
              <input
                id="s-next"
                type="text"
                value={session.nextFocus}
                onChange={(e) => update({ nextFocus: e.target.value })}
              />
            </Field>
          </Collapse>

          <Collapse title="🌤 Conditions" defaultOpen={showAdvanced}>
            <EnvEditor session={session} update={update} />
          </Collapse>

          <Collapse title="🐕 K9 welfare" defaultOpen={showAdvanced}>
            <ToggleRow
              label="Record welfare for this session"
              sub="Only conditions that may affect performance"
              checked={session.welfare !== null}
              onChange={(v) => update({ welfare: v ? emptyWelfare() : null })}
            />
            {session.welfare && <WelfareEditor session={session} update={update} />}
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
        message="The draft and its exercises will be permanently removed. Finalized records are never deleted this way."
        confirmLabel="Delete draft"
        danger
      />
      <ConfirmSheet
        open={deleteExId !== null}
        onClose={() => setDeleteExId(null)}
        onConfirm={async () => {
          if (deleteExId) await deleteExercise(deleteExId);
          toast("Exercise removed");
        }}
        title="Remove this exercise?"
        message="The exercise and its hides will be removed from this draft."
        confirmLabel="Remove"
        danger
      />
      <Sheet open={reasonSheet} onClose={() => setReasonSheet(false)} title="Reason for correction">
        <Field
          label="Why is this record being corrected?"
          htmlFor="corr-reason"
          hint="Stored permanently with the original values."
        >
          <textarea
            id="corr-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Transposed find/miss counts for exercise 2"
          />
        </Field>
        <button type="button" className="btn block" disabled={!reason.trim()} onClick={saveCorrection}>
          Save correction
        </button>
      </Sheet>
    </>
  );
}

function GpsField({
  session,
  update
}: {
  session: TrainingSession;
  update: (p: Partial<TrainingSession>) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const capture = () => {
    if (!("geolocation" in navigator)) {
      toast("GPS is not available on this device");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update({
          gps: {
            lat: Number(pos.coords.latitude.toFixed(6)),
            lon: Number(pos.coords.longitude.toFixed(6)),
            accuracyM: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null,
            capturedAt: new Date().toISOString()
          }
        });
        setBusy(false);
      },
      (err) => {
        toast(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied"
            : "Could not get a GPS fix"
        );
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };
  return (
    <div className="field">
      <label>GPS coordinates</label>
      {session.gps ? (
        <div className="toggle-row">
          <div>
            <div className="label">
              {session.gps.lat}, {session.gps.lon}
            </div>
            <div className="sub">
              {session.gps.accuracyM ? `±${session.gps.accuracyM} m` : "captured"}
            </div>
          </div>
          <button type="button" className="btn small secondary" onClick={() => update({ gps: null })}>
            Remove
          </button>
        </div>
      ) : (
        <button type="button" className="btn secondary block" disabled={busy} onClick={capture}>
          {busy ? "Getting GPS fix…" : "📍 Capture GPS position"}
        </button>
      )}
    </div>
  );
}

function EnvEditor({
  session,
  update
}: {
  session: TrainingSession;
  update: (p: Partial<TrainingSession>) => void;
}) {
  const env = session.env;
  const setEnv = (patch: Partial<TrainingSession["env"]>) =>
    update({ env: { ...env, ...patch } });
  return (
    <>
      <div className="row">
        <Field label="Temp (°F)" htmlFor="env-temp">
          <NumInput
            id="env-temp"
            value={env.temperatureF}
            min={-40}
            max={140}
            onChange={(v) => setEnv({ temperatureF: v })}
          />
        </Field>
        <Field label="Weather" htmlFor="env-weather">
          <input
            id="env-weather"
            type="text"
            value={env.weather}
            placeholder="Sunny, rain…"
            onChange={(e) => setEnv({ weather: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Wind / airflow" htmlFor="env-wind">
        <input
          id="env-wind"
          type="text"
          value={env.wind}
          placeholder="5-10 mph W, HVAC on…"
          onChange={(e) => setEnv({ wind: e.target.value })}
        />
      </Field>
      <Field label="Distractions / other odors" htmlFor="env-distract">
        <input
          id="env-distract"
          type="text"
          value={env.distractorOdors}
          onChange={(e) => setEnv({ distractorOdors: e.target.value })}
        />
      </Field>
      <Field label="Condition notes" htmlFor="env-notes">
        <textarea
          id="env-notes"
          value={env.notes}
          onChange={(e) => setEnv({ notes: e.target.value })}
        />
      </Field>
      <Collapse title="More conditions">
        <div className="row">
          <Field label="Lighting" htmlFor="env-light">
            <input
              id="env-light"
              type="text"
              value={env.lighting}
              onChange={(e) => setEnv({ lighting: e.target.value })}
            />
          </Field>
          <Field label="Surface" htmlFor="env-surface">
            <input
              id="env-surface"
              type="text"
              value={env.surface}
              onChange={(e) => setEnv({ surface: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Area size" htmlFor="env-size">
          <input
            id="env-size"
            type="text"
            value={env.areaSize}
            onChange={(e) => setEnv({ areaSize: e.target.value })}
          />
        </Field>
        <Field label="People present" htmlFor="env-people">
          <input
            id="env-people"
            type="text"
            value={env.peoplePresent}
            onChange={(e) => setEnv({ peoplePresent: e.target.value })}
          />
        </Field>
        <RatingBar
          label="Clutter level"
          value={env.clutterLevel}
          onChange={(v) => setEnv({ clutterLevel: v as 0 })}
        />
      </Collapse>
    </>
  );
}

function WelfareEditor({
  session,
  update
}: {
  session: TrainingSession;
  update: (p: Partial<TrainingSession>) => void;
}) {
  const w = session.welfare!;
  const setW = (patch: Partial<NonNullable<TrainingSession["welfare"]>>) =>
    update({ welfare: { ...w, ...patch } });
  return (
    <>
      <RatingBar
        label="Energy / motivation"
        value={w.energyMotivation}
        onChange={(v) => setW({ energyMotivation: v as 0 })}
      />
      <Field label="Injury / illness / medication" htmlFor="w-health">
        <input
          id="w-health"
          type="text"
          value={w.healthConcerns}
          onChange={(e) => setW({ healthConcerns: e.target.value })}
        />
      </Field>
      <ToggleRow
        label="Heat or safety concern"
        checked={w.heatSafetyConcern}
        onChange={(v) => setW({ heatSafetyConcern: v })}
      />
      <Field label="Welfare notes" htmlFor="w-notes">
        <textarea
          id="w-notes"
          value={w.notes}
          onChange={(e) => setW({ notes: e.target.value })}
        />
      </Field>
    </>
  );
}
