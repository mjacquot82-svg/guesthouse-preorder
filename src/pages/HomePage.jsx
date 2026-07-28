import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { ChevronRight, ShoppingBag } from "lucide-react";
import {
  createHomeCatalogView,
  getHomeCategoryById,
} from "../services/homeCatalog.js";
import { useCustomerCatalog } from "../stores/customerCatalogStore.js";

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
  const { status, catalog, reload } = useCustomerCatalog();
  const {
    categories,
    popularItems,
    coffeeCount,
  } = createHomeCatalogView(status, catalog);
  const [cart] = useState(getStoredCart);
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
          {status === "idle" || status === "loading" ? (
            <div className="empty-menu-note" role="status" aria-live="polite">
              <h3>Preparing today’s favorites</h3>
              <p>Gathering the latest café menu.</p>
            </div>
          ) : null}

          {status === "error" ? (
            <div className="empty-menu-note" role="alert">
              <h3>We couldn’t load today’s favorites</h3>
              <p>Please check your connection and try again.</p>
              <button type="button" onClick={reload}>
                Try again
              </button>
            </div>
          ) : null}

          {status === "empty" ? (
            <div className="empty-menu-note">
              <h3>No café favorites are available right now</h3>
              <p>The menu is being updated. Please check back soon.</p>
            </div>
          ) : null}

          {status === "ready"
            ? popularItems.slice(0, 3).map((item) => (
                <Link
                  className="item-row favorite-item-link"
                  key={item.id}
                  to={`/menu?product=${encodeURIComponent(item.id)}`}
                  aria-label={`Customize ${item.name}`}
                >
                  <div
                    className={`item-thumb item-thumb-${item.image}`}
                    aria-hidden="true"
                  />
                  <div>
                    <h3>{item.name}</h3>
                    <p>
                      {getHomeCategoryById(categories, item.category)?.name ||
                        "Available now"}
                    </p>
                  </div>
                  <span className="favorite-item-action">
                    <strong>{formatPrice(item.price)}</strong>
                    <ChevronRight
                      size={17}
                      strokeWidth={2.2}
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              ))
            : null}
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
