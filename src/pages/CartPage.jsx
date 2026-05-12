import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

function formatPrice(price) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

function getStoredCart() {
  try {
    return JSON.parse(window.localStorage.getItem("guesthouse-cart")) || [];
  } catch {
    return [];
  }
}

export default function CartPage() {
  const [cart] = useState(getStoredCart);
  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  if (!cart.length) {
    return (
      <section className="page-section compact-section ordering-page">
        <div className="empty-state">
          <h1>Your cart is empty</h1>
          <p>Add coffee, tea, pastries, or a little flavour shot when you are ready.</p>
          <Link className="primary-button" to="/menu">
            Browse menu
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="page-section ordering-page">
      <div className="page-heading">
        <h1>Your order</h1>
        <p>Review your guesthouse coffee bar picks before sending them to the pantry.</p>
      </div>

      <div className="content-block cart-review">
        <ul>
          {cart.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>
                  {item.quantity} x {formatPrice(item.price)}
                </span>
              </div>
              <strong>{formatPrice(item.price * item.quantity)}</strong>
            </li>
          ))}
        </ul>
        <div className="cart-total-row">
          <span>Estimated total</span>
          <strong>{formatPrice(total)}</strong>
        </div>
        <Link className="primary-button" to="/confirmation">
          Send order
        </Link>
      </div>
    </section>
  );
}
