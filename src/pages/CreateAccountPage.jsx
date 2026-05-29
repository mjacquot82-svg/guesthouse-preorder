import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { useCustomerSession } from "../stores/customerAuthStore.js";

export default function CreateAccountPage() {
  const navigate = useNavigate();
  const { isAuthenticated, signUp } = useCustomerSession();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    password: "",
    stayLoggedIn: true,
  });
  const [error, setError] = useState("");

  if (isAuthenticated) {
    return <Navigate to="/account" replace />;
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !form.email.trim() ||
      !form.phoneNumber.trim() ||
      !form.password
    ) {
      setError("Complete all account fields.");
      return;
    }

    const result = signUp(form);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    navigate("/account", { replace: true });
  }

  return (
    <section className="page-section ordering-page account-auth-page">
      <form className="content-block app-content-block account-auth-panel" onSubmit={handleSubmit}>
        <span className="account-avatar" aria-hidden="true">
          <UserPlus size={24} strokeWidth={2.4} />
        </span>
        <p className="eyebrow">Customer account</p>
        <h1>Create account</h1>
        <p>Save your contact details for quicker Cedar & Oak orders.</p>

        <div className="account-form-grid">
          <label>
            <span>First name</span>
            <input
              autoComplete="given-name"
              value={form.firstName}
              onChange={(event) => updateField("firstName", event.target.value)}
            />
          </label>
          <label>
            <span>Last name</span>
            <input
              autoComplete="family-name"
              value={form.lastName}
              onChange={(event) => updateField("lastName", event.target.value)}
            />
          </label>
        </div>

        <label>
          <span>Email</span>
          <input
            autoComplete="email"
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
          />
        </label>

        <label>
          <span>Phone</span>
          <input
            autoComplete="tel"
            type="tel"
            value={form.phoneNumber}
            onChange={(event) => updateField("phoneNumber", event.target.value)}
          />
        </label>

        <label>
          <span>Password</span>
          <input
            autoComplete="new-password"
            type="password"
            value={form.password}
            onChange={(event) => updateField("password", event.target.value)}
          />
        </label>

        <label className="account-check-row">
          <input
            checked={form.stayLoggedIn}
            type="checkbox"
            onChange={(event) => updateField("stayLoggedIn", event.target.checked)}
          />
          <span>Stay logged in</span>
        </label>

        <button className="primary-button" type="submit">
          Create account
        </button>
        {error ? <p className="form-status">{error}</p> : null}
        <p className="account-auth-switch">
          Already have an account? <Link to="/account/login">Log in</Link>
        </p>
      </form>
    </section>
  );
}
