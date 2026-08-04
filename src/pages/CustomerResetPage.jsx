import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { completeCustomerPasswordReset, requestCustomerPasswordReset } from "../services/customerAuthApi.js";
import { getCustomerErrorMessage } from "../services/customerMessages.js";

export default function CustomerResetPage() {
  const [params] = useSearchParams();
  const recoveryParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const tokenHash = params.get("token_hash");
  const recoveryAccessToken = recoveryParams.get("access_token");
  const hasRecovery = Boolean(tokenHash || recoveryAccessToken);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (isSubmitting) return;
    setStatus("");
    setIsSubmitting(true);
    try {
      const result = hasRecovery
        ? await completeCustomerPasswordReset({ accessToken: recoveryAccessToken, password: value, tokenHash })
        : await requestCustomerPasswordReset(value);
      setStatus(result.message);
    } catch (error) {
      setStatus(getCustomerErrorMessage(error, hasRecovery ? "We couldn’t update your password. Please try again." : "We couldn’t send the reset link. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  }
  return <section className="page-section compact-section ordering-page"><div className="operations-panel"><h1>{hasRecovery ? "Choose a new password" : "Reset password"}</h1><form className="product-form" aria-busy={isSubmitting} onSubmit={submit}><label><span>{hasRecovery ? "New password" : "Email"}</span><input autoComplete={hasRecovery ? "new-password" : "email"} disabled={isSubmitting} required minLength={hasRecovery ? 15 : undefined} type={hasRecovery ? "password" : "email"} value={value} onChange={(event) => setValue(event.target.value)} /></label><button className="primary-button" disabled={isSubmitting} type="submit">{isSubmitting ? (hasRecovery ? "Updating…" : "Sending…") : (hasRecovery ? "Update password" : "Send reset link")}</button>{status ? <p className="form-status" aria-live="polite">{status}</p> : null}</form><Link to="/login">Return to sign in</Link></div></section>;
}
