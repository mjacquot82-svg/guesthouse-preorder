import { Link } from "react-router-dom";
import { Bell, Coffee, UserRound } from "lucide-react";

export default function AccountPage() {
  return (
    <section className="page-section ordering-page app-simple-page">
      <div className="ordering-top-card compact-app-heading">
        <div>
          <p className="eyebrow">Cafe profile</p>
          <h1>Account</h1>
          <p>Your saved preferences for faster café checkout.</p>
        </div>
      </div>

      <div className="content-block app-content-block account-card">
        <span className="account-avatar" aria-hidden="true">
          <UserRound size={24} strokeWidth={2.4} />
        </span>
        <div>
          <h2>Favorite order</h2>
          <p>Saved for a smoother coffee run.</p>
        </div>
      </div>

      <div className="account-settings-list">
        <div className="compact-info-row content-block app-content-block">
          <Coffee size={18} strokeWidth={2.4} />
          <span>Favorite milk</span>
          <strong>Oat</strong>
        </div>
        <div className="compact-info-row content-block app-content-block">
          <Bell size={18} strokeWidth={2.4} />
          <span>Order updates</span>
          <strong>Enabled</strong>
        </div>
      </div>

      <Link className="secondary-button account-admin-link" to="/admin">
        Staff admin
      </Link>
    </section>
  );
}
