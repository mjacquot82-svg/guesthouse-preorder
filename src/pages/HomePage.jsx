import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { ChevronRight, ShoppingBag } from "lucide-react";
import { useCatalogCategories, useCatalogProducts } from "../stores/catalogStore.js";
import { buildDailySpecialCartItem, getActiveDailySpecial } from "../services/dailySpecialService.js";
import { useDailySpecials } from "../stores/dailySpecialStore.js";
import { addToCart, getStoredCart, storeCart } from "../stores/cartStore.js";

function formatPrice(price) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

export default function HomePage() {
  const { products } = useCatalogProducts();
  const { categories } = useCatalogCategories();
  const { dailySpecials } = useDailySpecials();
  const [cart, setCart] = useState(getStoredCart);
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
  const availableProducts = products.filter((product) => product.active ?? product.available);
  const popularItems = availableProducts.filter((product) => product.featured).slice(0, 4);
  const activeDailySpecial = useMemo(() => getActiveDailySpecial(dailySpecials), [dailySpecials]);
  const coffeeCount = availableProducts.filter((product) =>
    ["coffee", "tea", "cold-drinks"].includes(product.category)
  ).length;
  const cartCount = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart]
  );
  const cartTotal = useMemo(
    () => cart.reduce((total, item) => total + item.price * item.quantity, 0),
    [cart]
  );

  function addDailySpecialToCart() {
    if (!activeDailySpecial) {
      return;
    }

    const categoryName = categoryById.get(activeDailySpecial.categoryId)?.name || "Daily Special";
    const nextCart = addToCart(cart, buildDailySpecialCartItem(activeDailySpecial, categoryName));
    setCart(nextCart);
    storeCart(nextCart);
  }

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

      {activeDailySpecial ? (
        <section className="daily-special-card home-daily-special" aria-labelledby="home-daily-special-heading">
          <div className="daily-special-media">
            {activeDailySpecial.imageUrl ? <img src={activeDailySpecial.imageUrl} alt="" /> : null}
          </div>
          <div className="daily-special-copy">
            <p className="eyebrow">Today&apos;s lunch special</p>
            <h2 id="home-daily-special-heading">{activeDailySpecial.title}</h2>
            <p>{activeDailySpecial.description}</p>
            <strong>{formatPrice(activeDailySpecial.price)}</strong>
            <div className="daily-special-actions">
              <button className="primary-button" type="button" onClick={addDailySpecialToCart}>
                Add to cart
              </button>
              <Link className="secondary-button" to="/menu?special=active">
                View details
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="content-block app-content-block cafe-favorites-block" aria-labelledby="popular-heading">
        <div className="section-heading">
          <h2 id="popular-heading">Café favorites</h2>
        </div>

        <div className="item-list compact-item-list">
          {popularItems.slice(0, 3).map((item) => (
            <Link
              className="item-row favorite-item-link"
              key={item.id}
              to={`/menu?product=${encodeURIComponent(item.id)}`}
              aria-label={`Customize ${item.name}`}
            >
              <div className={`item-thumb item-thumb-${item.image}`} aria-hidden="true" />
              <div>
                <h3>{item.name}</h3>
                <p>{categoryById.get(item.category)?.name || "Available now"}</p>
              </div>
              <span className="favorite-item-action">
                <strong>{formatPrice(item.price)}</strong>
                <ChevronRight size={17} strokeWidth={2.2} aria-hidden="true" />
              </span>
            </Link>
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
