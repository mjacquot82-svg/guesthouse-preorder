import { Link } from "react-router-dom";
import { Clock3, ReceiptText } from "lucide-react";

export default function OrdersPageMobile() {
  return (
    <section className="page-section ordering-page app-simple-page">
      <div className="ordering-top-card compact-app-heading">
        <div>
          <p className="eyebrow">Order updates</p>
          <h1>Orders</h1>
          <p>Track your café orders and pickup timing.</p>
        </div>
      </div>

      <div className="content-block app-content-block app-status-card">
        <span className="status-icon" aria-hidden="true">
          <ReceiptText size={20} strokeWidth={2.4} />
        </span>
        <div>
          <h2>No active orders</h2>
          <p>Your next coffee or breakfast order will appear here after checkout.</p>
        </div>
        <Link className="primary-button" to="/menu">
          Browse menu
        </Link>
      </div>

      <div className="content-block app-content-block compact-info-row">
        <Clock3 size={18} strokeWidth={2.4} />
        <span>Typical pickup: 15-25 minutes</span>
      </div>
    </section>
  );
}
