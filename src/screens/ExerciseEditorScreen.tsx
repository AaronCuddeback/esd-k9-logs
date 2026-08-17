/**
 * Exercise editor: search type, blindness, blank-search handling, hides list
 * with one-tap outcome recording, false responses, performance ratings,
 * reward tracking. Autosaves for drafts; correction mode records an audit
 * entry with before/after values.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { db, useAutosave, useLiveQuery, useSettings } from "../hooks";
import { TopBar } from "../components/shell";
import {
  ChipSelect,
  ConfirmSheet,
  Field,
  NumInput,
  RatingBar,
  Segmented,
  Sheet,
  ToggleRow,
  YesNo,
  useToast
} from "../components/ui";
import type { Blindness, Exercise, ExerciseResult, HideOutcome } from "../db/types";
import { uuid, ROOM_TYPES } from "../db/db";
import { newHide } from "../db/factories";
import { deleteHide, diffFlat, recordChildCorrection, saveExercise, saveHide } from "../db/repo";
import { OUTCOME_LABELS, DEVICE_LABELS } from "../lib/format";

const OUTCOME_ORDER: HideOutcome[] = [
  "found_independent",
  "found_assisted",
  "interest_no_indication",
  "missed",
  "not_searched"
];

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
    async () => (await db.hides.where("exerciseId").equals(exId!).toArray()).sort((a, b) => a.number - b.number),
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
  const [frHandler, setFrHandler] = useState("No reward given; moved on");
  const [deleteHideId, setDeleteHideId] = useState<string | null>(null);
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
        <main className="shell-main"><p>Loading…</p></main>
      </>
    );
  }

  const addHide = async () => {
    await flushNow(ex);
    const h = newHide(ex.id, ex.sessionId, (hides[hides.length - 1]?.number ?? 0) + 1);
    h.placedBy = session.trainerName || session.handlerName;
    h.handlerKnewLocation = ex.blindness === "known";
    await saveHide(h);
    navigate(`/session/${id}/exercise/${exId}/hide/${h.id}${suffix}`);
  };

  const setOutcome = async (hideId: string, outcome: HideOutcome) => {
    const h = hides.find((x) => x.id === hideId);
    if (!h) return;
    await saveHide({ ...h, outcome });
  };

  const addFalseResponse = () => {
    if (!frLoc.trim()) return;
    update({
      falseResponses: [
        ...ex.falseResponses,
        { id: uuid(), locationDescription: frLoc.trim(), suspectedCause: frCause.trim(), handlerResponse: frHandler.trim() }
      ]
    });
    setFrLoc("");
    setFrCause("");
    setFrSheet(false);
  };

  const saveCorrection = async () => {
    try {
      if (!original) return;
      const changes = diffFlat(original, ex);
      await recordChildCorrection(
        ex.sessionId,
        settings.handlerName || "Handler",
        reason,
        `Exercise ${ex.order}`,
        changes
      );
      await saveExercise(ex);
      toast("Correction saved with audit entry");
      setReasonSheet(false);
      navigate(`/session/${id}${suffix}`);
    } catch (e) {
      toast((e as Error).message);
    }
  };

  return (
    <>
      <TopBar title={`Exercise ${ex.order}`} back={`/session/${id}${suffix}`} />
      <main className="shell-main">
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
                    update({ searchTypeId: t.id, isBlankSearch: t.id === "blank" ? true : ex.isBlankSearch })
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Field>
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
          <Field label="Hide knowledge" hint="Double-blind: nobody present knows the placements.">
            <Segmented<Blindness>
              ariaLabel="Blindness level"
              value={ex.blindness}
              options={[
                { value: "known", label: "Known" },
                { value: "single_blind", label: "Single-blind" },
                { value: "double_blind", label: "Double-blind" }
              ]}
              onChange={(v) => update({ blindness: v })}
            />
          </Field>
          <ToggleRow
            label="Blank / negative search"
            sub="This area deliberately contains no target odor"
            checked={ex.isBlankSearch}
            onChange={(v) => update({ isBlankSearch: v, blankCorrect: v ? ex.blankCorrect : null })}
          />
          {ex.isBlankSearch && (
            <Field label="Blank-search result">
              <Segmented
                ariaLabel="Blank search result"
                value={ex.blankCorrect === null ? "unset" : ex.blankCorrect ? "clear" : "false"}
                options={[
                  { value: "unset", label: "Not recorded" },
                  { value: "clear", label: "Correctly cleared" },
                  { value: "false", label: "False response" }
                ]}
                onChange={(v) =>
                  update({ blankCorrect: v === "unset" ? null : v === "clear" })
                }
              />
            </Field>
          )}
          <Field label="Area description" htmlFor="ex-area">
            <input
              id="ex-area"
              type="text"
              value={ex.areaDescription}
              placeholder="e.g., Three offices, second floor"
              onChange={(e) => update({ areaDescription: e.target.value })}
            />
          </Field>
        </div>

        {!ex.isBlankSearch && (
          <div className="card">
            <h3>Hides ({hides.length})</h3>
            {hides.map((h) => (
              <div key={h.id} className="card flat" style={{ padding: 10, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Link
                    to={`/session/${id}/exercise/${exId}/hide/${h.id}${suffix}`}
                    className="grow"
                    style={{ textDecoration: "none", color: "inherit", flex: 1, minWidth: 0 }}
                  >
                    <div className="primary" style={{ fontWeight: 600 }}>
                      #{h.number} · {h.deviceType === "other" ? h.deviceTypeOther || "Other" : DEVICE_LABELS[h.deviceType]}
                    </div>
                    <div className="secondary" style={{ color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>
                      {h.locationDescription || "Tap to add details"}
                    </div>
                  </Link>
                  {isDraft && (
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Delete hide ${h.number}`}
                      onClick={() => setDeleteHideId(h.id)}
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="seg" style={{ marginTop: 8 }} role="group" aria-label={`Outcome for hide ${h.number}`}>
                  {OUTCOME_ORDER.map((o) => (
                    <button
                      key={o}
                      type="button"
                      aria-pressed={h.outcome === o}
                      onClick={() => setOutcome(h.id, o)}
                      title={OUTCOME_LABELS[o]}
                    >
                      {o === "found_independent" ? "✓ Found" :
                       o === "found_assisted" ? "✓ Assisted" :
                       o === "interest_no_indication" ? "Interest" :
                       o === "missed" ? "✗ Missed" : "Not searched"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button type="button" className="btn secondary block" onClick={addHide}>
              ＋ Quick-add hide
            </button>
          </div>
        )}

        <div className="card">
          <h3>False responses ({ex.falseResponses.length})</h3>
          <p style={{ color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>
            A final response where no target odor was present. Recording these is
            essential for defensible records.
          </p>
          {ex.falseResponses.map((f) => (
            <div key={f.id} className="list-item" style={{ cursor: "default" }}>
              <div className="grow">
                <div className="primary">{f.locationDescription}</div>
                {f.suspectedCause && <div className="secondary">Cause: {f.suspectedCause}</div>}
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
          <button type="button" className="btn secondary block" onClick={() => setFrSheet(true)}>
            ＋ Record false response
          </button>
        </div>

        <div className="card">
          <h3>Timing &amp; handling</h3>
          <div className="row">
            <Field label="Search time (min)" htmlFor="ex-time">
              <NumInput
                id="ex-time"
                value={ex.searchTimeSeconds != null ? Math.round(ex.searchTimeSeconds / 60) : null}
                min={0}
                onChange={(v) => update({ searchTimeSeconds: v != null ? v * 60 : null })}
              />
            </Field>
            <Field label="First find (min)" htmlFor="ex-first">
              <NumInput
                id="ex-first"
                value={ex.timeToFirstFindSeconds != null ? Math.round(ex.timeToFirstFindSeconds / 60) : null}
                min={0}
                onChange={(v) => update({ timeToFirstFindSeconds: v != null ? v * 60 : null })}
              />
            </Field>
          </div>
          <ToggleRow label="Off leash" checked={ex.offLeash} onChange={(v) => update({ offLeash: v })} />
          <Field label="Final response type" htmlFor="ex-final">
            <input
              id="ex-final"
              type="text"
              value={ex.finalResponseType}
              placeholder="Sit (passive)…"
              onChange={(e) => update({ finalResponseType: e.target.value })}
            />
          </Field>
          <Field label="Handler cueing / assistance">
            <Segmented
              ariaLabel="Handler cueing"
              value={ex.handlerCueing || "unset"}
              options={[
                { value: "unset", label: "—" },
                { value: "None", label: "None" },
                { value: "Minimal", label: "Minimal" },
                { value: "Directed recheck", label: "Recheck" },
                { value: "Significant", label: "Significant" }
              ]}
              onChange={(v) => update({ handlerCueing: v === "unset" ? "" : v })}
            />
          </Field>
          <Field label="Search strategy notes" htmlFor="ex-strategy">
            <input
              id="ex-strategy"
              type="text"
              value={ex.handlerStrategy}
              placeholder="Perimeter first, then detail…"
              onChange={(e) => update({ handlerStrategy: e.target.value })}
            />
          </Field>
        </div>

        <div className="card">
          <h3>Reward</h3>
          <Field label="Reward type">
            <Segmented
              ariaLabel="Reward type"
              value={ex.rewardType || "unset"}
              options={[
                { value: "food", label: "Food" },
                { value: "toy", label: "Toy" },
                { value: "praise", label: "Praise" },
                { value: "unset", label: "None" }
              ]}
              onChange={(v) => update({ rewardType: v === "unset" ? "" : v })}
            />
          </Field>
          {ex.rewardType === "food" && (
            <Field label="Food cups given" htmlFor="ex-cups" hint="ESD K9s are typically fed through training — cups matter.">
              <NumInput id="ex-cups" value={ex.rewardCups} min={0} max={20} step={0.5} onChange={(v) => update({ rewardCups: v })} />
            </Field>
          )}
          <YesNo label="Rewarded at source?" value={ex.rewardedAtSource} onChange={(v) => update({ rewardedAtSource: v })} />
        </div>

        <div className="card">
          <h3>Performance ratings (optional)</h3>
          <RatingBar label="Search coverage / thoroughness" value={ex.coverage} onChange={(v) => update({ coverage: v as 0 })} />
          <RatingBar label="Search intensity" value={ex.intensity} onChange={(v) => update({ intensity: v as 0 })} />
          <RatingBar label="Independence" value={ex.independence} onChange={(v) => update({ independence: v as 0 })} />
          <RatingBar label="Focus" value={ex.focus} onChange={(v) => update({ focus: v as 0 })} />
          <RatingBar label="Stamina" value={ex.stamina} onChange={(v) => update({ stamina: v as 0 })} />
          <RatingBar label="Indication quality" value={ex.indicationQuality} onChange={(v) => update({ indicationQuality: v as 0 })} />
        </div>

        <div className="card">
          <h3>Result</h3>
          <Field label="Exercise result">
            <Segmented<ExerciseResult | "unset">
              ariaLabel="Exercise result"
              value={(ex.result || "unset") as ExerciseResult | "unset"}
              options={[
                { value: "successful", label: "Successful" },
                { value: "needs_work", label: "Needs work" },
                { value: "unsatisfactory", label: "Unsatisfactory" },
                { value: "unset", label: "—" }
              ]}
              onChange={(v) => update({ result: v === "unset" ? "" : v })}
            />
          </Field>
          <Field label="Problems encountered" htmlFor="ex-problems">
            <textarea id="ex-problems" value={ex.problems} onChange={(e) => update({ problems: e.target.value })} />
          </Field>
          <Field label="Corrective training performed" htmlFor="ex-corrective">
            <textarea id="ex-corrective" value={ex.correctiveTraining} onChange={(e) => update({ correctiveTraining: e.target.value })} />
          </Field>
          <Field label="Comments" htmlFor="ex-comments">
            <textarea id="ex-comments" value={ex.comments} onChange={(e) => update({ comments: e.target.value })} />
          </Field>
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
        <Field label="Where did it occur?" htmlFor="fr-loc">
          <input id="fr-loc" type="text" value={frLoc} onChange={(e) => setFrLoc(e.target.value)} autoFocus />
        </Field>
        <Field label="Suspected cause (optional)" htmlFor="fr-cause">
          <input id="fr-cause" type="text" value={frCause} placeholder="Residual odor, distractor…" onChange={(e) => setFrCause(e.target.value)} />
        </Field>
        <Field label="Handler response" htmlFor="fr-handler">
          <input id="fr-handler" type="text" value={frHandler} onChange={(e) => setFrHandler(e.target.value)} />
        </Field>
        <button type="button" className="btn block" disabled={!frLoc.trim()} onClick={addFalseResponse}>
          Add false response
        </button>
      </Sheet>

      <ConfirmSheet
        open={deleteHideId !== null}
        onClose={() => setDeleteHideId(null)}
        onConfirm={async () => {
          if (deleteHideId) await deleteHide(deleteHideId);
          toast("Hide removed");
        }}
        title="Remove this hide?"
        message="The hide record will be removed from this exercise."
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
