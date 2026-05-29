import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Bell, Coffee, Gift, History, LogOut, Megaphone, UserRound } from "lucide-react";
import { useCustomerSession } from "../stores/customerAuthStore.js";

export default function AccountPage() {
  const navigate = useNavigate();
  const { customer, isAuthenticated, logout, updateProfile } = useCustomerSession();
  const [form, setForm] = useState(() => ({
    firstName: customer?.firstName || "",
    lastName: customer?.lastName || "",
    email: customer?.email || "",
    phoneNumber: customer?.phoneNumber || "",
    receiveLunchSpecials: customer?.receiveLunchSpecials ?? true,
    receivePromotions: customer?.receivePromotions ?? true,
    receivePickupNotifications: customer?.receivePickupNotifications ?? true,
    receiveNewProductAnnouncements: customer?.receiveNewProductAnnouncements ?? true,
  }));
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!customer || isSubmitting) {
      return;
    }

    setForm({
      firstName: customer.firstName || "",
      lastName: customer.lastName || "",
      email: customer.email || "",
      phoneNumber: customer.phoneNumber || "",
      receiveLunchSpecials: customer.receiveLunchSpecials ?? true,
      receivePromotions: customer.receivePromotions ?? true,
      receivePickupNotifications: customer.receivePickupNotifications ?? true,
      receiveNewProductAnnouncements: customer.receiveNewProductAnnouncements ?? true,
    });
  }, [customer, isSubmitting]);

  if (!isAuthenticated) {
    return <Navigate to="/account/login" replace state={{ from: "/account" }} />;
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.phoneNumber.trim()) {
      setStatus("Complete all profile fields.");
      return;
    }

    setIsSubmitting(true);
    const result = await updateProfile(form);
    setIsSubmitting(false);
    setStatus(result.ok ? "Profile saved." : result.error);
  }

  function handleLogout() {
    logout();
    navigate("/account/login", { replace: true });
  }

  return (
    <section className="page-section ordering-page app-simple-page account-page">
      <div className="ordering-top-card compact-app-heading">
        <div>
          <p className="eyebrow">Cafe profile</p>
          <h1>Account</h1>
          <p>Your saved customer identity for faster café checkout.</p>
        </div>
      </div>

      <form className="content-block app-content-block account-profile-form" onSubmit={handleSubmit}>
        <div className="account-profile-heading">
          <span className="account-avatar" aria-hidden="true">
            <UserRound size={24} strokeWidth={2.4} />
          </span>
          <div>
            <h2>
              {customer.firstName} {customer.lastName}
            </h2>
            <p>{customer.email}</p>
          </div>
        </div>

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

        <div className="communication-preferences-section">
          <div className="communication-preferences-heading">
            <span className="account-avatar" aria-hidden="true">
              <Bell size={22} strokeWidth={2.4} />
            </span>
            <div>
              <h3>Communication Preferences</h3>
              <p>Choose which Cedar & Oak updates you want to receive.</p>
            </div>
          </div>

          <div className="communication-preferences-grid">
            <label className="communication-preference-row">
              <input
                checked={form.receiveLunchSpecials}
                type="checkbox"
                onChange={(event) => updateField("receiveLunchSpecials", event.target.checked)}
              />
              <span>Receive Lunch Specials</span>
            </label>
            <label className="communication-preference-row">
              <input
                checked={form.receivePromotions}
                type="checkbox"
                onChange={(event) => updateField("receivePromotions", event.target.checked)}
              />
              <span>Receive Promotions</span>
            </label>
            <label className="communication-preference-row">
              <input
                checked={form.receivePickupNotifications}
                type="checkbox"
                onChange={(event) => updateField("receivePickupNotifications", event.target.checked)}
              />
              <span>Receive Pickup Notifications</span>
            </label>
            <label className="communication-preference-row">
              <input
                checked={form.receiveNewProductAnnouncements}
                type="checkbox"
                onChange={(event) =>
                  updateField("receiveNewProductAnnouncements", event.target.checked)
                }
              />
              <span>Receive New Product Announcements</span>
            </label>
          </div>
        </div>

        <div className="account-profile-actions">
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            Save profile
          </button>
          <button className="secondary-button" type="button" onClick={handleLogout}>
            <LogOut size={17} strokeWidth={2.4} />
            Logout
          </button>
        </div>
        {status ? <p className="form-status">{status}</p> : null}
      </form>

      <div className="account-settings-list">
        <Link className="compact-info-row content-block app-content-block" to="/account/orders">
          <History size={18} strokeWidth={2.4} />
          <span>Order history</span>
          <strong>View</strong>
        </Link>
        <div className="compact-info-row content-block app-content-block">
          <Coffee size={18} strokeWidth={2.4} />
          <span>Favorite orders</span>
          <strong>Ready later</strong>
        </div>
        <div className="compact-info-row content-block app-content-block">
          <Gift size={18} strokeWidth={2.4} />
          <span>Loyalty points</span>
          <strong>Ready later</strong>
        </div>
        <div className="compact-info-row content-block app-content-block">
          <Megaphone size={18} strokeWidth={2.4} />
          <span>Rewards and promos</span>
          <strong>{form.receivePromotions ? "On" : "Off"}</strong>
        </div>
      </div>

      <Link className="secondary-button account-admin-link" to="/admin">
        Staff admin
      </Link>
    </section>
  );
}
