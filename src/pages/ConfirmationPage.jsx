import { Link } from "react-router-dom";

export default function ConfirmationPage() {
  return (
    <section className="page-section compact-section">
      <div className="confirmation-panel">
        <p className="eyebrow">Confirmation</p>
        <h1>Order confirmation will appear here</h1>
        <p>
          This page is prepared for order receipts, guest details, pickup or
          delivery timing, and payment status.
        </p>
        <Link className="secondary-button" to="/">
          Return Home
        </Link>
      </div>
    </section>
  );
}
