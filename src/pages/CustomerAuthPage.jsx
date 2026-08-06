import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCustomerAuth } from "../auth/CustomerAuthContext.jsx";
import { registerCustomer, resendCustomerVerification } from "../services/customerAuthApi.js";
import { getCustomerErrorMessage } from "../services/customerMessages.js";
import { formatCustomerPhone, isCompleteCustomerPhone, normalizeCustomerPhone } from "../services/customerPhone.js";

export default function CustomerAuthPage({ mode }) {
  const navigate = useNavigate();
  const { login } = useCustomerAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [status, setStatus] = useState("");
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const creating = mode === "register";
  async function submit(event) {
    event.preventDefault();
    if (isSubmitting) return;
    setStatus(""); setVerificationRequired(false); setIsSubmitting(true);
    try {
      if (creating) {
        if (!isCompleteCustomerPhone(form.phone)) {
          setStatus("Enter a complete 10-digit phone number.");
          return;
        }
        const result = await registerCustomer(form.name, form.email, form.password, normalizeCustomerPhone(form.phone));
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
        setStatus(getCustomerErrorMessage(error, creating ? "We couldn’t create your account. Please try again." : "We couldn’t sign you in. Please try again."));
      }
    } finally {
      setIsSubmitting(false);
    }
  }
  async function resendVerification() {
    if (isResending) return;
    setStatus("");
    setIsResending(true);
    try {
      const result = await resendCustomerVerification(form.email);
      setStatus(result.message);
    } catch (error) {
      setStatus(getCustomerErrorMessage(error, "We couldn’t resend the verification email. Please try again."));
    } finally {
      setIsResending(false);
    }
  }
  return (
    <section className="page-section compact-section ordering-page">
      <div className="operations-panel">
        <p className="eyebrow">Customer account</p>
        <h1>{creating ? "Create Account" : "Sign In"}</h1>
        <p>{creating ? "Save your details for faster checkout and order history." : "Welcome back to The Guest House."}</p>
        <form className="product-form" aria-busy={isSubmitting || isResending} onSubmit={submit}>
          {creating ? <label><span>Name</span><input autoComplete="name" disabled={isSubmitting} required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label> : null}
          <label><span>Email</span><input autoComplete="email" disabled={isSubmitting || isResending} required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          {creating ? <label><span>Phone</span><input autoComplete="tel" disabled={isSubmitting} inputMode="numeric" pattern="\(\d{3}\) \d{3}-\d{4}" placeholder="(519) 881-6869" required type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: formatCustomerPhone(event.target.value) })} /></label> : null}
          <label><span>Password</span><input autoComplete={creating ? "new-password" : "current-password"} disabled={isSubmitting} minLength={creating ? 12 : 8} required type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          {!creating ? <label className="auth-checkbox"><input checked={keepSignedIn} disabled={isSubmitting} type="checkbox" onChange={(event) => setKeepSignedIn(event.target.checked)} /><span>Keep me signed in</span></label> : null}
          <button className="primary-button" disabled={isSubmitting || isResending} type="submit">{isSubmitting ? (creating ? "Creating account…" : "Signing in…") : (creating ? "Create Account" : "Sign In")}</button>
          {status ? <p className="form-status" role={verificationRequired ? "alert" : "status"} aria-live="polite">{status}</p> : null}
          {verificationRequired ? <button className="secondary-button" disabled={isSubmitting || isResending} type="button" onClick={resendVerification}>{isResending ? "Sending…" : "Resend verification email"}</button> : null}
        </form>
        <div className="form-actions">
          <Link className="secondary-button" to={creating ? "/account/sign-in" : "/account/create"}>{creating ? "Sign In" : "Create Account"}</Link>
          {!creating ? <Link to="/account/reset-password">Forgot password?</Link> : null}
        </div>
      </div>
    </section>
  );
}
