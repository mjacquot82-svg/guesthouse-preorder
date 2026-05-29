import { useEffect, useState } from "react";
import {
  deleteDailySpecialFromSupabase,
  fetchDailySpecialsFromSupabase,
  normalizeDailySpecial,
  upsertDailySpecialToSupabase,
} from "../services/dailySpecialService.js";

const DAILY_SPECIALS_STORAGE_KEY = "cedar-oak-daily-specials";
const DAILY_SPECIALS_UPDATED_EVENT = "cedar-oak-daily-specials-updated";

let dailySpecialsLoadPromise = null;

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

const defaultDailySpecials = [
  {
    id: "daily-special-turkey-club-soup",
    title: "Turkey Club + Soup",
    description: "Stacked turkey club with today's soup.",
    price: 12.99,
    categoryId: "",
    imageUrl: "",
    active: true,
    startDate: todayDateString(),
    endDate: todayDateString(),
  },
];

function readStoredDailySpecials() {
  if (typeof window === "undefined") {
    return defaultDailySpecials.map(normalizeDailySpecial);
  }

  try {
    const stored = window.localStorage.getItem(DAILY_SPECIALS_STORAGE_KEY);
    const specials = stored ? JSON.parse(stored) : defaultDailySpecials;
    return specials.map(normalizeDailySpecial);
  } catch {
    return defaultDailySpecials.map(normalizeDailySpecial);
  }
}

function writeStoredDailySpecials(specials) {
  window.localStorage.setItem(DAILY_SPECIALS_STORAGE_KEY, JSON.stringify(specials));
  window.dispatchEvent(new CustomEvent(DAILY_SPECIALS_UPDATED_EVENT));
}

function normalizeDailySpecials(specials) {
  let hasActiveSpecial = false;

  return specials.map((special) => {
    const normalizedSpecial = normalizeDailySpecial(special);
    const active = normalizedSpecial.active && !hasActiveSpecial;
    hasActiveSpecial = hasActiveSpecial || active;

    return {
      ...normalizedSpecial,
      active,
    };
  });
}

function logDailySpecialSyncError(error) {
  console.warn(
    "Daily special Supabase sync failed. Falling back to the cached local specials.",
    error
  );
}

async function loadDailySpecialsFromSource() {
  try {
    const specials = await fetchDailySpecialsFromSupabase();
    const normalizedSpecials = normalizeDailySpecials(specials);
    writeStoredDailySpecials(normalizedSpecials);
    return normalizedSpecials;
  } catch (error) {
    logDailySpecialSyncError(error);
    return readStoredDailySpecials();
  }
}

function loadDailySpecials() {
  if (!dailySpecialsLoadPromise) {
    dailySpecialsLoadPromise = loadDailySpecialsFromSource().finally(() => {
      dailySpecialsLoadPromise = null;
    });
  }

  return dailySpecialsLoadPromise;
}

function saveDailySpecialToSupabase(special) {
  upsertDailySpecialToSupabase(special).catch(logDailySpecialSyncError);
}

function deleteFromSupabase(specialId) {
  deleteDailySpecialFromSupabase(specialId).catch(logDailySpecialSyncError);
}

export function getDailySpecials() {
  return readStoredDailySpecials();
}

export function saveDailySpecials(specials) {
  const normalizedSpecials = normalizeDailySpecials(specials);
  writeStoredDailySpecials(normalizedSpecials);
}

export function useDailySpecials() {
  const [dailySpecials, setDailySpecials] = useState(readStoredDailySpecials);

  useEffect(() => {
    function handleDailySpecialsUpdate() {
      setDailySpecials(readStoredDailySpecials());
    }

    loadDailySpecials().then(setDailySpecials);

    window.addEventListener("storage", handleDailySpecialsUpdate);
    window.addEventListener(DAILY_SPECIALS_UPDATED_EVENT, handleDailySpecialsUpdate);

    return () => {
      window.removeEventListener("storage", handleDailySpecialsUpdate);
      window.removeEventListener(DAILY_SPECIALS_UPDATED_EVENT, handleDailySpecialsUpdate);
    };
  }, []);

  function replaceDailySpecials(nextDailySpecials) {
    const normalizedSpecials = normalizeDailySpecials(nextDailySpecials);
    setDailySpecials(normalizedSpecials);
    saveDailySpecials(normalizedSpecials);
  }

  function addDailySpecial(special) {
    const normalizedSpecial = normalizeDailySpecial(special);
    const nextDailySpecials = normalizedSpecial.active
      ? dailySpecials.map((item) => ({ ...item, active: false }))
      : dailySpecials;

    replaceDailySpecials([normalizedSpecial, ...nextDailySpecials]);
    saveDailySpecialToSupabase(normalizedSpecial);
  }

  function updateDailySpecial(specialId, updates) {
    const existingSpecial = dailySpecials.find((special) => special.id === specialId);
    const updatedSpecial = normalizeDailySpecial({ ...existingSpecial, ...updates, id: specialId });
    const nextDailySpecials = dailySpecials.map((special) => {
      if (special.id === specialId) {
        return updatedSpecial;
      }

      return updatedSpecial.active ? { ...special, active: false } : special;
    });

    replaceDailySpecials(nextDailySpecials);
    saveDailySpecialToSupabase(updatedSpecial);
  }

  function removeDailySpecial(specialId) {
    replaceDailySpecials(dailySpecials.filter((special) => special.id !== specialId));
    deleteFromSupabase(specialId);
  }

  return {
    dailySpecials,
    addDailySpecial,
    updateDailySpecial,
    removeDailySpecial,
    replaceDailySpecials,
  };
}
