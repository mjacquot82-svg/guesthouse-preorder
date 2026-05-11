import { Link } from "react-router-dom";

const highlights = [
  {
    title: "Arrival-ready meals",
    copy: "Breakfast baskets, picnic lunches, and seasonal plates prepared before guests check in.",
  },
  {
    title: "Local hospitality",
    copy: "Curated room extras and kitchen favorites that feel personal, polished, and easy to order.",
  },
  {
    title: "Smooth operations",
    copy: "A foundation for menus, orders, product availability, and future Supabase-powered workflows.",
  },
];

export default function HomePage() {
  return (
    <section className="home-page">
      <div className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">Guesthouse preorder service</p>
          <h1>Thoughtful food and room extras, ready before arrival.</h1>
          <p>
            Give guests a calm, premium way to preorder breakfast, lunch,
            drinks, and house specials for their stay.
          </p>
          <Link className="primary-button" to="/menu">
            Start Order
          </Link>
        </div>
        <div className="hero-panel" aria-label="Featured guesthouse service preview">
          <div className="service-card service-card-large">
            <span>Tonight's welcome</span>
            <strong>Local cheese board</strong>
            <small>Ready at check-in</small>
          </div>
          <div className="service-card-row">
            <div className="service-card">
              <span>Breakfast</span>
              <strong>7:30 AM</strong>
            </div>
            <div className="service-card">
              <span>Room extras</span>
              <strong>3 items</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="section-grid">
        {highlights.map((item) => (
          <article className="info-card" key={item.title}>
            <h2>{item.title}</h2>
            <p>{item.copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
