/**
 * Optional app PIN. The PIN is stored as a salted SHA-256 hash (never in
 * plain text). This is a screen lock for casual protection of the device —
 * it is not disk encryption; see SECURITY.md for the threat model.
 */

const SALT = "esd-k9-logs-v1:"; // static app salt; PIN hashes never leave the device

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(SALT + pin);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const UNLOCK_KEY = "esdk9.unlockedAt";

export function markUnlocked() {
  sessionStorage.setItem(UNLOCK_KEY, String(Date.now()));
}

export function isUnlocked(autoLockMinutes: number): boolean {
  const raw = sessionStorage.getItem(UNLOCK_KEY);
  if (!raw) return false;
  if (autoLockMinutes <= 0) return true;
  const age = Date.now() - Number(raw);
  return age < autoLockMinutes * 60_000;
}

export function touchActivity(autoLockMinutes: number) {
  if (autoLockMinutes > 0 && sessionStorage.getItem(UNLOCK_KEY)) {
    sessionStorage.setItem(UNLOCK_KEY, String(Date.now()));
  }
}

export function lockNow() {
  sessionStorage.removeItem(UNLOCK_KEY);
}
