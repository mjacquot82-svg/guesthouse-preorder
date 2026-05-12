import { Link } from "react-router-dom";
import { getCategoryById, menuCategories } from "../data/catalog.js";
import { useCatalogProducts } from "../stores/catalogStore.js";

function formatPrice(price) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

export default function HomePage() {
  const { products } = useCatalogProducts();
  const availableProducts = products.filter((product) => product.available);
  const quickCategories = menuCategories
    .map((category) => ({
      ...category,
      count: availableProducts.filter((product) => product.category === category.id).length,
    }))
    .filter((category) => category.count)
    .slice(0, 4);
  const popularItems = availableProducts.filter((product) => product.featured).slice(0, 3);
  const coffeeCount = availableProducts.filter((product) =>
    ["coffee", "espresso", "tea", "iced-drinks"].includes(product.category)
  ).length;

  return (
    <section className="home-page ordering-page">
      <div className="welcome-panel app-welcome-panel">
        <div>
          <p className="eyebrow">Guesthouse cafe</p>
          <h1>Pantry favorites, sent to your room.</h1>
          <p>Browse warm drinks, breakfast bites, pastries, and cozy add-ons.</p>
        </div>
        <div className="welcome-actions">
          <Link className="primary-button" to="/menu">
            Start order
          </Link>
          <span>{coffeeCount} cafe drinks ready</span>
        </div>
      </div>

      <section className="content-block app-content-block" aria-labelledby="quick-order-heading">
        <div className="section-heading">
          <h2 id="quick-order-heading">Quick order</h2>
          <Link to="/menu">View all</Link>
        </div>

        <div className="category-grid">
          {quickCategories.map((category) => (
            <Link className="category-card" to="/menu" key={category.name}>
              <strong>{category.name}</strong>
              <span>
                {category.count} {category.count === 1 ? "item" : "items"} available
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="content-block app-content-block" aria-labelledby="popular-heading">
        <div className="section-heading">
          <h2 id="popular-heading">Popular now</h2>
        </div>

        <div className="item-list">
          {popularItems.map((item) => (
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
    </section>
  );
}
