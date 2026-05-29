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

export const DEFAULT_COMMUNICATION_PREFERENCES = {
  receiveLunchSpecials: true,
  receivePromotions: true,
  receivePickupNotifications: true,
  receiveNewProductAnnouncements: true,
};

function normalizeCommunicationPreferences(profile = {}) {
  return {
    receiveLunchSpecials: profile.receiveLunchSpecials ?? DEFAULT_COMMUNICATION_PREFERENCES.receiveLunchSpecials,
    receivePromotions: profile.receivePromotions ?? DEFAULT_COMMUNICATION_PREFERENCES.receivePromotions,
    receivePickupNotifications:
      profile.receivePickupNotifications ?? DEFAULT_COMMUNICATION_PREFERENCES.receivePickupNotifications,
    receiveNewProductAnnouncements:
      profile.receiveNewProductAnnouncements ??
      DEFAULT_COMMUNICATION_PREFERENCES.receiveNewProductAnnouncements,
  };
}

export function toCustomerRow(profile) {
  const communicationPreferences = normalizeCommunicationPreferences(profile);

  return {
    id: profile.id,
    first_name: String(profile.firstName || "").trim(),
    last_name: String(profile.lastName || "").trim(),
    email: normalizeEmail(profile.email),
    phone_number: String(profile.phoneNumber || "").trim(),
    receive_lunch_specials: communicationPreferences.receiveLunchSpecials,
    receive_promotions: communicationPreferences.receivePromotions,
    receive_pickup_notifications: communicationPreferences.receivePickupNotifications,
    receive_new_product_announcements: communicationPreferences.receiveNewProductAnnouncements,
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
    receiveLunchSpecials:
      row.receive_lunch_specials ?? DEFAULT_COMMUNICATION_PREFERENCES.receiveLunchSpecials,
    receivePromotions: row.receive_promotions ?? DEFAULT_COMMUNICATION_PREFERENCES.receivePromotions,
    receivePickupNotifications:
      row.receive_pickup_notifications ??
      DEFAULT_COMMUNICATION_PREFERENCES.receivePickupNotifications,
    receiveNewProductAnnouncements:
      row.receive_new_product_announcements ??
      DEFAULT_COMMUNICATION_PREFERENCES.receiveNewProductAnnouncements,
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

async function fetchCommunicationRecipients(columnName) {
  const client = requireSupabase();
  const { data, error } = await client.from("customers").select("*").eq(columnName, true);
  throwIfError(error, "Could not load communication recipients");

  return (data || []).map(fromCustomerRow);
}

export function getLunchSpecialRecipients() {
  return fetchCommunicationRecipients("receive_lunch_specials");
}

export function getPromotionRecipients() {
  return fetchCommunicationRecipients("receive_promotions");
}

export function getPickupNotificationRecipients() {
  return fetchCommunicationRecipients("receive_pickup_notifications");
}

export function getNewProductAnnouncementRecipients() {
  return fetchCommunicationRecipients("receive_new_product_announcements");
}

export async function getCommunicationPreferenceSummary() {
  const [
    lunchSpecialRecipients,
    promotionRecipients,
    pickupNotificationRecipients,
    newProductAnnouncementRecipients,
  ] = await Promise.all([
    getLunchSpecialRecipients(),
    getPromotionRecipients(),
    getPickupNotificationRecipients(),
    getNewProductAnnouncementRecipients(),
  ]);

  return {
    lunchSpecialSubscribers: lunchSpecialRecipients.length,
    promotionSubscribers: promotionRecipients.length,
    pickupNotificationSubscribers: pickupNotificationRecipients.length,
    newProductAnnouncementSubscribers: newProductAnnouncementRecipients.length,
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
