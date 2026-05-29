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

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function toCustomerRow(profile) {
  return {
    id: profile.id,
    first_name: String(profile.firstName || "").trim(),
    last_name: String(profile.lastName || "").trim(),
    email: normalizeEmail(profile.email),
    phone_number: String(profile.phoneNumber || "").trim(),
  };
}

export function fromCustomerRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    email: normalizeEmail(row.email),
    phoneNumber: row.phone_number || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

export async function fetchCustomerByIdFromSupabase(customerId) {
  if (!customerId) {
    return null;
  }

  const client = requireSupabase();
  const { data, error } = await client.from("customers").select("*").eq("id", customerId).maybeSingle();
  throwIfError(error, "Could not load customer profile");

  return fromCustomerRow(data);
}

export async function fetchCustomerByEmailFromSupabase(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  const client = requireSupabase();
  const { data, error } = await client.from("customers").select("*").eq("email", normalizedEmail).maybeSingle();
  throwIfError(error, "Could not load customer profile");

  return fromCustomerRow(data);
}

export async function upsertCustomerToSupabase(profile) {
  const client = requireSupabase();
  const { data, error } = await client.from("customers").upsert(toCustomerRow(profile)).select("*").single();
  throwIfError(error, "Could not save customer profile");

  return fromCustomerRow(data);
}

export async function migrateCustomerProfilesToSupabase(accounts) {
  const profiles = accounts.map((account) => account.profile).filter(Boolean);

  if (!profiles.length) {
    return [];
  }

  const client = requireSupabase();
  const rows = profiles.map(toCustomerRow);
  const { data, error } = await client
    .from("customers")
    .upsert(rows, { ignoreDuplicates: true, onConflict: "id" })
    .select("*");
  throwIfError(error, "Could not migrate customer profiles");

  return (data || []).map(fromCustomerRow);
}
