/**
 * Regression coverage for the "saving the profile logged me out to
 * onboarding and lost everything" defect.
 *
 * Cause: screens snapshotted `useSettings()` into local state before the
 * Dexie liveQuery resolved, so the snapshot was defaultSettings()
 * (onboarded: false, appPin: "", ...). Saving wrote that snapshot wholesale
 * and clobbered every field the screen did not own.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { db, defaultSettings, getSettings, updateSettings } from "../src/db/db";
import { ToastProvider } from "../src/components/ui";
import ProfileScreen from "../src/screens/ProfileScreen";

async function seedOnboardedSettings() {
  await db.settings.put({
    ...defaultSettings(),
    onboarded: true,
    agency: "Fairview County SO",
    handlerName: "Det. A. Merritt",
    k9Name: "Cooper",
    appPin: "hashed-pin-value",
    theme: "dark",
    autoLockMinutes: 15,
    certExpirationDate: "2026-11-05"
  });
}

beforeEach(async () => {
  await db.settings.clear();
});
afterEach(async () => {
  await db.settings.clear();
});

describe("updateSettings", () => {
  it("merges a patch without touching unrelated fields", async () => {
    await seedOnboardedSettings();
    await updateSettings({ k9Breed: "Labrador Retriever" });
    const after = await getSettings();
    expect(after.k9Breed).toBe("Labrador Retriever");
    expect(after.onboarded).toBe(true);
    expect(after.appPin).toBe("hashed-pin-value");
    expect(after.theme).toBe("dark");
    expect(after.autoLockMinutes).toBe(15);
    expect(after.handlerName).toBe("Det. A. Merritt");
  });

  it("keeps the singleton id and refreshes updatedAt", async () => {
    await seedOnboardedSettings();
    const before = await getSettings();
    await updateSettings({ unit: "ICAC" });
    const after = await getSettings();
    expect(after.id).toBe("app");
    expect(await db.settings.count()).toBe(1);
    expect(after.updatedAt >= before.updatedAt).toBe(true);
  });

  it("cannot be tricked into un-onboarding by a stale snapshot", async () => {
    await seedOnboardedSettings();
    // Simulate a screen holding pre-load defaults and saving its own fields.
    const staleSnapshot = defaultSettings();
    await updateSettings({ agency: staleSnapshot.agency || "Typed Agency" });
    expect((await getSettings()).onboarded).toBe(true);
  });
});

describe("ProfileScreen", () => {
  const renderProfile = () =>
    render(
      <MemoryRouter>
        <ToastProvider>
          <ProfileScreen />
        </ToastProvider>
      </MemoryRouter>
    );

  it("saves edits without resetting onboarding or wiping other settings", async () => {
    await seedOnboardedSettings();
    const user = userEvent.setup();
    renderProfile();

    // Form is populated from the stored row (not defaults).
    const handler = await screen.findByLabelText("Handler name");
    await waitFor(() => expect(handler).toHaveValue("Det. A. Merritt"));

    const breed = screen.getByLabelText("Breed");
    await user.clear(breed);
    await user.type(breed, "Labrador Retriever");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(async () => {
      expect((await getSettings()).k9Breed).toBe("Labrador Retriever");
    });
    const after = await getSettings();
    // The reported bug: these were being reset by the save.
    expect(after.onboarded).toBe(true);
    expect(after.appPin).toBe("hashed-pin-value");
    expect(after.theme).toBe("dark");
    expect(after.autoLockMinutes).toBe(15);
    expect(after.certExpirationDate).toBe("2026-11-05");
    expect(after.k9Name).toBe("Cooper");
  });

  it("does not render stale default values before the settings row loads", async () => {
    await seedOnboardedSettings();
    renderProfile();
    // Nothing is shown until loaded, so the user can never type into a
    // defaults snapshot and save it back over real settings.
    const agency = await screen.findByLabelText("Agency / organization");
    expect(agency).toHaveValue("Fairview County SO");
  });
});
