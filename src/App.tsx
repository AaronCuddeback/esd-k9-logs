import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ToastProvider } from "./components/ui";
import { BottomNav } from "./components/shell";
import { useSettingsLoaded, useTheme } from "./hooks";
import { ensureSearchTypes } from "./db/db";
import { hashPin, isUnlocked, markUnlocked, touchActivity } from "./lib/lock";

import HomeScreen from "./screens/HomeScreen";
import HistoryScreen from "./screens/HistoryScreen";
import CalendarScreen from "./screens/CalendarScreen";
import SessionEditorScreen from "./screens/SessionEditorScreen";
import ExerciseEditorScreen from "./screens/ExerciseEditorScreen";
import HideEditorScreen from "./screens/HideEditorScreen";
import ReviewFinalizeScreen from "./screens/ReviewFinalizeScreen";
import RecordDetailScreen from "./screens/RecordDetailScreen";
import RevisionHistoryScreen from "./screens/RevisionHistoryScreen";
import ReportsScreen from "./screens/ReportsScreen";
import StatsScreen from "./screens/StatsScreen";
import MoreScreen from "./screens/MoreScreen";
import FollowUpsScreen from "./screens/FollowUpsScreen";
import ProfileScreen from "./screens/ProfileScreen";
import LocationsScreen from "./screens/LocationsScreen";
import SettingsScreen from "./screens/SettingsScreen";
import BackupScreen from "./screens/BackupScreen";
import HelpScreen from "./screens/HelpScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import NewSessionScreen from "./screens/NewSessionScreen";

function LockScreen({ onUnlock, pinHash }: { onUnlock: () => void; pinHash: string }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const tryUnlock = async () => {
    if ((await hashPin(pin)) === pinHash) {
      markUnlocked();
      onUnlock();
    } else {
      setError("Incorrect PIN.");
      setPin("");
    }
  };
  return (
    <div style={{ maxWidth: 360, margin: "18vh auto 0", padding: 20 }}>
      <div className="card" style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2.2rem" }} aria-hidden="true">🐕‍🦺</div>
        <h1>ESD K9 Logs</h1>
        <p style={{ color: "var(--text-2)" }}>Enter your PIN to unlock.</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          aria-label="PIN"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && tryUnlock()}
          style={{ textAlign: "center", letterSpacing: "0.4em", fontSize: "1.3rem" }}
        />
        {error && (
          <div className="error-text" role="alert" style={{ marginTop: 8 }}>
            {error}
          </div>
        )}
        <button type="button" className="btn block" style={{ marginTop: 12 }} onClick={tryUnlock}>
          Unlock
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const { settings, loaded } = useSettingsLoaded();
  useTheme(settings);
  const location = useLocation();
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    void ensureSearchTypes();
  }, []);

  // PIN lock evaluation on mount + when settings load
  useEffect(() => {
    if (settings.appPin && !isUnlocked(settings.autoLockMinutes)) setLocked(true);
  }, [settings.appPin, settings.autoLockMinutes]);

  // refresh activity timestamp on navigation
  useEffect(() => {
    touchActivity(settings.autoLockMinutes);
  }, [location, settings.autoLockMinutes]);

  // Wait for the settings row before deciding on onboarding/lock, so a
  // brief loading state never causes a spurious redirect.
  if (!loaded) return null;

  if (settings.appPin && locked) {
    return <LockScreen pinHash={settings.appPin} onUnlock={() => setLocked(false)} />;
  }

  if (!settings.onboarded && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }
  if (settings.onboarded && location.pathname === "/onboarding") {
    return <Navigate to="/" replace />;
  }

  return (
    <ToastProvider>
      <div className="shell">
        <Routes>
          <Route path="/onboarding" element={<OnboardingScreen />} />
          <Route path="/" element={<HomeScreen />} />
          <Route path="/new" element={<NewSessionScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/calendar" element={<CalendarScreen />} />
          <Route path="/session/:id" element={<SessionEditorScreen />} />
          <Route path="/session/:id/exercise/:exId" element={<ExerciseEditorScreen />} />
          <Route path="/session/:id/exercise/:exId/hide/:hideId" element={<HideEditorScreen />} />
          <Route path="/session/:id/review" element={<ReviewFinalizeScreen />} />
          <Route path="/record/:id" element={<RecordDetailScreen />} />
          <Route path="/record/:id/revisions" element={<RevisionHistoryScreen />} />
          <Route path="/reports" element={<ReportsScreen />} />
          <Route path="/stats" element={<StatsScreen />} />
          <Route path="/more" element={<MoreScreen />} />
          <Route path="/followups" element={<FollowUpsScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="/locations" element={<LocationsScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/backup" element={<BackupScreen />} />
          <Route path="/help" element={<HelpScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {!location.pathname.startsWith("/onboarding") && <BottomNav />}
      </div>
    </ToastProvider>
  );
}
