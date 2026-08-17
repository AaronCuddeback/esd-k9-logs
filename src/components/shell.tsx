import { type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";

const icons = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  ),
  reports: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h7M9 17h7" />
    </svg>
  ),
  stats: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" />
    </svg>
  )
};

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
        {icons.home}
        <span>Home</span>
      </NavLink>
      <NavLink to="/history" className={({ isActive }) => (isActive ? "active" : "")}>
        {icons.history}
        <span>History</span>
      </NavLink>
      <NavLink to="/reports" className={({ isActive }) => (isActive ? "active" : "")}>
        {icons.reports}
        <span>Reports</span>
      </NavLink>
      <NavLink to="/stats" className={({ isActive }) => (isActive ? "active" : "")}>
        {icons.stats}
        <span>Stats</span>
      </NavLink>
      <NavLink to="/more" className={({ isActive }) => (isActive ? "active" : "")}>
        {icons.more}
        <span>More</span>
      </NavLink>
    </nav>
  );
}

export function TopBar({
  title,
  back,
  actions
}: {
  title: string;
  back?: boolean | string;
  actions?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <header className="topbar">
      <div className="topbar-inner">
        {back && (
          <button
            type="button"
            className="icon-btn"
            aria-label="Back"
            onClick={() => (typeof back === "string" ? navigate(back) : navigate(-1))}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        )}
        <div className="title">{title}</div>
        {actions}
      </div>
    </header>
  );
}

export function OfflineBanner() {
  if (typeof navigator !== "undefined" && navigator.onLine) return null;
  return (
    <div className="banner info" role="status" style={{ margin: "0 0 12px" }}>
      <span aria-hidden="true">📡</span>
      <span>
        Offline — all work is saved on this device. Nothing requires a connection.
      </span>
    </div>
  );
}
