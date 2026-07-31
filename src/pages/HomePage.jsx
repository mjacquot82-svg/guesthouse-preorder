import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { ChevronRight, Plus, ShoppingBag } from "lucide-react";
import {
  createHomeCatalogView,
  getHomeCategoryById,
} from "../services/homeCatalog.js";
import {
  getCartLineId,
  getConfiguredPrice,
  getDefaultSelections,
  getSelectedOptions,
} from "../services/menuCatalog.js";
import { useCustomerCatalog } from "../stores/customerCatalogStore.js";

function formatPrice(price) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

function getStoredCart() {
  try {
    return JSON.parse(window.localStorage.getItem("cafe-cart")) || [];
  } catch {
    return [];
  }
}

function storeCart(cart) {
  window.localStorage.setItem("cafe-cart", JSON.stringify(cart));
}

export default function HomePage() {
  const { status, catalog, reload } = useCustomerCatalog();
  const {
    categories,
    popularItems,
    coffeeCount,
  } = createHomeCatalogView(status, catalog);
  const availableProducts = (catalog?.products || []).filter(
    (product) => product.available
  );
  const quickCategories = categories
    .map((category) => {
      const categoryProducts = availableProducts.filter(
        (product) => product.category === category.id
      );

      return {
        ...category,
        count: categoryProducts.length,
        preview: categoryProducts
          .slice(0, 2)
          .map((product) => product.name)
          .join(" · "),
      };
    })
    .filter((category) => category.count)
    .slice(0, 6);
  const quickAddItems = [
    ...popularItems,
    ...availableProducts.filter((product) => !product.featured),
  ].slice(0, 6);
  const [cart, setCart] = useState(getStoredCart);
  const [lastAdded, setLastAdded] = useState("");
  const cartCount = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart]
  );
  const cartTotal = useMemo(
    () => cart.reduce((total, item) => total + item.price * item.quantity, 0),
    [cart]
  );

  function addQuickItem(product) {
    const selections = getDefaultSelections(product);
    const selectedOptions = getSelectedOptions(product, selections);
    const configuredPrice = getConfiguredPrice(product, selections);
    const cartLineId = getCartLineId(product, selectedOptions);
    const category = getHomeCategoryById(categories, product.category);
    const cartItem = {
      id: cartLineId,
      productId: product.id,
      name: product.name,
      description: product.description,
      price: configuredPrice,
      basePrice: product.price,
      category: category?.name || product.category,
      options: selectedOptions.map((option) => ({
        groupName: option.groupName,
        name: option.name,
        priceDelta: option.priceDelta,
      })),
    };
    const nextCart = cart.some((item) => item.id === cartLineId)
      ? cart.map((item) =>
          item.id === cartLineId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      : [...cart, { ...cartItem, quantity: 1 }];

    setCart(nextCart);
    storeCart(nextCart);
    setLastAdded(product.name);
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
          <span>{lastAdded ? `${lastAdded} added` : "Your café bag"}</span>
        </div>
        <Link to="/cart">
          {cartCount} {cartCount === 1 ? "item" : "items"} · {formatPrice(cartTotal)}
        </Link>
      </div>

      {status === "ready" ? (
        <section
          className="content-block app-content-block home-category-block"
          aria-labelledby="quick-order-heading"
        >
          <div className="section-heading">
            <h2 id="quick-order-heading">Browse the café</h2>
            <Link to="/menu">View full menu</Link>
          </div>

          <div className="category-pill-grid">
            {quickCategories.map((category) => (
              <Link className="category-pill-card" to="/menu" key={category.id}>
                <span className="category-pill-copy">
                  <strong>{category.name}</strong>
                  <small>{category.preview}</small>
                </span>
                <span className="category-pill-count">
                  {category.count} {category.count === 1 ? "item" : "items"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {status === "ready" ? (
        <section
          className="content-block app-content-block quick-add-block"
          aria-labelledby="quick-add-heading"
        >
          <div className="section-heading">
            <h2 id="quick-add-heading">Order a favorite</h2>
            <Link to="/menu">Customize</Link>
          </div>

          <div className="quick-product-rail">
            {quickAddItems.map((item) => (
              <article className="quick-product-card" key={item.id}>
                <div
                  className={`quick-product-image item-thumb-${item.image}`}
                  aria-hidden="true"
                />
                <div className="quick-product-copy">
                  <span>
                    {getHomeCategoryById(categories, item.category)?.name ||
                      "Café"}
                  </span>
                  <h3>{item.name}</h3>
                  <strong>
                    {formatPrice(
                      getConfiguredPrice(item, getDefaultSelections(item))
                    )}
                  </strong>
                </div>
                <button
                  type="button"
                  aria-label={`Add ${item.name} with default options`}
                  onClick={() => addQuickItem(item)}
                >
                  <Plus size={18} strokeWidth={2.8} />
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

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
