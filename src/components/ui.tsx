import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from "react";
import { addMinutesToTime } from "../lib/format";

// ---------- toast ----------

const ToastContext = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const show = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3200);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {msg && (
        <div className="toast" role="status" aria-live="polite">
          {msg}
        </div>
      )}
    </ToastContext.Provider>
  );
}

// ---------- field wrapper ----------

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error && <div className="hint">{hint}</div>}
      {error && (
        <div className="error-text" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

// ---------- segmented control ----------

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="seg" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- chip multi-select ----------

export function ChipSelect({
  values,
  options,
  onChange,
  ariaLabel
}: {
  values: string[];
  options: { value: string; label: string }[];
  onChange: (v: string[]) => void;
  ariaLabel: string;
}) {
  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <div className="chips" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="chip"
          aria-pressed={values.includes(o.value)}
          onClick={() => toggle(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- 1..5 rating ----------

export function RatingBar({
  value,
  onChange,
  label
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="rating" role="group" aria-label={`${label}, 1 poor to 5 excellent`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            aria-label={`${n} of 5`}
            onClick={() => onChange(value === n ? 0 : n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- toggle ----------

export function ToggleRow({
  label,
  sub,
  checked,
  onChange
}: {
  label: string;
  sub?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="toggle-row">
      <div>
        <div className="label">{label}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
      <button
        type="button"
        className="switch"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}

/** Three-state yes/no/unset for optional booleans. */
export function YesNo({
  label,
  value,
  onChange
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="seg" role="group" aria-label={label}>
        <button type="button" aria-pressed={value === true} onClick={() => onChange(value === true ? null : true)}>
          Yes
        </button>
        <button type="button" aria-pressed={value === false} onClick={() => onChange(value === false ? null : false)}>
          No
        </button>
      </div>
    </div>
  );
}

// ---------- bottom sheet ----------

export function Sheet({
  open,
  onClose,
  title,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="sheet-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="grabber" aria-hidden="true" />
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** Confirmation sheet for destructive actions. */
export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  danger = false
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p>{message}</p>
      <div className="row">
        <button type="button" className="btn secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={`btn ${danger ? "danger" : ""}`}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}

// ---------- misc ----------

export function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    draft: "Draft",
    completed: "Completed",
    reviewed: "Reviewed",
    locked: "Locked"
  };
  return <span className={`badge ${status}`}>{labels[status] ?? status}</span>;
}

export function EmptyState({
  icon,
  title,
  sub
}: {
  icon: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="empty">
      <div className="big" aria-hidden="true">
        {icon}
      </div>
      <h3>{title}</h3>
      {sub && <p>{sub}</p>}
    </div>
  );
}

export function Stat({ num, label }: { num: string | number; label: string }) {
  return (
    <div className="stat">
      <div className="num">{num}</div>
      <div className="lbl">{label}</div>
    </div>
  );
}

/** Number input that keeps "" ↔ null round-trips clean. */
export function NumInput({
  value,
  onChange,
  id,
  min,
  max,
  step,
  placeholder,
  invalid
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  id?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  invalid?: boolean;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      id={id}
      className={invalid ? "invalid" : ""}
      value={value ?? ""}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : Number(v));
      }}
    />
  );
}

// ---------- outcome picker ----------

/**
 * Hide/find outcome. The two decisions a handler makes 95% of the time get
 * full-width thumb targets; the nuanced-but-court-important outcomes stay
 * one tap away underneath rather than competing for the same space.
 */
export function OutcomePicker({
  value,
  onChange,
  label,
  mode = "training"
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  mode?: "training" | "deployment";
}) {
  // On a real deployment you cannot know what the K9 failed to find, so
  // "missed" is meaningless there. The honest pair is: the alert produced a
  // device, or it did not (an unconfirmed alert, which must still be logged).
  const secondary =
    mode === "deployment"
      ? [{ value: "found_assisted", label: "Located with handler help" }]
      : [
          { value: "found_assisted", label: "With help" },
          { value: "interest_no_indication", label: "Interest only" },
          { value: "not_searched", label: "Not searched" }
        ];
  return (
    <div role="group" aria-label={label}>
      <div className="outcome-row">
        <button
          type="button"
          className="outcome-btn found"
          aria-pressed={value === "found_independent"}
          onClick={() => onChange("found_independent")}
        >
          ✓ {mode === "deployment" ? "Device recovered" : "Found"}
        </button>
        <button
          type="button"
          className="outcome-btn missed"
          aria-pressed={value === (mode === "deployment" ? "alert_unconfirmed" : "missed")}
          onClick={() => onChange(mode === "deployment" ? "alert_unconfirmed" : "missed")}
        >
          {mode === "deployment" ? "⚠ Nothing found" : "✗ Missed"}
        </button>
      </div>
      <div className="outcome-more">
        {secondary.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- stepper ----------

export function Stepper({
  value,
  onChange,
  label,
  min = 0,
  max = 20
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="stepper">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </button>
        <span className="value" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          +
        </button>
      </div>
    </div>
  );
}

// ---------- collapsible optional detail ----------

/** Optional fields live in here so the default form stays short. */
export function Collapse({
  title,
  defaultOpen = false,
  children
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="collapse" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="collapse-body">{children}</div>
    </details>
  );
}

/** Big tappable choice card. */
export function BigChoice({
  icon,
  title,
  sub,
  onClick,
  pressed
}: {
  icon: string;
  title: string;
  sub?: string;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      className="big-choice"
      aria-pressed={pressed}
      onClick={onClick}
    >
      <span className="bc-icon" aria-hidden="true">
        {icon}
      </span>
      <span>
        <span className="bc-title" style={{ display: "block" }}>
          {title}
        </span>
        {sub && <span className="bc-sub">{sub}</span>}
      </span>
    </button>
  );
}

// ---------- time: start + one-tap duration ----------

const QUICK_MINUTES = [15, 20, 30, 45];

function minutesBetween(start: string, end: string): number | null {
  const a = /^(\d{1,2}):(\d{2})$/.exec(start);
  const b = /^(\d{1,2}):(\d{2})$/.exec(end);
  if (!a || !b) return null;
  let d = Number(b[1]) * 60 + Number(b[2]) - (Number(a[1]) * 60 + Number(a[2]));
  if (d < 0) d += 1440;
  return d;
}

/**
 * Start time plus duration chips. Most sessions are 15–30 minutes, so the
 * end time is one tap; "Custom" still opens a real end-time picker.
 * Changing the start keeps the chosen duration.
 */
export function TimeAndDuration({
  startTime,
  endTime,
  onChange,
  idPrefix,
  startError,
  endError
}: {
  startTime: string;
  endTime: string;
  onChange: (patch: { startTime?: string; endTime?: string }) => void;
  idPrefix: string;
  startError?: string;
  endError?: string;
}) {
  const current = minutesBetween(startTime, endTime);
  const isQuick = current !== null && QUICK_MINUTES.includes(current);
  const [custom, setCustom] = useState(!!endTime && !isQuick);
  return (
    <>
      <Field label="Start time" htmlFor={`${idPrefix}-start`} error={startError}>
        <input
          id={`${idPrefix}-start`}
          type="time"
          value={startTime}
          onChange={(e) => {
            const s = e.target.value;
            onChange(
              current !== null && !custom
                ? { startTime: s, endTime: addMinutesToTime(s, current) }
                : { startTime: s }
            );
          }}
        />
      </Field>
      <div className="field">
        <label>How long?</label>
        <div className="duration-chips" role="group" aria-label="Duration">
          {QUICK_MINUTES.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={!custom && current === m}
              disabled={!startTime}
              onClick={() => {
                setCustom(false);
                onChange({ endTime: addMinutesToTime(startTime, m) });
              }}
            >
              {m}
              <small>min</small>
            </button>
          ))}
          <button
            type="button"
            aria-pressed={custom}
            onClick={() => setCustom(true)}
          >
            Other
          </button>
        </div>
        {!startTime && <div className="hint">Set a start time first.</div>}
      </div>
      {custom && (
        <Field
          label="End time"
          htmlFor={`${idPrefix}-end`}
          error={endError}
          hint={current !== null ? `${current} minutes` : undefined}
        >
          <input
            id={`${idPrefix}-end`}
            type="time"
            value={endTime}
            onChange={(e) => onChange({ endTime: e.target.value })}
          />
        </Field>
      )}
    </>
  );
}

// ---------- device picker (grid sheet instead of a dropdown) ----------

export function DeviceButton({
  value,
  onChange,
  options,
  labels,
  icons,
  ariaLabel,
  disabled
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels: Record<string, string>;
  icons: Record<string, string>;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="device-btn"
        aria-label={`${ariaLabel}: ${labels[value] ?? value}`}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">{icons[value] ?? "❔"}</span>
        <span className="device-name">{labels[value] ?? value}</span>
        <span aria-hidden="true" className="device-caret">▾</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={ariaLabel}>
        <div className="device-grid">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={value === o}
              onClick={() => {
                onChange(o);
                setOpen(false);
              }}
            >
              <span aria-hidden="true" className="dg-icon">{icons[o] ?? "❔"}</span>
              {labels[o] ?? o}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
