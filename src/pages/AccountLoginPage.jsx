import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { useCustomerSession } from "../stores/customerAuthStore.js";

export default function AccountLoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, login } = useCustomerSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [error, setError] = useState("");
  const redirectTo = location.state?.from || "/account";

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    const result = login(email, password, stayLoggedIn);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    navigate(redirectTo, { replace: true });
  }

  return (
    <section className="page-section ordering-page account-auth-page">
      <form className="content-block app-content-block account-auth-panel" onSubmit={handleSubmit}>
        <span className="account-avatar" aria-hidden="true">
          <LogIn size={24} strokeWidth={2.4} />
        </span>
        <p className="eyebrow">Customer account</p>
        <h1>Log in</h1>
        <p>Use your Cedar & Oak account for faster checkout.</p>

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

        <label className="account-check-row">
          <input
            checked={stayLoggedIn}
            type="checkbox"
            onChange={(event) => setStayLoggedIn(event.target.checked)}
          />
          <span>Stay logged in</span>
        </label>

        <button className="primary-button" type="submit">
          Log in
        </button>
        {error ? <p className="form-status">{error}</p> : null}
        <p className="account-auth-switch">
          New here? <Link to="/account/create">Create an account</Link>
        </p>
      </form>
    </section>
  );
}
