import { useEffect, useState } from "react";

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
  return readJsonStorage(window.localStorage, CUSTOMER_ACCOUNTS_KEY, []);
}

function writeAccounts(accounts) {
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

export function useCustomerSession() {
  const [session, setSession] = useState(readCustomerSession);
  const [customer, setCustomer] = useState(() => getCustomerById(readCustomerSession()?.customerId));

  useEffect(() => {
    function handleSessionUpdate() {
      const nextSession = readCustomerSession();
      setSession(nextSession);
      setCustomer(getCustomerById(nextSession?.customerId));
    }

    window.addEventListener("storage", handleSessionUpdate);
    window.addEventListener(CUSTOMER_SESSION_EVENT, handleSessionUpdate);

    return () => {
      window.removeEventListener("storage", handleSessionUpdate);
      window.removeEventListener(CUSTOMER_SESSION_EVENT, handleSessionUpdate);
    };
  }, []);

  function signUp({ firstName, lastName, email, phoneNumber, password, stayLoggedIn = true }) {
    const normalizedEmail = normalizeEmail(email);

    if (findAccountByEmail(normalizedEmail)) {
      return {
        ok: false,
        error: "An account already exists for that email.",
      };
    }

    const createdAt = new Date().toISOString();
    const profile = {
      id: createCustomerId(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      phoneNumber: phoneNumber.trim(),
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
    setCustomer(profile);
    setSession(nextSession);
    writeCustomerSession(nextSession, stayLoggedIn);

    return { ok: true, customer: profile };
  }

  function login(email, password, stayLoggedIn = true) {
    const account = findAccountByEmail(email);

    if (!account || account.auth.password !== password) {
      return {
        ok: false,
        error: "Email or password did not match a local account.",
      };
    }

    const nextSession = {
      customerId: account.profile.id,
      email: account.profile.email,
      authenticatedAt: new Date().toISOString(),
    };

    setCustomer(account.profile);
    setSession(nextSession);
    writeCustomerSession(nextSession, stayLoggedIn);

    return { ok: true, customer: account.profile };
  }

  function logout() {
    setCustomer(null);
    setSession(null);
    writeCustomerSession(null);
  }

  function updateProfile(nextProfile) {
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

    const updatedProfile = {
      id: customer.id,
      firstName: nextProfile.firstName.trim(),
      lastName: nextProfile.lastName.trim(),
      email: normalizedEmail,
      phoneNumber: nextProfile.phoneNumber.trim(),
    };
    const nextAccounts = accounts.map((account) =>
      account.profile.id === customer.id
        ? {
            ...account,
            profile: updatedProfile,
            auth: {
              ...account.auth,
              email: normalizedEmail,
            },
          }
        : account
    );
    const nextSession = session ? { ...session, email: normalizedEmail } : session;

    writeAccounts(nextAccounts);
    setCustomer(updatedProfile);
    setSession(nextSession);
    writeCustomerSession(nextSession, Boolean(window.localStorage.getItem(CUSTOMER_SESSION_KEY)));

    return { ok: true, customer: updatedProfile };
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
