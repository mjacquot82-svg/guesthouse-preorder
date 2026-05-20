import { Link } from "react-router-dom";

export default function ConfirmationPage() {
  return (
    <section className="page-section compact-section ordering-page">
      <div className="confirmation-panel">
        <h1>Order received</h1>
        <p>
          Confirmation details, timing, and pickup notes will appear here.
        </p>
        <Link className="secondary-button" to="/">
          Return Home
        </Link>
      </div>
    </section>
  );
}
