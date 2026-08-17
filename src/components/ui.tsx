import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from "react";

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
