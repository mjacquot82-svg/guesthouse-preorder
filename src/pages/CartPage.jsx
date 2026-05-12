import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Minus, Plus, Trash2 } from "lucide-react";

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

function storeCart(cart) {
  window.localStorage.setItem("guesthouse-cart", JSON.stringify(cart));
}

export default function CartPage() {
  const [cart, setCart] = useState(getStoredCart);
  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  function updateQuantity(itemId, nextQuantity) {
    const nextCart =
      nextQuantity <= 0
        ? cart.filter((item) => item.id !== itemId)
        : cart.map((item) => (item.id === itemId ? { ...item, quantity: nextQuantity } : item));

    setCart(nextCart);
    storeCart(nextCart);
  }

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
    <section className="page-section ordering-page cart-page">
      <div className="page-heading cart-heading">
        <h1>Your order</h1>
        <p>Review your pantry picks before sending them to the guesthouse team.</p>
      </div>

      <div className="content-block cart-review app-cart-review">
        <ul>
          {cart.map((item) => (
            <li key={item.id}>
              <div className="cart-item-copy">
                <strong>{item.name}</strong>
                {item.options?.length ? (
                  <small>
                    {item.options.map((option) => `${option.groupName}: ${option.name}`).join(", ")}
                  </small>
                ) : null}
                <span>
                  {item.quantity} x {formatPrice(item.price)}
                </span>
              </div>
              <div className="cart-line-actions">
                <strong>{formatPrice(item.price * item.quantity)}</strong>
                <div className="quantity-stepper" aria-label={`Quantity for ${item.name}`}>
                  <button
                    type="button"
                    aria-label={`Remove one ${item.name}`}
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  >
                    <Minus size={16} />
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    type="button"
                    aria-label={`Add one ${item.name}`}
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <button
                  className="remove-cart-item"
                  type="button"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => updateQuantity(item.id, 0)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
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
