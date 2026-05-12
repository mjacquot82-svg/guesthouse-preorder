import { Link } from "react-router-dom";
import { Clock3, ReceiptText } from "lucide-react";

export default function OrdersPageMobile() {
  return (
    <section className="page-section ordering-page app-simple-page">
      <div className="ordering-top-card compact-app-heading">
        <div>
          <p className="eyebrow">Room service</p>
          <h1>Orders</h1>
          <p>Track pantry requests placed from this guest room.</p>
        </div>
      </div>

      <div className="content-block app-content-block app-status-card">
        <span className="status-icon" aria-hidden="true">
          <ReceiptText size={20} strokeWidth={2.4} />
        </span>
        <div>
          <h2>No active orders</h2>
          <p>Your next coffee or breakfast tray will appear here after checkout.</p>
        </div>
        <Link className="primary-button" to="/menu">
          Browse menu
        </Link>
      </div>

      <div className="content-block app-content-block compact-info-row">
        <Clock3 size={18} strokeWidth={2.4} />
        <span>Typical delivery: 15-25 minutes</span>
      </div>
    </section>
  );
}
