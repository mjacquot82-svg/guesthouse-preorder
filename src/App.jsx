export default function App() {
  const featured = [
    {
      id: 1,
      name: "Breakfast Basket",
      price: "$24",
      image:
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1200&auto=format&fit=crop",
    },
    {
      id: 2,
      name: "Charcuterie Board",
      price: "$38",
      image:
        "https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=1200&auto=format&fit=crop",
    },
  ];

  return (
    <div className="app">
      <header className="hero">
        <div className="overlay">
          <h1>Guesthouse Preorder</h1>
          <p>Order food, gifts, and room extras before arrival.</p>
          <button>Start Order</button>
        </div>
      </header>

      <section className="promo">
        <h2>Featured Promotions</h2>

        <div className="promo-grid">
          <div className="promo-card">
            <h3>Weekend Wine Package</h3>
            <p>Add a local wine package to your stay.</p>
          </div>

          <div className="promo-card">
            <h3>Breakfast Bundle</h3>
            <p>Fresh breakfast delivered to your room.</p>
          </div>
        </div>
      </section>

      <section className="catalog">
        <h2>Popular Items</h2>

        <div className="product-grid">
          {featured.map((item) => (
            <div className="product-card" key={item.id}>
              <img src={item.image} alt={item.name} />
              <div className="product-info">
                <h3>{item.name}</h3>
                <p>{item.price}</p>
                <button>Add to Cart</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}