import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const menuSections = [
  {
    name: "Coffee",
    note: "House-roasted style cups for slow mornings.",
    items: [
      { id: "drip-coffee", name: "Drip Coffee", description: "Warm, steady, and ready from the counter.", price: 3.75 },
      { id: "americano", name: "Americano", description: "Espresso softened with hot water.", price: 4.25 },
      { id: "cold-brew", name: "Cold Brew", description: "Slow-steeped and poured over ice.", price: 4.75 },
    ],
  },
  {
    name: "Espresso Drinks",
    note: "Steamed milk, soft foam, and handwritten favorites.",
    items: [
      { id: "espresso", name: "Espresso", description: "A small, direct pull with a deep finish.", price: 3.5 },
      { id: "latte", name: "Latte", description: "Velvety milk and a double shot.", price: 5.25 },
      { id: "cappuccino", name: "Cappuccino", description: "Foamy, cozy, and balanced.", price: 5.25 },
      { id: "cafe-mocha", name: "Cafe Mocha", description: "Chocolate, espresso, and steamed milk.", price: 5.75 },
      { id: "white-mocha", name: "White Mocha", description: "Creamy white chocolate with espresso.", price: 5.95 },
    ],
  },
  {
    name: "Tea",
    note: "Gentle cups for porch reading and rainy check-ins.",
    items: [
      { id: "tea", name: "Tea", description: "Ask for black, green, mint, or chamomile.", price: 3.5 },
      { id: "chai-latte", name: "Chai Latte", description: "Spiced tea with steamed milk.", price: 5.25 },
      { id: "matcha-latte", name: "Matcha Latte", description: "Earthy matcha whisked with milk.", price: 5.75 },
      { id: "london-fog", name: "London Fog", description: "Earl Grey, vanilla, and warm milk.", price: 5.25 },
    ],
  },
  {
    name: "Hot Chocolate",
    note: "A sweet little cup for colder evenings.",
    items: [
      { id: "hot-chocolate", name: "Hot Chocolate", description: "Steamed milk and rich cocoa.", price: 4.75 },
      { id: "kids-cocoa", name: "Small Cocoa", description: "A smaller, not-too-hot guesthouse cup.", price: 3.75 },
    ],
  },
  {
    name: "Smoothies",
    note: "Bright blends from the pantry fridge.",
    items: [
      { id: "berry-smoothie", name: "Berry Smoothie", description: "Mixed berries, banana, and yogurt.", price: 6.5 },
      { id: "green-smoothie", name: "Green Smoothie", description: "Spinach, apple, banana, and citrus.", price: 6.5 },
    ],
  },
  {
    name: "Flavour Shots",
    note: "A small handwritten plus-one for any drink.",
    items: [
      { id: "vanilla-shot", name: "Vanilla Shot", description: "Soft and familiar.", price: 0.75 },
      { id: "hazelnut-shot", name: "Hazelnut Shot", description: "Toasty and rounded.", price: 0.75 },
      { id: "caramel-shot", name: "Caramel Shot", description: "Buttery sweetness.", price: 0.75 },
    ],
  },
  {
    name: "Non-Dairy Milk",
    note: "Easy swaps for espresso drinks, tea, and cocoa.",
    items: [
      { id: "oat-milk", name: "Oat Milk", description: "Creamy and lightly sweet.", price: 0.85 },
      { id: "almond-milk", name: "Almond Milk", description: "Nutty and light.", price: 0.85 },
      { id: "soy-milk", name: "Soy Milk", description: "Smooth and classic.", price: 0.85 },
      { id: "coconut-milk", name: "Coconut Milk", description: "Soft tropical finish.", price: 0.85 },
    ],
  },
  {
    name: "Light Snacks",
    note: "Simple bites from the pastry case.",
    items: [
      { id: "croissant", name: "Butter Croissant", description: "Flaky, simple, and warmed on request.", price: 4.5 },
      { id: "blueberry-muffin", name: "Blueberry Muffin", description: "Bakery-style with a tender crumb.", price: 3.95 },
      { id: "banana-bread", name: "Banana Bread", description: "Thick slice, lightly toasted.", price: 4.25 },
      { id: "granola-yogurt", name: "Granola Yogurt", description: "Honey, yogurt, and a crunchy top.", price: 5.5 },
    ],
  },
];

const allItems = menuSections.flatMap((section) => section.items);

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

export default function MenuPage() {
  const [activeSection, setActiveSection] = useState(menuSections[0].name);
  const [cart, setCart] = useState(getStoredCart);
  const [lastAdded, setLastAdded] = useState("");

  const activeMenuSection = menuSections.find((section) => section.name === activeSection) || menuSections[0];

  const cartCount = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart]
  );

  const cartTotal = useMemo(
    () => cart.reduce((total, item) => total + item.price * item.quantity, 0),
    [cart]
  );

  function addItem(menuItem) {
    const nextCart = cart.some((item) => item.id === menuItem.id)
      ? cart.map((item) =>
          item.id === menuItem.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      : [...cart, { ...menuItem, quantity: 1 }];

    setCart(nextCart);
    storeCart(nextCart);
    setLastAdded(menuItem.name);
  }

  function getItemQuantity(itemId) {
    return cart.find((item) => item.id === itemId)?.quantity || 0;
  }

  return (
    <section className="page-section menu-page">
      <div className="cafe-board-hero">
        <p className="eyebrow">Guesthouse coffee bar</p>
        <h1>Pantry Menu</h1>
        <p>
          A small handwritten-style board of warm drinks, simple snacks, and cozy add-ons
          prepared for your room or porch table.
        </p>
      </div>

      <div className="menu-order-strip" aria-live="polite">
        <span>{lastAdded ? `${lastAdded} added` : "Choose something warm from the board"}</span>
        <strong>
          {cartCount} {cartCount === 1 ? "item" : "items"} - {formatPrice(cartTotal)}
        </strong>
        <Link to="/cart">View cart</Link>
      </div>

      <div className="menu-category-rail" aria-label="Menu categories">
        {menuSections.map((section) => (
          <button
            className={section.name === activeSection ? "active" : ""}
            type="button"
            key={section.name}
            onClick={() => setActiveSection(section.name)}
          >
            {section.name}
          </button>
        ))}
      </div>

      <div className="cafe-menu-board">
        <aside className="menu-board-note" aria-label="Cafe note">
          <span>Today&apos;s board</span>
          <p>
            Pick your base drink, then add a flavour shot or non-dairy milk from the
            little notes below.
          </p>
          <small>{allItems.length} pantry favorites</small>
        </aside>

        <section className="menu-card menu-card-featured" aria-labelledby="active-menu-heading">
          <div className="menu-card-heading">
            <span className="pin-mark" aria-hidden="true" />
            <div>
              <h2 id="active-menu-heading">{activeMenuSection.name}</h2>
              <p>{activeMenuSection.note}</p>
            </div>
          </div>

          <ul className="drink-card-grid">
            {activeMenuSection.items.map((item, index) => {
              const quantity = getItemQuantity(item.id);

              return (
                <li className="drink-card" key={item.id} style={{ "--tilt": index % 2 ? "0.45deg" : "-0.35deg" }}>
                  <div>
                    <div className="drink-card-title">
                      <h3>{item.name}</h3>
                      <strong>{formatPrice(item.price)}</strong>
                    </div>
                    <p>{item.description}</p>
                  </div>
                  <button type="button" onClick={() => addItem(item)}>
                    {quantity ? `Add again - ${quantity}` : "Add"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </section>
  );
}
