import { useEffect, useState } from "react";

const ADMIN_SESSION_KEY = "cafe-admin-session";
const ADMIN_SESSION_EVENT = "cafe-admin-session-updated";

function readAdminSession() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return JSON.parse(window.localStorage.getItem(ADMIN_SESSION_KEY));
  } catch {
    return null;
  }
}

function writeAdminSession(session) {
  if (!session) {
    window.localStorage.removeItem(ADMIN_SESSION_KEY);
  } else {
    window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  }

  window.dispatchEvent(new CustomEvent(ADMIN_SESSION_EVENT));
}

export function useAdminSession() {
  const [session, setSession] = useState(readAdminSession);

  useEffect(() => {
    function handleSessionUpdate() {
      setSession(readAdminSession());
    }

    window.addEventListener("storage", handleSessionUpdate);
    window.addEventListener(ADMIN_SESSION_EVENT, handleSessionUpdate);

    return () => {
      window.removeEventListener("storage", handleSessionUpdate);
      window.removeEventListener(ADMIN_SESSION_EVENT, handleSessionUpdate);
    };
  }, []);

  function login(email) {
    const nextSession = {
      email,
      role: "owner",
      authenticatedAt: new Date().toISOString(),
    };

    setSession(nextSession);
    writeAdminSession(nextSession);
  }

  function logout() {
    setSession(null);
    writeAdminSession(null);
  }

  return {
    isAuthenticated: Boolean(session),
    session,
    login,
    logout,
  };
}
