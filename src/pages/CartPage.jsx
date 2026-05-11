import { Link } from "react-router-dom";

export default function CartPage() {
  return (
    <section className="page-section compact-section ordering-page">
      <div className="empty-state">
        <h1>Your cart is empty</h1>
        <p>Add coffee, drinks, snacks, or light breakfast items when you are ready.</p>
        <Link className="primary-button" to="/menu">
          Browse menu
        </Link>
      </div>
    </section>
  );
}
