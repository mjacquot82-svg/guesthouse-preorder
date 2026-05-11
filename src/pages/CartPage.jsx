import { Link } from "react-router-dom";

export default function CartPage() {
  return (
    <section className="page-section compact-section">
      <div className="empty-state">
        <p className="eyebrow">Cart</p>
        <h1>Your preorder cart is empty</h1>
        <p>Add breakfast, lunch, drinks, or guesthouse specials when the menu is ready.</p>
        <Link className="secondary-button" to="/menu">
          Browse Menu
        </Link>
      </div>
    </section>
  );
}
