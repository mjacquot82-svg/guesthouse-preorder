import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UserRound } from "lucide-react";
import { useCustomerAuth } from "../auth/CustomerAuthContext.jsx";
import { fetchCustomerProfile, updateCustomerProfile } from "../services/customerAccountApi.js";

export default function AccountPage() {
  const { logout, session, status: authStatus } = useCustomerAuth();
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (session) fetchCustomerProfile().then(setProfile).catch((error) => setMessage(error.message));
  }, [session]);
  if (authStatus === "loading") return <section className="page-section compact-section"><p>Checking your account…</p></section>;
  if (!session) return (
    <section className="page-section ordering-page app-simple-page">
      <div className="ordering-top-card compact-app-heading"><div><p className="eyebrow">Cafe profile</p><h1>Account</h1><p>Sign in for faster checkout and your order history.</p></div></div>
      <div className="content-block app-content-block account-card"><span className="account-avatar"><UserRound size={24} /></span><div><h2>Guest ordering is always available</h2><p>Create an account only if you want saved details and order history.</p></div></div>
      <div className="form-actions"><Link className="primary-button" to="/login">Sign In</Link><Link className="secondary-button" to="/register">Create Account</Link></div>
    </section>
  );
  async function save(event) {
    event.preventDefault(); setMessage("");
    try { setProfile(await updateCustomerProfile(profile, session.csrf_token)); setMessage("Profile saved."); }
    catch (error) { setMessage(error.message); }
  }
  return (
    <section className="page-section ordering-page app-simple-page">
      <div className="ordering-top-card compact-app-heading"><div><p className="eyebrow">Cafe profile</p><h1>Account</h1><p>Your defaults for faster checkout.</p></div></div>
      {profile ? <form className="content-block app-content-block product-form" onSubmit={save}>
        <label><span>Name</span><input required value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label>
        <label><span>Email</span><input disabled value={profile.email} /></label>
        <label><span>Phone</span><input required type="tel" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label>
        <label><span>Preferred pickup lead time</span><select value={profile.preferred_pickup_minutes ?? ""} onChange={(event) => setProfile({ ...profile, preferred_pickup_minutes: event.target.value ? Number(event.target.value) : null })}><option value="">No preference</option><option value="10">10 minutes</option><option value="20">20 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option></select></label>
        <label><span>Preferred pickup information</span><textarea maxLength={500} rows="3" value={profile.preferred_pickup_notes} onChange={(event) => setProfile({ ...profile, preferred_pickup_notes: event.target.value })} /></label>
        <button className="primary-button" type="submit">Save profile</button>{message ? <p className="form-status">{message}</p> : null}
      </form> : <p>Loading your profile…</p>}
      <div className="form-actions"><Link className="secondary-button" to="/orders">Order history</Link><button className="secondary-button" type="button" onClick={logout}>Sign out</button></div>
    </section>
  );
}
