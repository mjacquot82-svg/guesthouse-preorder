import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { verifyCustomerEmail } from "../services/customerAuthApi.js";

export default function CustomerVerifyPage() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState("Verifying your email…");
  useEffect(() => {
    const token = params.get("token_hash");
    if (!token) { setStatus("This verification link is incomplete."); return; }
    verifyCustomerEmail(token).then((result) => setStatus(result.message)).catch((error) => setStatus(error.message));
  }, [params]);
  return <section className="page-section compact-section ordering-page"><div className="operations-panel"><h1>Email verification</h1><p role="status">{status}</p><Link className="primary-button" to="/login">Sign In</Link></div></section>;
}
