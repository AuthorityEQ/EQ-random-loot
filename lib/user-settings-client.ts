export type UserPreferences = {
  theme?: "light" | "dark";
  server?: string;
  bucketed?: boolean;
  itemPreview?: boolean;
  myCharacters?: unknown;
};

export type UserSettingsPayload = {
  epicProgress: Record<string, unknown>;
  preferences: UserPreferences;
};

export async function fetchUserSettings() {
  const response = await fetch("/api/user/settings", { cache: "no-store" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Unable to load saved settings.");
  const data = await response.json() as { settings?: UserSettingsPayload };
  return data.settings ?? { epicProgress: {}, preferences: {} };
}

export async function saveUserSettings(settings: Partial<UserSettingsPayload>) {
  const response = await fetch("/api/user/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Unable to save settings.");
  const data = await response.json() as { settings?: UserSettingsPayload };
  return data.settings ?? null;
}
