import { Link } from "react-router-dom";

const quickCategories = [
  { name: "Coffee", detail: "Hot coffee, tea, espresso drinks" },
  { name: "Drinks", detail: "Water, juice, sparkling, wine" },
  { name: "Snacks", detail: "Chips, fruit, sweets, cheese" },
  { name: "Breakfast", detail: "Pastries, yogurt, toast, granola" },
];

const popularItems = [
  { name: "House coffee", price: "$4", image: "coffee" },
  { name: "Croissant", price: "$5", image: "pastry" },
  { name: "Sparkling water", price: "$3", image: "water" },
];

export default function HomePage() {
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
              <span>{category.detail}</span>
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
                <p>Available now</p>
              </div>
              <strong>{item.price}</strong>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
