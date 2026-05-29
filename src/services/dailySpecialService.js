import { isSupabaseConfigured, supabase } from "../lib/supabase.js";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

function throwIfError(error, context) {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

function toDailySpecialRow(special) {
  return {
    id: special.id || undefined,
    title: special.title,
    description: special.description || "",
    price: Number(special.price) || 0,
    category_id: special.categoryId || null,
    image_url: special.imageUrl || "",
    active: Boolean(special.active),
    start_date: special.startDate,
    end_date: special.endDate,
  };
}

function fromDailySpecialRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    price: Number(row.price) || 0,
    categoryId: row.category_id || "",
    imageUrl: row.image_url || "",
    active: Boolean(row.active),
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeDailySpecial(special) {
  return {
    id: special.id || `daily-special-${Date.now()}`,
    title: special.title?.trim() || "",
    description: special.description?.trim() || "",
    price: Number(special.price) || 0,
    categoryId: special.categoryId || "",
    imageUrl: special.imageUrl?.trim() || "",
    active: Boolean(special.active),
    startDate: special.startDate || "",
    endDate: special.endDate || "",
    createdAt: special.createdAt || "",
    updatedAt: special.updatedAt || "",
  };
}

export function isDailySpecialLive(special, now = new Date()) {
  if (!special?.active || !special.startDate || !special.endDate) {
    return false;
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const startsAt = new Date(`${special.startDate}T00:00:00`);
  const endsAt = new Date(`${special.endDate}T23:59:59`);

  return startsAt <= today && today <= endsAt;
}

export function getActiveDailySpecial(specials, now = new Date()) {
  return specials.find((special) => isDailySpecialLive(special, now)) || null;
}

export function buildDailySpecialCartItem(special, categoryName = "Daily Special") {
  return {
    id: `daily-special-${special.id}`,
    productId: "",
    specialId: special.id,
    name: special.title,
    description: special.description,
    price: Number(special.price) || 0,
    finalPrice: Number(special.price) || 0,
    basePrice: Number(special.price) || 0,
    category: categoryName,
    selectedModifiers: [],
    options: [],
    source: "daily_special",
  };
}

export async function fetchDailySpecialsFromSupabase() {
  const client = requireSupabase();
  const { data, error } = await client
    .from("daily_specials")
    .select("*")
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false });

  throwIfError(error, "Could not load daily specials");
  return (data || []).map(fromDailySpecialRow);
}

export async function upsertDailySpecialToSupabase(special) {
  const client = requireSupabase();
  const row = toDailySpecialRow(special);

  if (row.active) {
    const deactivateQuery = client.from("daily_specials").update({ active: false }).eq("active", true);
    const { error } = row.id ? await deactivateQuery.neq("id", row.id) : await deactivateQuery;
    throwIfError(error, "Could not deactivate the current daily special");
  }

  const { data, error } = await client
    .from("daily_specials")
    .upsert(row)
    .select()
    .single();

  throwIfError(error, "Could not save daily special");
  return fromDailySpecialRow(data);
}

export async function deleteDailySpecialFromSupabase(specialId) {
  const client = requireSupabase();
  const { error } = await client.from("daily_specials").delete().eq("id", specialId);
  throwIfError(error, "Could not delete daily special");
}

export function getDailySpecialMessagePayload(special) {
  if (!special) {
    return null;
  }

  return {
    type: "daily_special",
    specialId: special.id,
    title: special.title,
    description: special.description,
    price: Number(special.price) || 0,
    startDate: special.startDate,
    endDate: special.endDate,
  };
}

export async function sendTodaysLunchSpecialToOptedInCustomers({ special, recipients = [] } = {}) {
  const payload = getDailySpecialMessagePayload(special);

  return {
    queued: false,
    provider: "twilio",
    recipients,
    payload,
    reason: "Twilio integration is intentionally not implemented yet.",
  };
}
