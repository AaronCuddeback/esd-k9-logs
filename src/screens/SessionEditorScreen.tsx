/**
 * Training session editor — one page, in the order a handler works:
 *
 *   Where (location, area searched, indoor/outdoor) → exercises with their
 *   hides inline (device + found/missed) → time, type & case # → finish.
 *
 * Nothing routine is behind a dropdown or a second screen. Rarely used
 * detail (people, objective, conditions, welfare, GPS, ratings, per-hide
 * placement) is still one tap away under "More details" or an exercise's
 * "Details" link, and every field still lands in the same record — so
 * exports and court reports are exactly as before.
 *
 * Autosaves continuously while status = draft. For finalized records opened
 * in correction mode (?correct=1) session edits are held locally and saved
 * through recordCorrection() with a required reason; exercise and hide
 * corrections go through their own editors, which audit them.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { db, useAutosave, useLiveQuery, useSettings } from "../hooks";
import { TopBar, OfflineBanner } from "../components/shell";
import {
  Collapse,
  ConfirmSheet,
  DeviceButton,
  Field,
  NumInput,
  RatingBar,
  Segmented,
  Sheet,
  StatusBadge,
  TimeAndDuration,
  ToggleRow,
  useToast
} from "../components/ui";
import { AttachmentsCard } from "../components/AttachmentsCard";
import type {
  ActivityType,
  Environment,
  Exercise,
  Hide,
  HideOutcome,
  SearchTypeDef,
  TrainingSession
} from "../db/types";
import { emptyWelfare, newExercise, newHide } from "../db/factories";
import {
  deleteDraftSession,
  deleteExercise,
  deleteHide,
  recordCorrection,
  saveExercise,
  saveHide,
  saveSessionDraft,
  searchTypeForEnvironment,
  touchLocation
} from "../db/repo";
import { tallyHides } from "../lib/stats";
import { validateSession } from "../lib/validation";
import {
  daySlot,
  DEVICE_CHOICES,
  DEVICE_ICONS,
  DEVICE_SHORT,
  fmtDate,
  OUTCOME_LABELS,
  SLOT_LABELS
} from "../lib/format";

/** Search types shown as one-tap chips; the rest are under "More". */
const QUICK_TYPES: { id: string; label: string }[] = [
  { id: "room", label: "🏠 Indoor" },
  { id: "outdoor", label: "🌳 Outdoor" },
  { id: "vehicle", label: "🚗 Vehicle" },
  { id: "boxes", label: "📦 Boxes" }
];

const OUTDOOR_TYPES = new Set(["outdoor", "water"]);
const NEUTRAL_TYPES = new Set(["vehicle"]);

/** Session environment implied by its exercises' search types, or null if undecided. */
function environmentFromExercises(exs: Exercise[]): Environment | null {
  const kinds = new Set(
    exs
      .filter((e) => !NEUTRAL_TYPES.has(e.searchTypeId))
      .map((e) => (OUTDOOR_TYPES.has(e.searchTypeId) ? "outdoor" : "indoor"))
  );
  if (kinds.size === 0) return null;
  return kinds.size > 1 ? "mixed" : (kinds.values().next().value as Environment);
}

