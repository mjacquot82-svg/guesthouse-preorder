import { useEffect, useRef } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useOwnerAuth } from "./OwnerAuthContext.jsx";
import { ownerLoginDestination } from "./ownerAuthRouting.js";
import { canAccessOwnerPath, operationsLinks } from "./ownerProductPermissions.js";

export default function RequireOwner() {
  const location = useLocation();
  const navigate = useNavigate();
  const attempted = useRef(false);
  const { logout, refreshSession, session, status } = useOwnerAuth();

  async function signOut() {
    await logout();
    navigate(session?.role === "staff" ? "/staff" : "/owner/login", { replace: true });
  }

  useEffect(() => {
    if (session || status === "loading" || attempted.current) return;
    attempted.current = true;
    refreshSession().catch(() => {});
  }, [refreshSession, session, status]);

  if (session && canAccessOwnerPath(session, location.pathname)) return <>
    <nav className="admin-links operations-nav" aria-label="Operations Portal navigation">
      {operationsLinks(session).map((link) => <NavLink end={link.end} key={link.to} to={link.to}>{link.label}</NavLink>)}
      <button className="operations-nav-signout" type="button" onClick={signOut}>Sign out</button>
    </nav>
    <Outlet />
  </>;
  if (session) return <Navigate replace to={operationsLinks(session)[0]?.to || "/owner/login?denied=1"} />;
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
