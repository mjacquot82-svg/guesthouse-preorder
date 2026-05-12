import { Link } from "react-router-dom";
import { Bell, DoorOpen, UserRound } from "lucide-react";

export default function AccountPage() {
  return (
    <section className="page-section ordering-page app-simple-page">
      <div className="ordering-top-card compact-app-heading">
        <div>
          <p className="eyebrow">Guest profile</p>
          <h1>Account</h1>
          <p>Room ordering preferences for your guesthouse stay.</p>
        </div>
      </div>

      <div className="content-block app-content-block account-card">
        <span className="account-avatar" aria-hidden="true">
          <UserRound size={24} strokeWidth={2.4} />
        </span>
        <div>
          <h2>Guest room</h2>
          <p>Saved for fast pantry checkout.</p>
        </div>
      </div>

      <div className="account-settings-list">
        <div className="compact-info-row content-block app-content-block">
          <DoorOpen size={18} strokeWidth={2.4} />
          <span>Deliver to room</span>
          <strong>On</strong>
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
