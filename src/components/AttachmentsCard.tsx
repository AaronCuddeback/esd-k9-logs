/**
 * Attachments for a session: camera capture or gallery pick, caption, type.
 * Images are downscaled/re-encoded via canvas, which both compresses them
 * and strips EXIF metadata (location, device info). Deleting an attachment
 * never touches the session record itself.
 */
import { useRef, useState } from "react";
import { db, nowIso, uuid } from "../db/db";
import { useLiveQuery } from "dexie-react-hooks";
import { ConfirmSheet, Field, useToast } from "./ui";
import type { Attachment } from "../db/types";

const MAX_DIM = 1600;
const KINDS: { value: Attachment["kind"]; label: string }[] = [
  { value: "hide_photo", label: "Hide placement" },
  { value: "environment_photo", label: "Environment" },
  { value: "diagram", label: "Diagram" },
  { value: "document", label: "Document" },
  { value: "other", label: "Other" }
];

async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Could not read image"));
      i.src = url;
    });
    const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82)
    );
    return blob ?? file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function AttachmentsCard({
  sessionId,
  readOnly
}: {
  sessionId: string;
  readOnly: boolean;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [kind, setKind] = useState<Attachment["kind"]>("hide_photo");
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const attachments = useLiveQuery(
    () => db.attachments.where("sessionId").equals(sessionId).toArray(),
    [sessionId]
  );

  const onFile = async (file: File | null) => {
    if (!file || busy) return;
    if (file.size > 20 * 1024 * 1024) {
      toast("File too large (20 MB max)");
      return;
    }
    setBusy(true);
    try {
      const blob = await compressImage(file);
      await db.attachments.add({
        id: uuid(),
        sessionId,
        exerciseId: null,
        kind,
        caption: caption.trim(),
        mimeType: blob.type || file.type,
        blob,
        byteSize: blob.size,
        createdAt: nowIso()
      });
      setCaption("");
      toast("Attachment added");
    } catch (e) {
      toast(`Could not attach: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="card">
      <h3>Attachments ({attachments?.length ?? 0})</h3>
      {attachments?.map((a) => (
        <AttachmentRow key={a.id} a={a} readOnly={readOnly} onDelete={() => setDeleteId(a.id)} />
      ))}
      {!readOnly && (
        <>
          <Field label="Type & caption for the next photo">
            <div className="row">
              <select
                aria-label="Attachment type"
                value={kind}
                onChange={(e) => setKind(e.target.value as Attachment["kind"])}
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
              <input
                type="text"
                aria-label="Caption"
                placeholder="Caption (optional)"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>
          </Field>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            aria-label="Take or choose a photo"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            disabled={busy}
          />
          <p className="hint" style={{ marginTop: 6 }}>
            Photos are compressed and camera metadata (location, device) is removed.
          </p>
        </>
      )}
      <ConfirmSheet
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) await db.attachments.delete(deleteId);
          toast("Attachment removed — session record unchanged");
        }}
        title="Remove this attachment?"
        message="Only the attachment is removed. The training session record is not affected."
        confirmLabel="Remove"
        danger
      />
    </div>
  );
}

function AttachmentRow({
  a,
  readOnly,
  onDelete
}: {
  a: Attachment;
  readOnly: boolean;
  onDelete: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const kindLabel = KINDS.find((k) => k.value === a.kind)?.label ?? a.kind;
  return (
    <div className="list-item" style={{ cursor: "default" }}>
      <button
        type="button"
        className="icon-btn"
        aria-label={url ? "Hide preview" : "Show preview"}
        onClick={() => {
          if (url) {
            URL.revokeObjectURL(url);
            setUrl(null);
          } else {
            setUrl(URL.createObjectURL(a.blob));
          }
        }}
      >
        {a.mimeType.startsWith("image/") ? "🖼️" : "📄"}
      </button>
      <div className="grow">
        <div className="primary">{a.caption || kindLabel}</div>
        <div className="secondary">
          {kindLabel} · {Math.round(a.byteSize / 1024)} KB ·{" "}
          {new Date(a.createdAt).toLocaleDateString()}
        </div>
        {url && a.mimeType.startsWith("image/") && (
          <img
            src={url}
            alt={a.caption || kindLabel}
            style={{ maxWidth: "100%", borderRadius: 8, marginTop: 8 }}
          />
        )}
      </div>
      {!readOnly && (
        <button type="button" className="icon-btn" aria-label="Delete attachment" onClick={onDelete}>
          ✕
        </button>
      )}
    </div>
  );
}
