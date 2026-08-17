import { Link } from "react-router-dom";
import { TopBar } from "../components/shell";
import { useSettings } from "../hooks";

const items: { to: string; icon: string; label: string; sub: string }[] = [
  { to: "/followups", icon: "🎯", label: "Follow-up items", sub: "Training areas flagged for extra work" },
  { to: "/profile", icon: "🐕‍🦺", label: "K9 & handler profile", sub: "Team, certification, agency details" },
  { to: "/locations", icon: "📍", label: "Locations", sub: "Favorites and reusable training sites" },
  { to: "/backup", icon: "💾", label: "Backup & restore", sub: "Export or import all data" },
  { to: "/settings", icon: "⚙️", label: "Settings", sub: "Theme, security, exports, search types" },
  { to: "/help", icon: "❓", label: "Help & field definitions", sub: "What each field and metric means" }
];

export default function MoreScreen() {
  const settings = useSettings();
  return (
    <>
      <TopBar title="More" />
      <main className="shell-main">
        {settings.k9Name && (
          <div className="card" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ fontSize: "2rem" }} aria-hidden="true">🐕‍🦺</div>
            <div>
              <strong>K9 {settings.k9Name}</strong>
              <div style={{ color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>
                {settings.handlerName}{settings.agency ? ` · ${settings.agency}` : ""}
              </div>
            </div>
          </div>
        )}
        {items.map((i) => (
          <Link key={i.to} to={i.to} className="list-item">
            <span aria-hidden="true" style={{ fontSize: "1.3rem" }}>{i.icon}</span>
            <div className="grow">
              <div className="primary">{i.label}</div>
              <div className="secondary">{i.sub}</div>
            </div>
            <span aria-hidden="true" style={{ color: "var(--text-3)" }}>›</span>
          </Link>
        ))}
        <p style={{ color: "var(--text-3)", fontSize: "var(--fs-xs)", textAlign: "center", marginTop: 20 }}>
          ESD K9 Training Logs · local-first · no data leaves this device unless you export it
        </p>
      </main>
    </>
  );
}
