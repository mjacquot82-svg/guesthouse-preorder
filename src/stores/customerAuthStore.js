import { useEffect, useState } from "react";
import {
  DEFAULT_COMMUNICATION_PREFERENCES,
  fetchCustomerByEmailFromSupabase,
  fetchCustomerByIdFromSupabase,
  migrateCustomerProfilesToSupabase,
  upsertCustomerToSupabase,
} from "../services/customerService.js";

const CUSTOMER_ACCOUNTS_KEY = "cedar-oak-customer-accounts";
const CUSTOMER_SESSION_KEY = "cedar-oak-customer-session";
const CUSTOMER_SESSION_EVENT = "cedar-oak-customer-session-updated";

function createCustomerId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `customer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function readJsonStorage(storage, key, fallback) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    return JSON.parse(storage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function readAccounts() {
  if (typeof window === "undefined") {
    return [];
  }

  return readJsonStorage(window.localStorage, CUSTOMER_ACCOUNTS_KEY, []);
}

function writeAccounts(accounts) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CUSTOMER_ACCOUNTS_KEY, JSON.stringify(accounts));
}

function readCustomerSession() {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    readJsonStorage(window.localStorage, CUSTOMER_SESSION_KEY, null) ||
    readJsonStorage(window.sessionStorage, CUSTOMER_SESSION_KEY, null)
  );
}

function writeCustomerSession(session, stayLoggedIn = true) {
  window.localStorage.removeItem(CUSTOMER_SESSION_KEY);
  window.sessionStorage.removeItem(CUSTOMER_SESSION_KEY);

  if (session) {
    const storage = stayLoggedIn ? window.localStorage : window.sessionStorage;
    storage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(session));
  }

  window.dispatchEvent(new CustomEvent(CUSTOMER_SESSION_EVENT));
}

function findAccountByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  return readAccounts().find((account) => account.profile.email === normalizedEmail) || null;
}

function getCustomerById(customerId) {
  return readAccounts().find((account) => account.profile.id === customerId)?.profile || null;
}

function replaceLocalCustomerProfile(profile) {
  const accounts = readAccounts();
  const nextAccounts = accounts.map((account) =>
    account.profile.id === profile.id
      ? {
          ...account,
          profile,
          auth: {
            ...account.auth,
            email: profile.email,
          },
        }
      : account
  );

  writeAccounts(nextAccounts);
}

export function useCustomerSession() {
  const [session, setSession] = useState(readCustomerSession);
  const [customer, setCustomer] = useState(() => getCustomerById(readCustomerSession()?.customerId));

  useEffect(() => {
    let isMounted = true;

    async function syncLocalProfilesToSupabase() {
      try {
        const migratedProfiles = await migrateCustomerProfilesToSupabase(readAccounts());

        migratedProfiles.forEach(replaceLocalCustomerProfile);
      } catch (error) {
        console.warn(
          "Customer profile Supabase migration failed. Falling back to local customer profile data.",
          error
        );
      }
    }

    async function hydrateCustomerProfile(nextSession = readCustomerSession()) {
      if (!nextSession?.customerId) {
        if (isMounted) {
          setCustomer(null);
        }
        return;
      }

      const localProfile = getCustomerById(nextSession.customerId);
      if (isMounted) {
        setCustomer(localProfile);
      }

      try {
        await syncLocalProfilesToSupabase();
        const remoteProfile = await fetchCustomerByIdFromSupabase(nextSession.customerId);

        if (remoteProfile && readCustomerSession()?.customerId === nextSession.customerId && isMounted) {
          replaceLocalCustomerProfile(remoteProfile);
          setCustomer(remoteProfile);
        }
      } catch (error) {
        console.warn(
          "Customer profile Supabase sync failed. Falling back to local customer profile data.",
          error
        );
      }
    }

    function handleSessionUpdate() {
      const nextSession = readCustomerSession();
      setSession(nextSession);
      hydrateCustomerProfile(nextSession);
    }

    syncLocalProfilesToSupabase();
    hydrateCustomerProfile(session);

    window.addEventListener("storage", handleSessionUpdate);
    window.addEventListener(CUSTOMER_SESSION_EVENT, handleSessionUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleSessionUpdate);
      window.removeEventListener(CUSTOMER_SESSION_EVENT, handleSessionUpdate);
    };
  }, []);

  async function signUp({ firstName, lastName, email, phoneNumber, password, stayLoggedIn = true }) {
    const normalizedEmail = normalizeEmail(email);

    if (findAccountByEmail(normalizedEmail)) {
      return {
        ok: false,
        error: "An account already exists for that email.",
      };
    }

    try {
      const remoteCustomer = await fetchCustomerByEmailFromSupabase(normalizedEmail);

      if (remoteCustomer) {
        return {
          ok: false,
          error: "An account already exists for that email.",
        };
      }
    } catch (error) {
      console.warn(
        "Customer profile lookup in Supabase failed. Creating a local account and retrying profile sync later.",
        error
      );
    }

    const createdAt = new Date().toISOString();
    const profile = {
      id: createCustomerId(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      phoneNumber: phoneNumber.trim(),
      ...DEFAULT_COMMUNICATION_PREFERENCES,
    };
    const account = {
      profile,
      auth: {
        customerId: profile.id,
        email: normalizedEmail,
        password,
        createdAt,
      },
      extensions: {
        customerId: profile.id,
        orderHistory: [],
        favoriteOrders: [],
        loyaltyPoints: 0,
        rewards: [],
        promotions: [],
        cloverCustomerId: "",
        metadata: {},
      },
    };
    const nextAccounts = [...readAccounts(), account];
    const nextSession = {
      customerId: profile.id,
      email: normalizedEmail,
      authenticatedAt: createdAt,
    };

    writeAccounts(nextAccounts);

    let savedProfile = profile;

    try {
      savedProfile = await upsertCustomerToSupabase(profile);
      replaceLocalCustomerProfile(savedProfile);
    } catch (error) {
      console.warn(
        "Customer profile save to Supabase failed. Falling back to local customer profile data.",
        error
      );
    }

    setCustomer(savedProfile);
    setSession(nextSession);
    writeCustomerSession(nextSession, stayLoggedIn);

    return { ok: true, customer: savedProfile };
  }

  async function login(email, password, stayLoggedIn = true) {
    const account = findAccountByEmail(email);

    if (!account || account.auth.password !== password) {
      return {
        ok: false,
        error: "Email or password did not match a local account.",
      };
    }

    let nextSession = {
      customerId: account.profile.id,
      email: account.profile.email,
      authenticatedAt: new Date().toISOString(),
    };
    let profile = account.profile;

    try {
      await migrateCustomerProfilesToSupabase(readAccounts());
      profile =
        (await fetchCustomerByIdFromSupabase(account.profile.id)) ||
        (await fetchCustomerByEmailFromSupabase(account.profile.email)) ||
        account.profile;
      replaceLocalCustomerProfile(profile);
      nextSession = { ...nextSession, email: profile.email };
    } catch (error) {
      console.warn(
        "Customer profile load from Supabase failed. Falling back to local customer profile data.",
        error
      );
    }

    setCustomer(profile);
    setSession(nextSession);
    writeCustomerSession(nextSession, stayLoggedIn);

    return { ok: true, customer: profile };
  }

  function logout() {
    setCustomer(null);
    setSession(null);
    writeCustomerSession(null);
  }

  async function updateProfile(nextProfile) {
    if (!customer) {
      return { ok: false, error: "No customer is logged in." };
    }

    const accounts = readAccounts();
    const normalizedEmail = normalizeEmail(nextProfile.email);
    const emailOwner = accounts.find(
      (account) => account.profile.email === normalizedEmail && account.profile.id !== customer.id
    );

    if (emailOwner) {
      return { ok: false, error: "That email is already used by another account." };
    }

    try {
      const remoteEmailOwner = await fetchCustomerByEmailFromSupabase(normalizedEmail);

      if (remoteEmailOwner && remoteEmailOwner.id !== customer.id) {
        return { ok: false, error: "That email is already used by another account." };
      }
    } catch (error) {
      console.warn(
        "Customer profile email check in Supabase failed. Falling back to local customer profile validation.",
        error
      );
    }

    const updatedProfile = {
      id: customer.id,
      firstName: nextProfile.firstName.trim(),
      lastName: nextProfile.lastName.trim(),
      email: normalizedEmail,
      phoneNumber: nextProfile.phoneNumber.trim(),
      receiveLunchSpecials:
        nextProfile.receiveLunchSpecials ?? customer.receiveLunchSpecials ?? true,
      receivePromotions:
        nextProfile.receivePromotions ?? customer.receivePromotions ?? true,
      receivePickupNotifications:
        nextProfile.receivePickupNotifications ?? customer.receivePickupNotifications ?? true,
      receiveNewProductAnnouncements:
        nextProfile.receiveNewProductAnnouncements ?? customer.receiveNewProductAnnouncements ?? true,
    };
    let savedProfile = updatedProfile;
    const nextSession = session ? { ...session, email: normalizedEmail } : session;

    try {
      savedProfile = await upsertCustomerToSupabase(updatedProfile);
    } catch (error) {
      console.warn(
        "Customer profile save to Supabase failed. Falling back to local customer profile data.",
        error
      );
    }

    replaceLocalCustomerProfile(savedProfile);
    setCustomer(savedProfile);
    setSession(nextSession);
    writeCustomerSession(nextSession, Boolean(window.localStorage.getItem(CUSTOMER_SESSION_KEY)));

    return { ok: true, customer: savedProfile };
  }

  return {
    isAuthenticated: Boolean(customer && session),
    customer,
    session,
    signUp,
    login,
    logout,
    updateProfile,
  };
}
