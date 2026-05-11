const categories = [
  {
    name: "Breakfast",
    description: "Fresh pastries, fruit, coffee service, and room-delivered morning baskets.",
  },
  {
    name: "Lunch",
    description: "Light meals, picnic boxes, salads, and guesthouse kitchen staples.",
  },
  {
    name: "Drinks",
    description: "Coffee, tea, sparkling water, local wine, and seasonal refreshments.",
  },
  {
    name: "Specials",
    description: "Chef selections, welcome packages, and limited house offerings.",
  },
];

export default function MenuPage() {
  return (
    <section className="page-section">
      <div className="page-heading">
        <p className="eyebrow">Menu</p>
        <h1>Preorder categories</h1>
        <p>Product data will connect here as the Supabase catalog comes online.</p>
      </div>

      <div className="card-grid">
        {categories.map((category) => (
          <article className="menu-card" key={category.name}>
            <span>{category.name}</span>
            <p>{category.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
