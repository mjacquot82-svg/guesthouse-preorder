import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { useAdminSession } from "../stores/adminAuthStore.js";

export default function AdminLogin() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAdminSession();
  const [email, setEmail] = useState("owner@cedarandoak.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const redirectTo = location.state?.from || "/admin";

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError("Enter an email and temporary password.");
      return;
    }

    login(email.trim());
    navigate(redirectTo, { replace: true });
  }

  return (
    <section className="admin-login-page">
      <form className="admin-login-panel" onSubmit={handleSubmit}>
        <span className="admin-login-icon" aria-hidden="true">
          <LockKeyhole size={24} strokeWidth={2.4} />
        </span>
        <p className="eyebrow">Temporary access</p>
        <h1>Admin login</h1>
        <p>Use any email and password for now. This local session will be replaced later.</p>

        <label>
          <span>Email</span>
          <input
            autoComplete="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label>
          <span>Password</span>
          <input
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <button className="primary-button" type="submit">
          Sign in
        </button>
        {error ? <p className="form-status">{error}</p> : null}
      </form>
    </section>
  );
}
