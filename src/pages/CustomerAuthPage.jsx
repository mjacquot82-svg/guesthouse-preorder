import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCustomerAuth } from "../auth/CustomerAuthContext.jsx";
import { registerCustomer, resendCustomerVerification } from "../services/customerAuthApi.js";

export default function CustomerAuthPage({ mode }) {
  const navigate = useNavigate();
  const { login } = useCustomerAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [status, setStatus] = useState("");
  const [verificationRequired, setVerificationRequired] = useState(false);
  const creating = mode === "register";
  async function submit(event) {
    event.preventDefault(); setStatus(""); setVerificationRequired(false);
    try {
      if (creating) {
        const result = await registerCustomer(form.name, form.email, form.password);
        setStatus(result.message);
      } else {
        await login(form.email, form.password, keepSignedIn);
        navigate("/account", { replace: true });
      }
    } catch (error) {
      if (!creating && error.code === "email_verification_required") {
        setVerificationRequired(true);
        setStatus("This email address has not been verified.");
      } else {
        setStatus(error.message);
      }
    }
  }
  async function resendVerification() {
    setStatus("");
    try {
      const result = await resendCustomerVerification(form.email);
      setStatus(result.message);
    } catch (error) {
      setStatus(error.message);
    }
  }
  return (
    <section className="page-section compact-section ordering-page">
      <div className="operations-panel">
        <p className="eyebrow">Customer account</p>
        <h1>{creating ? "Create Account" : "Sign In"}</h1>
        <p>{creating ? "Save your details for faster checkout and order history." : "Welcome back to The Guest House."}</p>
        <form className="product-form" onSubmit={submit}>
          {creating ? <label><span>Name</span><input autoComplete="name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label> : null}
          <label><span>Email</span><input autoComplete="email" required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label><span>Password</span><input autoComplete={creating ? "new-password" : "current-password"} minLength={creating ? 15 : 8} required type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          {!creating ? <label className="auth-checkbox"><input checked={keepSignedIn} type="checkbox" onChange={(event) => setKeepSignedIn(event.target.checked)} /><span>Keep me signed in</span></label> : null}
          <button className="primary-button" type="submit">{creating ? "Create Account" : "Sign In"}</button>
          {status ? <p className="form-status" role="status">{status}</p> : null}
          {verificationRequired ? <button className="secondary-button" type="button" onClick={resendVerification}>Resend verification email</button> : null}
        </form>
        <div className="form-actions">
          <Link className="secondary-button" to={creating ? "/account/sign-in" : "/account/create"}>{creating ? "Sign In" : "Create Account"}</Link>
          {!creating ? <Link to="/account/reset-password">Forgot password?</Link> : null}
        </div>
      </div>
    </section>
  );
}
