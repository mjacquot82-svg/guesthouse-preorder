import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { completeCustomerPasswordReset, requestCustomerPasswordReset } from "../services/customerAuthApi.js";

export default function CustomerResetPage() {
  const [params] = useSearchParams();
  const token = params.get("token_hash");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("");
  async function submit(event) {
    event.preventDefault();
    try {
      const result = token ? await completeCustomerPasswordReset(token, value) : await requestCustomerPasswordReset(value);
      setStatus(result.message);
    } catch (error) { setStatus(error.message); }
  }
  return <section className="page-section compact-section ordering-page"><div className="operations-panel"><h1>{token ? "Choose a new password" : "Reset password"}</h1><form className="product-form" onSubmit={submit}><label><span>{token ? "New password" : "Email"}</span><input required minLength={token ? 15 : undefined} type={token ? "password" : "email"} value={value} onChange={(event) => setValue(event.target.value)} /></label><button className="primary-button" type="submit">{token ? "Update password" : "Send reset link"}</button>{status ? <p className="form-status">{status}</p> : null}</form><Link to="/login">Return to sign in</Link></div></section>;
}
