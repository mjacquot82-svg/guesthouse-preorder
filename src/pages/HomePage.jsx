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

  return (
    <section className="home-page ordering-page">
      <div className="welcome-panel">
        <p className="eyebrow">Room service</p>
        <h1>Order drinks, coffee, snacks, and light breakfast.</h1>
        <p>Choose a few items and send your request to the guesthouse team.</p>
        <Link className="primary-button" to="/menu">
          Start order
        </Link>
      </div>

      <section className="content-block" aria-labelledby="quick-order-heading">
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

      <section className="content-block" aria-labelledby="popular-heading">
        <div className="section-heading">
          <h2 id="popular-heading">Often ordered</h2>
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
