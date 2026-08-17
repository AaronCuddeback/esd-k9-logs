import { beforeEach, describe, expect, it } from "vitest";
import { hashPin, isUnlocked, lockNow, markUnlocked } from "../src/lib/lock";

describe("PIN lock", () => {
  beforeEach(() => sessionStorage.clear());

  it("hashes PINs deterministically and never stores plain text", async () => {
    const h1 = await hashPin("1234");
    const h2 = await hashPin("1234");
    const h3 = await hashPin("1235");
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).not.toContain("1234");
  });

  it("unlock state respects the auto-lock timeout", () => {
    expect(isUnlocked(0)).toBe(false);
    markUnlocked();
    expect(isUnlocked(0)).toBe(true); // 0 = never auto-lock
    expect(isUnlocked(5)).toBe(true);
    // simulate an old unlock timestamp (10 minutes ago)
    sessionStorage.setItem("esdk9.unlockedAt", String(Date.now() - 10 * 60_000));
    expect(isUnlocked(5)).toBe(false);
    expect(isUnlocked(15)).toBe(true);
    lockNow();
    expect(isUnlocked(0)).toBe(false);
  });
});
