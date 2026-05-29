import { useEffect, useState } from "react";

const SETTINGS_STORAGE_KEY = "cafe-admin-settings";
const SETTINGS_UPDATED_EVENT = "cafe-admin-settings-updated";

export const defaultAdminSettings = {
  businessName: "Cedar & Oak",
  logo: "",
  storeHours: "Mon-Fri 7:00 AM-3:00 PM\nSat-Sun 8:00 AM-2:00 PM",
  pickupInstructions: "Check in at the counter when you arrive.",
};

function readStoredSettings() {
  if (typeof window === "undefined") {
    return defaultAdminSettings;
  }

  try {
    const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    return stored ? { ...defaultAdminSettings, ...JSON.parse(stored) } : defaultAdminSettings;
  } catch {
    return defaultAdminSettings;
  }
}

function writeStoredSettings(settings) {
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent(SETTINGS_UPDATED_EVENT));
}

export function useAdminSettings() {
  const [settings, setSettings] = useState(readStoredSettings);

  useEffect(() => {
    function handleSettingsUpdate() {
      setSettings(readStoredSettings());
    }

    window.addEventListener("storage", handleSettingsUpdate);
    window.addEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdate);

    return () => {
      window.removeEventListener("storage", handleSettingsUpdate);
      window.removeEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdate);
    };
  }, []);

  function saveSettings(nextSettings) {
    const mergedSettings = { ...defaultAdminSettings, ...nextSettings };
    setSettings(mergedSettings);
    writeStoredSettings(mergedSettings);
  }

  return {
    settings,
    saveSettings,
  };
}