export default function SessionEditorScreen() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const correcting = params.get("correct") === "1";
  const suffix = correcting ? "?correct=1" : "";
  const navigate = useNavigate();
  const settings = useSettings();
  const toast = useToast();

  const stored = useLiveQuery(() => db.sessions.get(id!), [id]);
  const exercises = useLiveQuery(
    () => db.exercises.where("sessionId").equals(id!).sortBy("order"),
    [id]
  );
  const hides = useLiveQuery(() => db.hides.where("sessionId").equals(id!).toArray(), [id]);
  const searchTypes = useLiveQuery(
    async () => (await db.searchTypes.toArray()).filter((t) => !t.archived),
    []
  );
  const locations = useLiveQuery(async () => {
    const all = await db.locations.toArray();
    return all
      .sort(
        (a, b) =>
          Number(b.favorite) - Number(a.favorite) ||
          b.useCount - a.useCount ||
          b.lastUsedAt.localeCompare(a.lastUsedAt)
      )
      .slice(0, 5);
  }, []);

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
      navigate(`/deployment/${stored.id}${suffix}`, { replace: true });
    } else if (stored.status !== "draft" && !correcting) {
      navigate(`/record/${stored.id}`, { replace: true });
    }
  }, [stored, correcting, suffix, navigate]);

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
        <TopBar title="Training" back="/" />
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

  const selectLocation = async (name: string, address: string) => {
    if (!isDraft) {
      update({ locationName: name, locationAddress: address });
      return;
    }
    const locId = await touchLocation(name, address);
    update({ locationName: name, locationAddress: address, locationId: locId });
  };

  const setEnvironment = async (env: Environment) => {
    update({ environment: env });
    // keep indoor/outdoor exercises in step so it is only chosen once
    if (isDraft && env !== "mixed") {
      const want = searchTypeForEnvironment(env);
      for (const ex of exercises) {
        if ((ex.searchTypeId === "room" || ex.searchTypeId === "outdoor") && ex.searchTypeId !== want) {
          await saveExercise({ ...ex, searchTypeId: want });
        }
      }
    }
  };

  const setExerciseType = async (ex: Exercise, typeId: string) => {
    const nextEx: Exercise = {
      ...ex,
      searchTypeId: typeId,
      isBlankSearch: typeId === "blank" ? true : ex.isBlankSearch
    };
    await saveExercise(nextEx);
    const env = environmentFromExercises(exercises.map((e) => (e.id === ex.id ? nextEx : e)));
    if (env && env !== session.environment) update({ environment: env });
  };

  const addExercise = async () => {
    await flushNow(session);
    const prev = exercises[exercises.length - 1];
    const ex = newExercise(session.id, (prev?.order ?? 0) + 1);
    // reuse the previous exercise's setup — most sessions repeat the pattern
    ex.searchTypeId = prev?.searchTypeId ?? searchTypeForEnvironment(session.environment);
    if (prev) {
      ex.blindness = prev.blindness;
      ex.roomTypes = [...prev.roomTypes];
    }
    await saveExercise(ex);
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

  const slot = daySlot(session.startTime);
  const showAdvanced = settings.showAdvancedFields;
  const allHides = hides.filter((h) => !exercises.find((e) => e.id === h.exerciseId)?.isBlankSearch);
  const totals = tallyHides(allHides);
  const unmarked = allHides.filter((h) => !h.outcome).length;

  return (
    <>
      <TopBar
        title={correcting ? "Correct Record" : `${SLOT_LABELS[slot]} Training`}
        back={correcting ? `/record/${session.id}` : "/"}
        actions={
          <span className="save-state" aria-live="polite">
            {isDraft ? (saving ? "Saving…" : "✓ Saved") : ""}
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
              history and a reason is required. Use an exercise's Details to correct hides.
            </span>
          </div>
        )}

        {/* --- 1. where --- */}
        <div className="card step-card">
          <div className="step-head">
            <span className="step-num">1</span>
            <h3>Where</h3>
            <span className="grow" />
            <StatusBadge status={stored.status} />
          </div>
          {locations && locations.length > 0 && (
            <div className="chips loc-chips" role="group" aria-label="Saved locations">
              {locations.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="chip"
                  aria-pressed={session.locationName.trim().toLowerCase() === l.name.toLowerCase()}
                  onClick={() => selectLocation(l.name, l.address)}
                >
                  {l.favorite ? "⭐ " : "📍 "}
                  {l.name}
                </button>
              ))}
            </div>
          )}
          <Field label="Location" htmlFor="s-loc" error={errFor("locationName")}>
            <input
              id="s-loc"
              type="text"
              value={session.locationName}
              placeholder="Tap a saved location or type a new one"
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
          <Field label="Area searched" htmlFor="s-area">
            <input
              id="s-area"
              type="text"
              value={session.areaSearched ?? ""}
              placeholder="e.g., Living room, kitchen and garage"
              onChange={(e) => update({ areaSearched: e.target.value })}
            />
          </Field>
          <Field label="Environment">
            <Segmented<Environment>
              ariaLabel="Environment"
              value={session.environment}
              options={[
                { value: "indoor", label: "🏠 Indoor" },
                { value: "outdoor", label: "🌳 Outdoor" },
                { value: "mixed", label: "Mixed" }
              ]}
              onChange={setEnvironment}
            />
          </Field>
        </div>

        {/* --- 2. exercises & hides --- */}
        <div className="step-head outside">
          <span className="step-num">2</span>
          <h3>Exercises</h3>
          <span className="grow" />
          {allHides.length > 0 && (
            <span className="tally">
              {totals.confirmedFinds}/{totals.hidesPlaced} found
              {totals.misses ? ` · ${totals.misses} missed` : ""}
            </span>
          )}
        </div>
        {exercises.map((ex) => (
          <ExerciseCard
            key={ex.id}
            ex={ex}
            hides={hides
              .filter((h) => h.exerciseId === ex.id)
              .sort((a, b) => a.number - b.number)}
            session={session}
            searchTypes={searchTypes ?? []}
            inlineEditable={isDraft}
            detailsPath={`/session/${session.id}/exercise/${ex.id}${suffix}`}
            hidePath={(hid) => `/session/${session.id}/exercise/${ex.id}/hide/${hid}${suffix}`}
            onSetType={(t) => setExerciseType(ex, t)}
            onDelete={exercises.length > 0 && isDraft ? () => setDeleteExId(ex.id) : undefined}
          />
        ))}
        {exercises.length === 0 && (
          <p className="muted-note">
            Add each search you ran — a room, a vehicle line, a box drill.
          </p>
        )}
        {isDraft && (
          <button type="button" className="btn secondary block add-ex" onClick={addExercise}>
            ＋ Add {exercises.length ? "another " : ""}exercise
          </button>
        )}

        {/* --- 3. time, type & case --- */}
        <div className="card step-card">
          <div className="step-head">
            <span className="step-num">3</span>
            <h3>Time &amp; record</h3>
          </div>
          <Field label="Date" htmlFor="s-date" error={errFor("date")}>
            <input
              id="s-date"
              type="date"
              value={session.date}
              onChange={(e) => update({ date: e.target.value })}
            />
          </Field>
          <TimeAndDuration
            idPrefix="s"
            startTime={session.startTime}
            endTime={session.endTime}
            startError={errFor("startTime")}
            endError={errFor("endTime")}
            onChange={(p) => update(p)}
          />
          <Field label="Activity type">
            <Segmented<ActivityType>
              ariaLabel="Activity type"
              value={session.activityType}
              options={[
                { value: "training", label: "Training" },
                { value: "certification", label: "Cert" },
                { value: "remedial", label: "Remedial" },
                { value: "other", label: "Other" }
              ]}
              onChange={(v) => update({ activityType: v })}
            />
          </Field>
          <Field label="Case / reference #" htmlFor="s-case">
            <input
              id="s-case"
              type="text"
              value={session.caseNumber}
              placeholder="e.g., 26-05965"
              onChange={(e) => update({ caseNumber: e.target.value })}
            />
          </Field>
          <Field
            label="Notes"
            htmlFor="s-summary"
            hint="Optional. Use the keyboard microphone to dictate."
          >
            <textarea
              id="s-summary"
              value={session.summary}
              onChange={(e) => update({ summary: e.target.value })}
            />
          </Field>
        </div>

        {/* --- everything optional, collapsed by default --- */}
        <div className="card flat more-card">
          <div className="more-title">More details (optional)</div>
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

          <Collapse title="🌤 Conditions & address" defaultOpen={showAdvanced}>
            <Field label="Address" htmlFor="s-addr">
              <input
                id="s-addr"
                type="text"
                value={session.locationAddress}
                onChange={(e) => update({ locationAddress: e.target.value })}
              />
            </Field>
            <GpsField session={session} update={update} />
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
          <div className="finish-bar">
            {unmarked > 0 && (
              <div className="finish-hint">
                {unmarked} hide{unmarked === 1 ? "" : "s"} not marked found or missed yet
              </div>
            )}
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
            <div className="row" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="btn ghost"
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
                className="btn ghost danger-text"
                onClick={() => setConfirmDelete(true)}
              >
                Delete draft
              </button>
            </div>
          </div>
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
            placeholder="e.g., Wrong end time entered"
          />
        </Field>
        <button type="button" className="btn block" disabled={!reason.trim()} onClick={saveCorrection}>
          Save correction
        </button>
      </Sheet>
    </>
  );
}

