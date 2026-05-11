const categories = [
  {
    name: "Coffee",
    description: "Fresh coffee, tea, espresso drinks, and simple morning cups.",
    items: ["House coffee", "Cappuccino", "English breakfast tea"],
  },
  {
    name: "Drinks",
    description: "Cold drinks for the room, porch, or evening wind-down.",
    items: ["Sparkling water", "Orange juice", "Local wine"],
  },
  {
    name: "Snacks",
    description: "Easy bites for between plans.",
    items: ["Fruit bowl", "Cheese plate", "Chocolate bar"],
  },
  {
    name: "Light breakfast",
    description: "Small breakfast items prepared for a slower morning.",
    items: ["Croissant", "Granola yogurt", "Toast and jam"],
  },
];

export default function MenuPage() {
  return (
    <section className="page-section ordering-page">
      <div className="page-heading">
        <h1>Menu</h1>
        <p>Simple room ordering for coffee, drinks, snacks, and breakfast.</p>
      </div>

      <div className="menu-stack">
        {categories.map((category) => (
          <article className="menu-card" key={category.name}>
            <div>
              <h2>{category.name}</h2>
              <p>{category.description}</p>
            </div>
            <ul>
              {category.items.map((item) => (
                <li key={item}>
                  <span>{item}</span>
                  <button type="button">Add</button>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
