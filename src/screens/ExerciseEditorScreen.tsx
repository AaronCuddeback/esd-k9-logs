/**
 * Exercise editor, optimised for logging during or right after a run.
 *
 * The fast path is: pick a search type, set how many hides with the
 * stepper, tap Found/Missed on each. Everything else (timing, reward,
 * cueing, ratings, notes) is collapsed — per-exercise ratings in
 * particular are redundant with the session assessment for routine work,
 * so they are off by default but still available for evaluations.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { db, useAutosave, useLiveQuery, useSettings } from "../hooks";
import { TopBar } from "../components/shell";
import {
  ChipSelect,
  Collapse,
  ConfirmSheet,
  DeviceButton,
  Field,
  NumInput,
  OutcomePicker,
  RatingBar,
  Segmented,
  Sheet,
  Stepper,
  ToggleRow,
  useToast
} from "../components/ui";
import type { Blindness, Exercise, ExerciseResult, Hide, HideOutcome } from "../db/types";
import { uuid, ROOM_TYPES } from "../db/db";
import { newHide } from "../db/factories";
import { deleteHide, diffFlat, recordChildCorrection, saveExercise, saveHide } from "../db/repo";
import { DEVICE_CHOICES, DEVICE_ICONS, DEVICE_SHORT } from "../lib/format";


export default function ExerciseEditorScreen() {
  const { id, exId } = useParams<{ id: string; exId: string }>();
  const [params] = useSearchParams();
  const correcting = params.get("correct") === "1";
  const suffix = correcting ? "?correct=1" : "";
  const navigate = useNavigate();
  const settings = useSettings();
  const toast = useToast();

  const stored = useLiveQuery(() => db.exercises.get(exId!), [exId]);
  const session = useLiveQuery(() => db.sessions.get(id!), [id]);
  const hides = useLiveQuery(
    async () =>
      (await db.hides.where("exerciseId").equals(exId!).toArray()).sort(
        (a, b) => a.number - b.number
      ),
    [exId]
  );
  const searchTypes = useLiveQuery(
    async () => (await db.searchTypes.toArray()).filter((t) => !t.archived),
    []
  );

  const [ex, setEx] = useState<Exercise | null>(null);
  const [original, setOriginal] = useState<Exercise | null>(null);
  const [frSheet, setFrSheet] = useState(false);
  const [frLoc, setFrLoc] = useState("");
  const [frCause, setFrCause] = useState("");
  const [confirmRemoveHide, setConfirmRemoveHide] = useState<Hide | null>(null);
  const [reasonSheet, setReasonSheet] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (stored && !ex) {
      setEx(stored);
      setOriginal(stored);
    }
  }, [stored, ex]);

  const isDraft = session?.status === "draft";
  const { save, flushNow } = useAutosave<Exercise>(async (e) => {
    if (isDraft) await saveExercise(e);
  });

  const update = (patch: Partial<Exercise>) => {
    if (!ex) return;
    const next = { ...ex, ...patch };
    setEx(next);
    if (isDraft) save(next);
  };

  if (!ex || !hides || !session) {
    return (
      <>
        <TopBar title="Exercise" back={`/session/${id}${suffix}`} />
        <main className="shell-main">
          <p>Loading…</p>
        </main>
      </>
    );
  }

  const addHide = async () => {
    const h = newHide(ex.id, ex.sessionId, (hides[hides.length - 1]?.number ?? 0) + 1);
    h.placedBy = session.trainerName || session.handlerName;
    h.handlerKnewLocation = ex.blindness === "known";
    // repeat the previous hide's device — most drills use the same aid
    if (hides.length > 0) h.deviceType = hides[hides.length - 1].deviceType;
    await saveHide(h);
  };

  const removeLastHide = async () => {
    const last = hides[hides.length - 1];
    if (!last) return;
    if (last.outcome || last.locationDescription.trim() || last.notes.trim()) {
      setConfirmRemoveHide(last);
      return;
    }
    await deleteHide(last.id);
  };

  const setHideCount = async (n: number) => {
    if (n > hides.length) await addHide();
    else if (n < hides.length) await removeLastHide();
  };

  const patchHide = async (h: Hide, patch: Partial<Hide>) => {
    await saveHide({ ...h, ...patch });
  };

  const addFalseResponse = () => {
    if (!frLoc.trim()) return;
    update({
      falseResponses: [
        ...ex.falseResponses,
        {
          id: uuid(),
          locationDescription: frLoc.trim(),
          suspectedCause: frCause.trim(),
          handlerResponse: "No reward given"
        }
      ]
    });
    setFrLoc("");
    setFrCause("");
    setFrSheet(false);
  };

  const saveCorrection = async () => {
    try {
      if (!original) return;
      await recordChildCorrection(
        ex.sessionId,
        settings.handlerName || "Handler",
        reason,
        `Exercise ${ex.order}`,
        diffFlat(original, ex)
      );
      await saveExercise(ex);
      toast("Correction saved");
      setReasonSheet(false);
      navigate(`/session/${id}${suffix}`);
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const showAdvanced = settings.showAdvancedFields;

  return (
    <>
      <TopBar title={`Exercise ${ex.order}`} back={`/session/${id}${suffix}`} />
      <main className="shell-main">
        {/* --- what kind of search --- */}
        <div className="card">
          <Field label="Search type">
            <div className="chips" role="group" aria-label="Search type">
              {searchTypes?.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="chip"
                  aria-pressed={ex.searchTypeId === t.id}
                  onClick={() =>
                    update({
                      searchTypeId: t.id,
                      isBlankSearch: t.id === "blank" ? true : ex.isBlankSearch
                    })
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Hide knowledge">
            <Segmented<Blindness>
              ariaLabel="Blindness level"
              value={ex.blindness}
              options={[
                { value: "known", label: "Known" },
                { value: "single_blind", label: "Blind" },
                { value: "double_blind", label: "Double-blind" }
              ]}
              onChange={(v) => update({ blindness: v })}
            />
          </Field>
          <ToggleRow
            label="Blank search"
            sub="No target odor placed in this area"
            checked={ex.isBlankSearch}
            onChange={(v) =>
              update({ isBlankSearch: v, blankCorrect: v ? ex.blankCorrect : null })
            }
          />
          {ex.isBlankSearch && (
            <Field label="Blank result">
              <Segmented
                ariaLabel="Blank search result"
                value={ex.blankCorrect === null ? "unset" : ex.blankCorrect ? "clear" : "false"}
                options={[
                  { value: "clear", label: "✓ Cleared" },
                  { value: "false", label: "✗ False response" },
                  { value: "unset", label: "—" }
                ]}
                onChange={(v) => update({ blankCorrect: v === "unset" ? null : v === "clear" })}
              />
            </Field>
          )}
        </div>

        {/* --- hides + outcomes, the fast path --- */}
        {!ex.isBlankSearch && (
          <div className="card">
            <Stepper
              label="How many hides?"
              value={hides.length}
              onChange={setHideCount}
              min={0}
              max={30}
            />
            {hides.map((h) => (
              <div
                key={h.id}
                className="card flat"
                style={{ padding: 12, marginBottom: 12, background: "var(--surface-2)" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <strong style={{ minWidth: 28 }}>#{h.number}</strong>
                  <DeviceButton
                    value={h.deviceType}
                    options={DEVICE_CHOICES}
                    labels={DEVICE_SHORT}
                    icons={DEVICE_ICONS}
                    ariaLabel={`Device for hide ${h.number}`}
                    onChange={(v) => patchHide(h, { deviceType: v as Hide["deviceType"] })}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`More detail for hide ${h.number}`}
                    onClick={() =>
                      navigate(`/session/${id}/exercise/${exId}/hide/${h.id}${suffix}`)
                    }
                  >
                    ✏️
                  </button>
                </div>
                <OutcomePicker
                  label={`Outcome for hide ${h.number}`}
                  value={h.outcome}
                  onChange={(v) => patchHide(h, { outcome: v as HideOutcome })}
                />
              </div>
            ))}
            {hides.length === 0 && (
              <p style={{ color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>
                Tap + to add the hides you placed, then mark each found or missed.
              </p>
            )}
          </div>
        )}

        {/* --- false responses stay one tap away: court-critical --- */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <strong>False responses</strong>
            <button type="button" className="btn small secondary" onClick={() => setFrSheet(true)}>
              ＋ Add
            </button>
          </div>
          {ex.falseResponses.length === 0 ? (
            <p style={{ color: "var(--text-3)", fontSize: "var(--fs-sm)", margin: "8px 0 0" }}>
              None recorded.
            </p>
          ) : (
            <div style={{ marginTop: 10 }}>
              {ex.falseResponses.map((f) => (
                <div key={f.id} className="list-item" style={{ cursor: "default" }}>
                  <div className="grow">
                    <div className="primary">{f.locationDescription}</div>
                    {f.suspectedCause && <div className="secondary">{f.suspectedCause}</div>}
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove false response at ${f.locationDescription}`}
                    onClick={() =>
                      update({ falseResponses: ex.falseResponses.filter((x) => x.id !== f.id) })
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* --- everything else, collapsed --- */}
        <div className="card flat">
          <Collapse title="📝 Notes & result" defaultOpen={showAdvanced}>
            <Field
              label="Area for this exercise only"
              htmlFor="ex-area"
              hint="Only if it differs from the session's area searched."
            >
              <input
                id="ex-area"
                type="text"
                value={ex.areaDescription}
                placeholder="e.g., 12-box line, rear office"
                onChange={(e) => update({ areaDescription: e.target.value })}
              />
            </Field>
            <Field label="Comments" htmlFor="ex-comments">
              <textarea
                id="ex-comments"
                value={ex.comments}
                onChange={(e) => update({ comments: e.target.value })}
              />
            </Field>
            <Field label="Exercise result">
              <Segmented<ExerciseResult | "unset">
                ariaLabel="Exercise result"
                value={(ex.result || "unset") as ExerciseResult | "unset"}
                options={[
                  { value: "successful", label: "Good" },
                  { value: "needs_work", label: "Needs work" },
                  { value: "unsatisfactory", label: "Poor" },
                  { value: "unset", label: "—" }
                ]}
                onChange={(v) => update({ result: v === "unset" ? "" : v })}
              />
            </Field>
            <Field label="Problems / corrective training" htmlFor="ex-problems">
              <textarea
                id="ex-problems"
                value={ex.problems}
                onChange={(e) => update({ problems: e.target.value })}
              />
            </Field>
          </Collapse>

          <Collapse title="⏱ Timing & reward" defaultOpen={showAdvanced}>
            {(ex.searchTypeId === "room" || ex.searchTypeId === "cluttered") && (
              <Field label="Type of rooms">
                <ChipSelect
                  ariaLabel="Room types"
                  values={ex.roomTypes}
                  options={ROOM_TYPES.map((r) => ({ value: r, label: r }))}
                  onChange={(v) => update({ roomTypes: v })}
                />
              </Field>
            )}
            <div className="row">
              <Field label="Search time (min)" htmlFor="ex-time">
                <NumInput
                  id="ex-time"
                  value={ex.searchTimeSeconds != null ? Math.round(ex.searchTimeSeconds / 60) : null}
                  min={0}
                  onChange={(v) => update({ searchTimeSeconds: v != null ? v * 60 : null })}
                />
              </Field>
              <Field label="Food cups" htmlFor="ex-cups">
                <NumInput
                  id="ex-cups"
                  value={ex.rewardCups}
                  min={0}
                  max={20}
                  step={0.5}
                  onChange={(v) => update({ rewardCups: v })}
                />
              </Field>
            </div>
            <ToggleRow
              label="Off leash"
              checked={ex.offLeash}
              onChange={(v) => update({ offLeash: v })}
            />
            <Field label="Handler cueing">
              <Segmented
                ariaLabel="Handler cueing"
                value={ex.handlerCueing || "unset"}
                options={[
                  { value: "unset", label: "—" },
                  { value: "None", label: "None" },
                  { value: "Minimal", label: "Minimal" },
                  { value: "Directed recheck", label: "Recheck" }
                ]}
                onChange={(v) => update({ handlerCueing: v === "unset" ? "" : v })}
              />
            </Field>
          </Collapse>

          <Collapse title="📊 Detailed ratings (for evaluations)" defaultOpen={showAdvanced}>
            <p style={{ color: "var(--text-3)", fontSize: "var(--fs-xs)" }}>
              Optional. Routine sessions are usually covered by the overall session
              assessment — these are for certifications and formal evaluations.
            </p>
            <RatingBar label="Coverage" value={ex.coverage} onChange={(v) => update({ coverage: v as 0 })} />
            <RatingBar label="Intensity" value={ex.intensity} onChange={(v) => update({ intensity: v as 0 })} />
            <RatingBar
              label="Independence"
              value={ex.independence}
              onChange={(v) => update({ independence: v as 0 })}
            />
            <RatingBar label="Focus" value={ex.focus} onChange={(v) => update({ focus: v as 0 })} />
            <RatingBar label="Stamina" value={ex.stamina} onChange={(v) => update({ stamina: v as 0 })} />
            <RatingBar
              label="Indication quality"
              value={ex.indicationQuality}
              onChange={(v) => update({ indicationQuality: v as 0 })}
            />
          </Collapse>
        </div>

        {isDraft ? (
          <button
            type="button"
            className="btn block"
            onClick={async () => {
              await flushNow(ex);
              navigate(`/session/${id}`);
            }}
          >
            Done — back to session
          </button>
        ) : (
          <button type="button" className="btn block" onClick={() => setReasonSheet(true)}>
            Save correction…
          </button>
        )}
      </main>

      <Sheet open={frSheet} onClose={() => setFrSheet(false)} title="Record false response">
        <Field label="Where did it happen?" htmlFor="fr-loc">
          <input
            id="fr-loc"
            type="text"
            value={frLoc}
            onChange={(e) => setFrLoc(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Suspected cause (optional)" htmlFor="fr-cause">
          <input
            id="fr-cause"
            type="text"
            value={frCause}
            placeholder="Residual odor, distractor…"
            onChange={(e) => setFrCause(e.target.value)}
          />
        </Field>
        <button type="button" className="btn block" disabled={!frLoc.trim()} onClick={addFalseResponse}>
          Add
        </button>
      </Sheet>

      <ConfirmSheet
        open={confirmRemoveHide !== null}
        onClose={() => setConfirmRemoveHide(null)}
        onConfirm={async () => {
          if (confirmRemoveHide) await deleteHide(confirmRemoveHide.id);
          toast("Hide removed");
        }}
        title="Remove the last hide?"
        message="It already has details recorded. Removing it deletes those details."
        confirmLabel="Remove"
        danger
      />

      <Sheet open={reasonSheet} onClose={() => setReasonSheet(false)} title="Reason for correction">
        <Field label="Why is this exercise being corrected?" htmlFor="exc-reason">
          <textarea id="exc-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <button type="button" className="btn block" disabled={!reason.trim()} onClick={saveCorrection}>
          Save correction
        </button>
      </Sheet>
    </>
  );
}
