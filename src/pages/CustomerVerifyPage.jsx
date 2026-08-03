import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resendCustomerVerification, verifyCustomerEmail } from "../services/customerAuthApi.js";

export default function CustomerVerifyPage() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState("Verifying your email…");
  const [email, setEmail] = useState("");
  const [canResend, setCanResend] = useState(false);
  useEffect(() => {
    const token = params.get("token_hash");
    if (!token) { setStatus("This verification link is incomplete."); setCanResend(true); return; }
    verifyCustomerEmail(token)
      .then((result) => setStatus(result.message))
      .catch((error) => { setStatus(error.message); setCanResend(error.code === "verification_invalid"); });
  }, [params]);
  async function resendVerification(event) {
    event.preventDefault();
    try {
      const result = await resendCustomerVerification(email);
      setStatus(result.message);
    } catch (error) {
      setStatus(error.message);
    }
  }
  return <section className="page-section compact-section ordering-page"><div className="operations-panel"><h1>Email verification</h1><p role="status">{status}</p>{canResend ? <form className="product-form" onSubmit={resendVerification}><label><span>Email</span><input autoComplete="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><button className="secondary-button" type="submit">Resend verification email</button></form> : null}<Link className="primary-button" to="/login">Sign In</Link></div></section>;
}
