import { useEffect, useRef } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useOwnerAuth } from "./OwnerAuthContext.jsx";
import { ownerLoginDestination } from "./ownerAuthRouting.js";
import { canAccessOwnerPath } from "./ownerProductPermissions.js";

export default function RequireOwner() {
  const location = useLocation();
  const attempted = useRef(false);
  const { refreshSession, session, status } = useOwnerAuth();

  useEffect(() => {
    if (session || status === "loading" || attempted.current) return;
    attempted.current = true;
    refreshSession().catch(() => {});
  }, [refreshSession, session, status]);

  if (session && canAccessOwnerPath(session, location.pathname)) return <Outlet />;
  if (session) return <Navigate replace to="/owner/login?denied=1" />;
  if (status === "anonymous") {
    const returnTo = ownerLoginDestination(location);
    return <Navigate replace to={`/owner/login?returnTo=${encodeURIComponent(returnTo)}`} />;
  }
  return (
    <section className="page-section compact-section" aria-live="polite">
      <div className="operations-panel">
        <h1>Owner Portal</h1>
        <p>Checking your secure owner session…</p>
      </div>
    </section>
  );
}
