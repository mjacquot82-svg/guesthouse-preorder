import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { getCategoryById } from "../data/catalog.js";
import { useCatalogProducts } from "../stores/catalogStore.js";

function formatPrice(price) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

function getStoredCart() {
  try {
    return JSON.parse(window.localStorage.getItem("cafe-cart")) || [];
  } catch {
    return [];
  }
}

export default function HomePage() {
  const { products } = useCatalogProducts();
  const [cart] = useState(getStoredCart);
  const availableProducts = products.filter((product) => product.available);
  const popularItems = availableProducts.filter((product) => product.featured).slice(0, 4);
  const coffeeCount = availableProducts.filter((product) =>
    ["coffee", "espresso", "tea", "iced-drinks"].includes(product.category)
  ).length;
  const cartCount = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart]
  );
  const cartTotal = useMemo(
    () => cart.reduce((total, item) => total + item.price * item.quantity, 0),
    [cart]
  );

  return (
    <section className="home-page ordering-page">
      <div className="welcome-panel app-welcome-panel">
        <div>
          <p className="eyebrow">Coffee bar</p>
          <h1>Fresh café rituals, made easy</h1>
          <p>Seasonal pours, bakery favorites, and quiet coffee bar classics.</p>
        </div>
        <div className="cafe-hero-image" aria-hidden="true" />
        <div className="welcome-actions">
          <Link className="primary-button" to="/menu">
            Browse menu
          </Link>
          <span>{coffeeCount} crafted drinks</span>
        </div>
      </div>

      <div className="home-order-status" aria-live="polite">
        <div>
          <ShoppingBag size={18} strokeWidth={2.4} />
          <span>Your café bag</span>
        </div>
        <Link to="/cart">
          {cartCount} {cartCount === 1 ? "item" : "items"} · {formatPrice(cartTotal)}
        </Link>
      </div>

      <section className="content-block app-content-block cafe-favorites-block" aria-labelledby="popular-heading">
        <div className="section-heading">
          <h2 id="popular-heading">Café favorites</h2>
        </div>

        <div className="item-list compact-item-list">
          {popularItems.slice(0, 3).map((item) => (
            <article className="item-row" key={item.name}>
              <div className={`item-thumb item-thumb-${item.image}`} aria-hidden="true" />
              <div>
                <h3>{item.name}</h3>
                <p>{getCategoryById(item.category)?.name || "Available now"}</p>
              </div>
              <strong>{formatPrice(item.price)}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="content-block app-content-block loyalty-card" aria-labelledby="loyalty-heading">
        <div>
          <p className="eyebrow">Stamp card</p>
          <h2 id="loyalty-heading">Two visits from a house pour</h2>
          <p>Keep ordering your usual and collect stamps toward a complimentary drink.</p>
        </div>
        <div className="stamp-row" aria-label="6 of 8 stamps collected">
          {Array.from({ length: 8 }).map((_, index) => (
            <span className={index < 6 ? "filled" : ""} key={index} />
          ))}
        </div>
      </section>
    </section>
  );
}
