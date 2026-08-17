import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { db, useAutosave, useLiveQuery, useSettings } from "../hooks";
import { TopBar } from "../components/shell";
import {
  Field,
  NumInput,
  RatingBar,
  Segmented,
  Sheet,
  YesNo,
  useToast
} from "../components/ui";
import type { DeviceType, Hide, HideOutcome } from "../db/types";
import { diffFlat, recordChildCorrection, saveHide } from "../db/repo";
import { validateHide, hasErrors } from "../lib/validation";
import { DEVICE_LABELS, OUTCOME_LABELS } from "../lib/format";

const DEVICE_ORDER: DeviceType[] = [
  "cellphone", "usb_drive", "sd_card", "micro_sd", "sim_card", "hard_drive",
  "ssd", "tablet", "laptop", "dvr", "game_console", "training_aid_odor", "other"
];

const OUTCOMES: (HideOutcome | "")[] = [
  "found_independent", "found_assisted", "interest_no_indication", "missed", "not_searched"
];

export default function HideEditorScreen() {
  const { id, exId, hideId } = useParams<{ id: string; exId: string; hideId: string }>();
  const [params] = useSearchParams();
  const correcting = params.get("correct") === "1";
  const suffix = correcting ? "?correct=1" : "";
  const navigate = useNavigate();
  const settings = useSettings();
  const toast = useToast();

  const stored = useLiveQuery(() => db.hides.get(hideId!), [hideId]);
  const session = useLiveQuery(() => db.sessions.get(id!), [id]);
  const [hide, setHide] = useState<Hide | null>(null);
  const [original, setOriginal] = useState<Hide | null>(null);
  const [showIssues, setShowIssues] = useState(false);
  const [reasonSheet, setReasonSheet] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (stored && !hide) {
      setHide(stored);
      setOriginal(stored);
    }
  }, [stored, hide]);

  const isDraft = session?.status === "draft";
  const { save, flushNow } = useAutosave<Hide>(async (h) => {
    if (isDraft) await saveHide(h);
  });

  const update = (patch: Partial<Hide>) => {
    if (!hide) return;
    const next = { ...hide, ...patch };
    setHide(next);
    if (isDraft) save(next);
  };

  if (!hide || !session) {
    return (
      <>
        <TopBar title="Hide" back={`/session/${id}/exercise/${exId}${suffix}`} />
        <main className="shell-main"><p>Loading…</p></main>
      </>
    );
  }

  const issues = validateHide(hide);
  const errFor = (f: string) =>
    showIssues ? issues.find((i) => i.field === f && i.severity === "error")?.message : undefined;

  const done = async () => {
    setShowIssues(true);
    if (hasErrors(issues)) {
      toast("Fix the highlighted fields first");
      return;
    }
    await flushNow(hide);
    navigate(`/session/${id}/exercise/${exId}${suffix}`);
  };

  const saveCorrection = async () => {
    try {
      if (!original) return;
      const changes = diffFlat(original, hide);
      await recordChildCorrection(
        hide.sessionId,
        settings.handlerName || "Handler",
        reason,
        `Hide ${hide.number}`,
        changes
      );
      await saveHide(hide);
      toast("Correction saved with audit entry");
      setReasonSheet(false);
      navigate(`/session/${id}/exercise/${exId}${suffix}`);
    } catch (e) {
      toast((e as Error).message);
    }
  };

  return (
    <>
      <TopBar title={`Hide #${hide.number}`} back={`/session/${id}/exercise/${exId}${suffix}`} />
      <main className="shell-main">
        <div className="card">
          <Field label="Device / item type">
            <div className="chips" role="group" aria-label="Device type">
              {DEVICE_ORDER.map((d) => (
                <button
                  key={d}
                  type="button"
                  className="chip"
                  aria-pressed={hide.deviceType === d}
                  onClick={() => update({ deviceType: d })}
                >
                  {DEVICE_LABELS[d]}
                </button>
              ))}
            </div>
          </Field>
          {hide.deviceType === "other" && (
            <Field label="Describe the item" htmlFor="h-other" error={errFor("deviceTypeOther")}>
              <input
                id="h-other"
                type="text"
                className={errFor("deviceTypeOther") ? "invalid" : ""}
                value={hide.deviceTypeOther}
                onChange={(e) => update({ deviceTypeOther: e.target.value })}
              />
            </Field>
          )}
          <Field
            label="Target material / odor source"
            htmlFor="h-material"
            hint="A training aid is not always a functional device — record the odor source separately."
          >
            <input
              id="h-material"
              type="text"
              value={hide.targetMaterial}
              onChange={(e) => update({ targetMaterial: e.target.value })}
            />
          </Field>
          <Field label="Training-aid inventory # (optional)" htmlFor="h-aid">
            <input
              id="h-aid"
              type="text"
              value={hide.aidInventoryId}
              onChange={(e) => update({ aidInventoryId: e.target.value })}
            />
          </Field>
        </div>

        <div className="card">
          <h3>Placement</h3>
          <Field label="Hide location" htmlFor="h-loc" error={errFor("locationDescription")}>
            <textarea
              id="h-loc"
              className={errFor("locationDescription") ? "invalid" : ""}
              value={hide.locationDescription}
              placeholder="e.g., Taped under center desk drawer, room 214"
              onChange={(e) => update({ locationDescription: e.target.value })}
            />
          </Field>
          <Field label="Approximate height">
            <Segmented
              ariaLabel="Hide height"
              value={hide.heightDescription || "unset"}
              options={[
                { value: "floor", label: "Floor" },
                { value: "knee", label: "Knee" },
                { value: "waist", label: "Waist" },
                { value: "chest", label: "Chest" },
                { value: "elevated", label: "Elevated" },
                { value: "unset", label: "—" }
              ]}
              onChange={(v) => update({ heightDescription: v === "unset" ? "" : v })}
            />
          </Field>
          <Field label="Concealment">
            <Segmented
              ariaLabel="Concealment"
              value={hide.concealment || "unset"}
              options={[
                { value: "exposed", label: "Exposed" },
                { value: "partially concealed", label: "Partial" },
                { value: "fully concealed", label: "Full" },
                { value: "buried", label: "Buried" },
                { value: "unset", label: "—" }
              ]}
              onChange={(v) => update({ concealment: v === "unset" ? "" : v })}
            />
          </Field>
          <YesNo label="Accessible to the K9?" value={hide.accessible} onChange={(v) => update({ accessible: v })} />
          <RatingBar label="Hide difficulty" value={hide.difficulty} onChange={(v) => update({ difficulty: v as 0 })} />
          <div className="row">
            <Field label="Time placed" htmlFor="h-placed" error={errFor("placedTime")}>
              <input
                id="h-placed"
                type="time"
                value={hide.placedTime}
                onChange={(e) => update({ placedTime: e.target.value })}
              />
            </Field>
            <Field label="Aging (min)" htmlFor="h-age" error={errFor("ageMinutes")}>
              <NumInput
                id="h-age"
                value={hide.ageMinutes}
                min={0}
                invalid={!!errFor("ageMinutes")}
                onChange={(v) => update({ ageMinutes: v })}
              />
            </Field>
          </div>
          <Field label="Placed by" htmlFor="h-placedby">
            <input
              id="h-placedby"
              type="text"
              value={hide.placedBy}
              onChange={(e) => update({ placedBy: e.target.value })}
            />
          </Field>
          <YesNo
            label="Did the handler know the location?"
            value={hide.handlerKnewLocation}
            onChange={(v) => update({ handlerKnewLocation: v })}
          />
        </div>

        <div className="card">
          <h3>Outcome</h3>
          <div className="chips" role="group" aria-label="Hide outcome">
            {OUTCOMES.map((o) => (
              <button
                key={o || "none"}
                type="button"
                className="chip"
                aria-pressed={hide.outcome === o}
                onClick={() => update({ outcome: o as HideOutcome })}
              >
                {o ? OUTCOME_LABELS[o as HideOutcome] : "—"}
              </button>
            ))}
          </div>
          <Field label="Notes for this hide" htmlFor="h-notes">
            <textarea
              id="h-notes"
              value={hide.notes}
              onChange={(e) => update({ notes: e.target.value })}
              style={{ marginTop: 10 }}
            />
          </Field>
        </div>

        {isDraft ? (
          <button type="button" className="btn block" onClick={done}>
            Done — back to exercise
          </button>
        ) : (
          <button type="button" className="btn block" onClick={() => setReasonSheet(true)}>
            Save correction…
          </button>
        )}
      </main>

      <Sheet open={reasonSheet} onClose={() => setReasonSheet(false)} title="Reason for correction">
        <Field label="Why is this hide being corrected?" htmlFor="hc-reason">
          <textarea id="hc-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <button type="button" className="btn block" disabled={!reason.trim()} onClick={saveCorrection}>
          Save correction
        </button>
      </Sheet>
    </>
  );
}
