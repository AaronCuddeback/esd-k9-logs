/**
 * Session draft editor. Autosaves continuously while status = draft.
 * For finalized records opened in correction mode (?correct=1), edits are
 * held locally and saved through recordCorrection() with a required reason.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { db, useAutosave, useLiveQuery, useSettings } from "../hooks";
import { TopBar, OfflineBanner } from "../components/shell";
import {
  ChipSelect,
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
import type { ActivityType, Environment, TrainingSession } from "../db/types";
import { emptyWelfare, newExercise } from "../db/factories";
import {
  deleteDraftSession,
  deleteExercise,
  recordCorrection,
  saveSessionDraft,
  touchLocation
} from "../db/repo";
import { AttachmentsCard } from "../components/AttachmentsCard";
import { tallyHides } from "../lib/stats";
import { validateSession } from "../lib/validation";
import { BLINDNESS_LABELS, fmtSeconds } from "../lib/format";

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
  const [showEnv, setShowEnv] = useState(false);
  const [showWelfare, setShowWelfare] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reasonSheet, setReasonSheet] = useState(false);
  const [reason, setReason] = useState("");
  const [deleteExId, setDeleteExId] = useState<string | null>(null);

  useEffect(() => {
    if (stored && !session) setSession(stored);
  }, [stored, session]);

  // Finalized records are read-only here — send to the detail view.
  useEffect(() => {
    if (stored && stored.status !== "draft" && !correcting) {
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

  const issues = session ? validateSession(session) : [];
  const errFor = (f: string) => issues.find((i) => i.field === f && i.severity === "error")?.message;

  if (!stored || !session || !exercises || !hides) {
    return (
      <>
        <TopBar title="Training Session" back="/" />
        <main className="shell-main">
          {stored === undefined ? <p>Loading…</p> : stored === null || !session ? (
            <div className="empty">
              <div className="big" aria-hidden="true">🔍</div>
              <h3>Record not found</h3>
            </div>
          ) : null}
        </main>
      </>
    );
  }

  if (!isDraft && !correcting) return null;

  const typeLabel = (tid: string) => searchTypes?.find((t) => t.id === tid)?.label ?? tid;

  const addExercise = async () => {
    await flushNow(session);
    const ex = newExercise(session.id, (exercises[exercises.length - 1]?.order ?? 0) + 1);
    await db.exercises.put(ex);
    navigate(`/session/${session.id}/exercise/${ex.id}${correcting ? "?correct=1" : ""}`);
  };

  const saveCorrection = async () => {
    try {
      await recordCorrection(session, settings.handlerName || "Handler", reason);
      toast("Correction saved with audit entry");
      setReasonSheet(false);
      navigate(`/record/${session.id}`, { replace: true });
    } catch (e) {
      toast((e as Error).message);
    }
  };

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
              Correcting a finalized record. Original values will be preserved in the
              revision history, and a reason is required when you save.
            </span>
          </div>
        )}

        <div className="card">
          <h3>
            Session basics <StatusBadge status={stored.status} />
          </h3>
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
            <Field label="Start time" htmlFor="s-start" error={errFor("startTime")}>
              <input
                id="s-start"
                type="time"
                value={session.startTime}
                onChange={(e) => update({ startTime: e.target.value })}
              />
            </Field>
            <Field label="End time" htmlFor="s-end" error={errFor("endTime")}>
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
                { value: "deployment_training", label: "Deployment" },
                { value: "remedial", label: "Remedial" },
                { value: "other", label: "Other" }
              ]}
              onChange={(v) => update({ activityType: v })}
            />
          </Field>
          {session.activityType !== "training" && (
            <Field
              label="Case / reference # (optional)"
              htmlFor="s-case"
              hint="Ties this record to a case, incident, or certification event."
            >
              <input
                id="s-case"
                type="text"
                value={session.caseNumber}
                onChange={(e) => update({ caseNumber: e.target.value })}
              />
            </Field>
          )}
          {(session.activityType === "other" ||
            session.activityType === "demonstration" ||
            session.activityType === "deployment_training") && (
            <Field label="Describe activity" htmlFor="s-actother">
              <input
                id="s-actother"
                type="text"
                value={session.activityOther}
                onChange={(e) => update({ activityOther: e.target.value })}
              />
            </Field>
          )}
          <Field label="Location name" htmlFor="s-loc" error={errFor("locationName")}>
            <input
              id="s-loc"
              type="text"
              value={session.locationName}
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
          <Field label="Address / area (optional)" htmlFor="s-addr">
            <input
              id="s-addr"
              type="text"
              value={session.locationAddress}
              onChange={(e) => update({ locationAddress: e.target.value })}
            />
          </Field>
          <GpsField session={session} update={update} />
        </div>

        <div className="card">
          <h3>Team &amp; setting</h3>
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
          <Field
            label="Trainer / evaluator / hide placer (optional)"
            htmlFor="s-trainer"
          >
            <input
              id="s-trainer"
              type="text"
              value={session.trainerName}
              onChange={(e) => update({ trainerName: e.target.value })}
            />
          </Field>
          <Field label="Other personnel or agencies (optional)" htmlFor="s-personnel">
            <input
              id="s-personnel"
              type="text"
              value={session.otherPersonnel}
              onChange={(e) => update({ otherPersonnel: e.target.value })}
            />
          </Field>
          <Field
            label="Training objective"
            htmlFor="s-objective"
            hint="What is this session meant to work on?"
          >
            <textarea
              id="s-objective"
              value={session.objective}
              onChange={(e) => update({ objective: e.target.value })}
            />
          </Field>
        </div>

        <div className="card">
          <h3>Exercises ({exercises.length})</h3>
          {exercises.length === 0 && (
            <p style={{ color: "var(--text-2)" }}>
              Add each search problem as its own exercise — room search, vehicle line,
              box drill, blank room, and so on.
            </p>
          )}
          {exercises.map((ex) => {
            const t = tallyHides(hides.filter((h) => h.exerciseId === ex.id));
            return (
              <div key={ex.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Link
                  className="list-item"
                  style={{ flex: 1 }}
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
                          ? "Correctly cleared"
                          : ex.blankCorrect === false
                            ? "False response"
                            : "Result not recorded"
                        : `${t.hidesPlaced} hides · ${t.confirmedFinds} finds · ${t.misses} missed${ex.falseResponses.length ? ` · ${ex.falseResponses.length} false` : ""}`}
                      {" · "}
                      {BLINDNESS_LABELS[ex.blindness]}
                      {ex.searchTimeSeconds ? ` · ${fmtSeconds(ex.searchTimeSeconds)}` : ""}
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
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
          <button type="button" className="btn secondary block" onClick={addExercise}>
            ＋ Add exercise
          </button>
        </div>

        <div className="card">
          <h3>Wrap-up</h3>
          <Field label="Session summary" htmlFor="s-summary" hint="Use the keyboard microphone for speech-to-text.">
            <textarea
              id="s-summary"
              value={session.summary}
              onChange={(e) => update({ summary: e.target.value })}
            />
          </Field>
          <RatingBar
            label="Overall performance (1 poor – 5 excellent)"
            value={session.overallAssessment}
            onChange={(v) => update({ overallAssessment: v as TrainingSession["overallAssessment"] })}
          />
          <Field label="Corrective action / follow-up training needed" htmlFor="s-followup">
            <textarea
              id="s-followup"
              value={session.correctiveFollowUp}
              onChange={(e) => update({ correctiveFollowUp: e.target.value })}
            />
          </Field>
          <Field label="Next recommended training focus" htmlFor="s-next">
            <input
              id="s-next"
              type="text"
              value={session.nextFocus}
              onChange={(e) => update({ nextFocus: e.target.value })}
            />
          </Field>
        </div>

        <AttachmentsCard sessionId={session.id} readOnly={!editable} />

        <div className="card flat">
          <ToggleRow
            label="Environmental conditions"
            sub="Temperature, wind, distractions… (optional)"
            checked={showEnv}
            onChange={setShowEnv}
          />
          {showEnv && <EnvEditor session={session} update={update} />}
          <ToggleRow
            label="K9 welfare & readiness"
            sub="Only conditions that may affect performance (optional)"
            checked={showWelfare || session.welfare !== null}
            onChange={(v) => {
              setShowWelfare(v);
              if (!v) update({ welfare: null });
              else if (!session.welfare) update({ welfare: emptyWelfare() });
            }}
          />
          {(showWelfare || session.welfare) && session.welfare && (
            <WelfareEditor session={session} update={update} />
          )}
        </div>

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
              Review &amp; finalize
            </button>
            <button
              type="button"
              className="btn ghost block"
              style={{ marginTop: 8 }}
              onClick={async () => {
                await flushNow(session);
                toast("Draft saved");
                navigate("/");
              }}
            >
              Save draft &amp; close
            </button>
            <button
              type="button"
              className="btn warn-outline block"
              style={{ marginTop: 8 }}
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
        message="The draft session, its exercises, and hides will be permanently removed. Finalized records are never deleted this way."
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
          hint="Stored permanently in the revision history with the original values."
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
            ? "Location permission denied — enable it in browser settings"
            : "Could not get a GPS fix"
        );
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };
  return (
    <div className="field">
      <label>GPS coordinates (optional)</label>
      {session.gps ? (
        <div className="toggle-row">
          <div>
            <div className="label">
              {session.gps.lat}, {session.gps.lon}
            </div>
            <div className="sub">
              {session.gps.accuracyM ? `±${session.gps.accuracyM} m · ` : ""}
              captured {new Date(session.gps.capturedAt).toLocaleTimeString()}
            </div>
          </div>
          <button type="button" className="btn small secondary" onClick={() => update({ gps: null })}>
            Remove
          </button>
        </div>
      ) : (
        <button type="button" className="btn secondary block" disabled={busy} onClick={capture}>
          {busy ? "Getting GPS fix…" : "📍 Capture current GPS position"}
        </button>
      )}
      <div className="hint">
        Stored only in this record; useful for the training-site history and reports.
      </div>
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
    <div style={{ paddingTop: 6 }}>
      <div className="row">
        <Field label="Temp (°F)" htmlFor="env-temp">
          <NumInput id="env-temp" value={env.temperatureF} min={-40} max={140} onChange={(v) => setEnv({ temperatureF: v })} />
        </Field>
        <Field label="Weather" htmlFor="env-weather">
          <input id="env-weather" type="text" value={env.weather} placeholder="Sunny, rain…" onChange={(e) => setEnv({ weather: e.target.value })} />
        </Field>
      </div>
      <div className="row">
        <Field label="Wind" htmlFor="env-wind">
          <input id="env-wind" type="text" value={env.wind} placeholder="5-10 mph W" onChange={(e) => setEnv({ wind: e.target.value })} />
        </Field>
        <Field label="Airflow / HVAC" htmlFor="env-airflow">
          <input id="env-airflow" type="text" value={env.airflow} placeholder="HVAC on…" onChange={(e) => setEnv({ airflow: e.target.value })} />
        </Field>
      </div>
      <div className="row">
        <Field label="Lighting" htmlFor="env-light">
          <input id="env-light" type="text" value={env.lighting} onChange={(e) => setEnv({ lighting: e.target.value })} />
        </Field>
        <Field label="Surface / terrain" htmlFor="env-surface">
          <input id="env-surface" type="text" value={env.surface} onChange={(e) => setEnv({ surface: e.target.value })} />
        </Field>
      </div>
      <Field label="Noise & distractions" htmlFor="env-noise">
        <input id="env-noise" type="text" value={env.noiseDistractions} onChange={(e) => setEnv({ noiseDistractions: e.target.value })} />
      </Field>
      <Field label="Search area size" htmlFor="env-size">
        <input id="env-size" type="text" value={env.areaSize} placeholder="3 rooms / 100x40 yd…" onChange={(e) => setEnv({ areaSize: e.target.value })} />
      </Field>
      <RatingBar label="Clutter level" value={env.clutterLevel} onChange={(v) => setEnv({ clutterLevel: v as 0 })} />
      <RatingBar label="Accessibility difficulty" value={env.accessibilityDifficulty} onChange={(v) => setEnv({ accessibilityDifficulty: v as 0 })} />
      <Field label="People present" htmlFor="env-people">
        <input id="env-people" type="text" value={env.peoplePresent} placeholder="2 observers…" onChange={(e) => setEnv({ peoplePresent: e.target.value })} />
      </Field>
      <div className="row">
        <Field label="Other animals" htmlFor="env-animals">
          <input id="env-animals" type="text" value={env.animalsPresent} onChange={(e) => setEnv({ animalsPresent: e.target.value })} />
        </Field>
        <Field label="Distractor odors / objects" htmlFor="env-distract">
          <input id="env-distract" type="text" value={env.distractorOdors} onChange={(e) => setEnv({ distractorOdors: e.target.value })} />
        </Field>
      </div>
      <Field label="Familiar location?">
        <Segmented
          ariaLabel="Familiar location"
          value={env.familiarLocation === null ? "unset" : env.familiarLocation ? "yes" : "no"}
          options={[
            { value: "unset", label: "—" },
            { value: "yes", label: "Familiar" },
            { value: "no", label: "Unfamiliar" }
          ]}
          onChange={(v) => setEnv({ familiarLocation: v === "unset" ? null : v === "yes" })}
        />
      </Field>
      <Field label="Environmental notes" htmlFor="env-notes">
        <textarea id="env-notes" value={env.notes} onChange={(e) => setEnv({ notes: e.target.value })} />
      </Field>
    </div>
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
    <div style={{ paddingTop: 6 }}>
      <Field label="Condition before training" htmlFor="w-cond">
        <input id="w-cond" type="text" value={w.conditionBefore} placeholder="Normal, rested…" onChange={(e) => setW({ conditionBefore: e.target.value })} />
      </Field>
      <RatingBar label="Energy / motivation" value={w.energyMotivation} onChange={(v) => setW({ energyMotivation: v as 0 })} />
      <div className="row">
        <Field label="Recent feeding" htmlFor="w-feed">
          <input id="w-feed" type="text" value={w.recentFeeding} placeholder="Fed via training only" onChange={(e) => setW({ recentFeeding: e.target.value })} />
        </Field>
        <Field label="Hydration" htmlFor="w-hyd">
          <input id="w-hyd" type="text" value={w.hydration} onChange={(e) => setW({ hydration: e.target.value })} />
        </Field>
      </div>
      <Field label="Injury / illness / medication" htmlFor="w-health">
        <input id="w-health" type="text" value={w.healthConcerns} onChange={(e) => setW({ healthConcerns: e.target.value })} />
      </Field>
      <ToggleRow
        label="Heat or environmental safety concern"
        checked={w.heatSafetyConcern}
        onChange={(v) => setW({ heatSafetyConcern: v })}
      />
      <Field label="Rest breaks" htmlFor="w-rest">
        <input id="w-rest" type="text" value={w.restBreaks} placeholder="10 min between exercises" onChange={(e) => setW({ restBreaks: e.target.value })} />
      </Field>
      <Field label="Welfare notes" htmlFor="w-notes">
        <textarea id="w-notes" value={w.notes} onChange={(e) => setW({ notes: e.target.value })} />
      </Field>
    </div>
  );
}