// ---------- one exercise, hides inline ----------

function ExerciseCard({
  ex,
  hides,
  session,
  searchTypes,
  inlineEditable,
  detailsPath,
  hidePath,
  onSetType,
  onDelete
}: {
  ex: Exercise;
  hides: Hide[];
  session: TrainingSession;
  searchTypes: SearchTypeDef[];
  inlineEditable: boolean;
  detailsPath: string;
  hidePath: (hideId: string) => string;
  onSetType: (typeId: string) => void;
  onDelete?: () => void;
}) {
  const toast = useToast();
  const [typeSheet, setTypeSheet] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Hide | null>(null);
  const typeLabel = searchTypes.find((t) => t.id === ex.searchTypeId)?.label ?? ex.searchTypeId;
  const isQuick = QUICK_TYPES.some((q) => q.id === ex.searchTypeId);
  const t = tallyHides(hides);

  const addHide = async () => {
    const h = newHide(ex.id, ex.sessionId, (hides[hides.length - 1]?.number ?? 0) + 1);
    h.placedBy = session.trainerName || session.handlerName;
    h.handlerKnewLocation = ex.blindness === "known";
    // repeat the previous hide's device — most drills use the same aid
    if (hides.length > 0) h.deviceType = hides[hides.length - 1].deviceType;
    await saveHide(h);
  };

  const removeLast = async () => {
    const last = hides[hides.length - 1];
    if (!last) return;
    if (last.outcome || last.locationDescription.trim() || last.notes.trim()) {
      setConfirmRemove(last);
      return;
    }
    await deleteHide(last.id);
  };

  const setOutcome = (h: Hide, o: HideOutcome) =>
    saveHide({ ...h, outcome: h.outcome === o ? "" : o });

  return (
    <div className="card ex-card">
      <div className="ex-head">
        <strong>Exercise {ex.order}</strong>
        {!ex.isBlankSearch && hides.length > 0 && (
          <span className="tally small">
            {t.confirmedFinds}/{t.hidesPlaced}
          </span>
        )}
        <span className="grow" />
        <Link to={detailsPath} className="btn small ghost" style={{ textDecoration: "none" }}>
          Details
        </Link>
        {onDelete && (
          <button
            type="button"
            className="icon-btn small"
            aria-label={`Delete exercise ${ex.order}`}
            onClick={onDelete}
          >
            ✕
          </button>
        )}
      </div>

      <div className="chips type-chips" role="group" aria-label="Search type">
        {QUICK_TYPES.map((q) => (
          <button
            key={q.id}
            type="button"
            className="chip"
            disabled={!inlineEditable}
            aria-pressed={ex.searchTypeId === q.id}
            onClick={() => onSetType(q.id)}
          >
            {q.label}
          </button>
        ))}
        <button
          type="button"
          className="chip"
          disabled={!inlineEditable}
          aria-pressed={!isQuick}
          onClick={() => setTypeSheet(true)}
        >
          {isQuick ? "More…" : typeLabel}
        </button>
      </div>

      {ex.isBlankSearch ? (
        <div className="blank-row">
          <span className="muted-note">Blank search (no odor placed)</span>
          <Segmented
            ariaLabel="Blank search result"
            value={ex.blankCorrect === null ? "unset" : ex.blankCorrect ? "clear" : "false"}
            options={[
              { value: "clear", label: "✓ Cleared" },
              { value: "false", label: "✗ False alert" }
            ]}
            onChange={(v) =>
              inlineEditable && saveExercise({ ...ex, blankCorrect: v === "clear" })
            }
          />
        </div>
      ) : (
        <>
          <div className="hide-list">
            {hides.map((h) => {
              const nuanced =
                h.outcome && h.outcome !== "found_independent" && h.outcome !== "missed";
              return (
                <div key={h.id} className={`hide-row outcome-${h.outcome || "none"}`}>
                  <span className="hide-num">#{h.number}</span>
                  <DeviceButton
                    value={h.deviceType}
                    options={DEVICE_CHOICES}
                    labels={DEVICE_SHORT}
                    icons={DEVICE_ICONS}
                    ariaLabel={`Device for hide ${h.number}`}
                    disabled={!inlineEditable}
                    onChange={(v) => saveHide({ ...h, deviceType: v as Hide["deviceType"] })}
                  />
                  {nuanced ? (
                    <Link to={hidePath(h.id)} className="nuanced">
                      {OUTCOME_LABELS[h.outcome as HideOutcome]}
                    </Link>
                  ) : (
                    <div className="hit-miss" role="group" aria-label={`Outcome for hide ${h.number}`}>
                      <button
                        type="button"
                        className="hm found"
                        aria-pressed={h.outcome === "found_independent"}
                        aria-label={`Hide ${h.number} found`}
                        disabled={!inlineEditable}
                        onClick={() => setOutcome(h, "found_independent")}
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        className="hm missed"
                        aria-pressed={h.outcome === "missed"}
                        aria-label={`Hide ${h.number} missed`}
                        disabled={!inlineEditable}
                        onClick={() => setOutcome(h, "missed")}
                      >
                        ✗
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {hides.length === 0 && (
            <p className="muted-note">Add the hides you placed, then tap ✓ or ✗ for each.</p>
          )}
          {inlineEditable && (
            <div className="hide-actions">
              <button type="button" className="btn small" onClick={addHide}>
                ＋ Add hide
              </button>
              {hides.length > 0 && (
                <button type="button" className="btn small secondary" onClick={removeLast}>
                  − Remove last
                </button>
              )}
            </div>
          )}
          {inlineEditable && hides.length > 0 && hides.some((h) => !h.outcome) && (
            <button
              type="button"
              className="btn small ghost all-found"
              onClick={async () => {
                for (const h of hides) if (!h.outcome) await saveHide({ ...h, outcome: "found_independent" });
              }}
            >
              Mark the rest found
            </button>
          )}
        </>
      )}
      {ex.falseResponses.length > 0 && (
        <div className="muted-note" style={{ marginTop: 8 }}>
          ⚠ {ex.falseResponses.length} false response{ex.falseResponses.length === 1 ? "" : "s"} recorded
        </div>
      )}

      <Sheet open={typeSheet} onClose={() => setTypeSheet(false)} title="Search type">
        <div className="device-grid">
          {searchTypes.map((st) => (
            <button
              key={st.id}
              type="button"
              aria-pressed={ex.searchTypeId === st.id}
              onClick={() => {
                onSetType(st.id);
                setTypeSheet(false);
              }}
            >
              {st.label}
            </button>
          ))}
        </div>
      </Sheet>
      <ConfirmSheet
        open={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        onConfirm={async () => {
          if (confirmRemove) await deleteHide(confirmRemove.id);
          toast("Hide removed");
        }}
        title="Remove the last hide?"
        message="It already has a result recorded. Removing it deletes that result."
        confirmLabel="Remove"
        danger
      />
    </div>
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
