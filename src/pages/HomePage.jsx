import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Plus, ShoppingBag } from "lucide-react";
import {
  createQuickOrderItems,
  createHomeCatalogView,
  getHomeCategoryById,
} from "../services/homeCatalog.js";
import {
  getCartLineId,
  getConfiguredPrice,
  getDefaultSelections,
  getProductSpecificImageUrl,
  getSelectedOptions,
} from "../services/menuCatalog.js";
import { useCustomerCatalog } from "../stores/customerCatalogStore.js";
import { useCustomerAuth } from "../auth/CustomerAuthContext.jsx";
import { fetchCustomerLoyalty } from "../services/loyaltyApi.js";
import { fetchCustomerQuickOrder } from "../services/customerAccountApi.js";
import LoyaltyCard from "../components/LoyaltyCard.jsx";

function formatPrice(price) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

function getStoredCart() {
  try {
    const stored = JSON.parse(window.localStorage.getItem("cafe-cart"));
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function storeCart(cart) {
  window.localStorage.setItem("cafe-cart", JSON.stringify(cart));
}

export default function HomePage() {
  const { session } = useCustomerAuth();
  const [quickOrderPersonalization, setQuickOrderPersonalization] = useState({
    productIds: [],
    userId: null,
  });
  const personalizedProductIds =
    quickOrderPersonalization.userId === session?.user_id
      ? quickOrderPersonalization.productIds
      : [];
  useEffect(() => {
    let active = true;
    setQuickOrderPersonalization({ productIds: [], userId: null });
    if (!session) return () => { active = false; };
    const userId = session.user_id;
    fetchCustomerQuickOrder()
      .then((value) => {
        if (active && Array.isArray(value.product_ids)) {
          setQuickOrderPersonalization({ productIds: value.product_ids, userId });
        }
      })
      .catch(() => {
        if (active) setQuickOrderPersonalization({ productIds: [], userId: null });
      });
    return () => { active = false; };
  }, [session]);
  const [loyalty,setLoyalty]=useState({program:null,loading:false,error:""});
  useEffect(()=>{let active=true;if(!session){setLoyalty({program:null,loading:false,error:""});return()=>{active=false}}setLoyalty({program:null,loading:true,error:""});fetchCustomerLoyalty().then(value=>{if(active)setLoyalty({program:value.programs?.[0]||null,loading:false,error:""})}).catch(()=>{if(active)setLoyalty({program:null,loading:false,error:"unavailable"})});return()=>{active=false}},[session]);
  const { status, catalog, reload } = useCustomerCatalog();
  const {
    categories,
    popularItems,
    lunchSpecial,
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
  const quickOrderItems = createQuickOrderItems(catalog?.products || [], {
    personalizedProductIds,
  });
  const hasPersonalizedQuickOrder = personalizedProductIds.some((productId) =>
    quickOrderItems.some((product) => product.backendId === String(productId))
  );
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

  const recommendation = lunchSpecial || popularItems[0] || availableProducts[0] || null;
  const recommendationImageUrl = getProductSpecificImageUrl(recommendation);

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
      ? cart.map((item) => item.id === cartLineId
        ? { ...item, quantity: item.quantity + 1 }
        : item)
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
          {status === "ready" ? <span>{coffeeCount} crafted drinks</span> : null}
          {status === "empty" ? <span>No crafted drinks available today</span> : null}
          {status === "idle" || status === "loading" ? <span>Loading today’s drinks…</span> : null}
          {status === "error" ? <span>Menu count unavailable</span> : null}
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

      {status === "ready" || status === "empty" ? <section
        className={`content-block app-content-block lunch-special-block${recommendationImageUrl ? " has-product-image" : " is-image-free"}`}
        aria-labelledby="lunch-special-heading"
      >
        {recommendationImageUrl ? (
          <div
            className="lunch-special-image"
            style={{ backgroundImage: `url(${recommendationImageUrl})` }}
            aria-hidden="true"
          />
        ) : null}
        <div className="lunch-special-copy">
          <p className="eyebrow">{lunchSpecial ? "Today’s lunch special" : "From the café"}</p>
          <h2 id="lunch-special-heading" className="visually-hidden">{lunchSpecial ? "Today’s Lunch Special" : "Today’s Picks"}</h2>
          <h3>{recommendation?.name || "Something delicious is always waiting"}</h3>
          {recommendation?.description ? <p>{recommendation.description}</p> : null}
          {recommendation ? (
            <strong>{formatPrice(getConfiguredPrice(recommendation, getDefaultSelections(recommendation)))}</strong>
          ) : null}
          <Link
            className="primary-button"
            to={recommendation ? `/menu?product=${encodeURIComponent(recommendation.id)}` : "/menu"}
          >
            {lunchSpecial ? "Order Today’s Special" : "Browse today’s menu"}
          </Link>
        </div>
      </section> : null}

      {status === "idle" || status === "loading" ? (
        <section className="content-block app-content-block lunch-special-block is-image-free" aria-labelledby="lunch-special-loading-heading">
          <div className="lunch-special-copy" role="status" aria-live="polite">
            <p className="eyebrow">Today’s lunch special</p>
            <h2 id="lunch-special-loading-heading">Loading today’s special…</h2>
            <p>We’re checking the current café menu.</p>
          </div>
        </section>
      ) : null}

      {status === "error" ? (
        <section className="content-block app-content-block lunch-special-block is-image-free" aria-labelledby="lunch-special-error-heading">
          <div className="lunch-special-copy" role="alert">
            <p className="eyebrow">Today’s lunch special</p>
            <h2 id="lunch-special-error-heading">Today’s special is temporarily unavailable</h2>
            <p>We couldn’t load the current café menu. Please try again.</p>
            <button className="primary-button" type="button" onClick={reload}>Try again</button>
          </div>
        </section>
      ) : null}

      <section
        className="content-block app-content-block home-category-block"
        aria-labelledby="quick-order-heading"
      >
        <div className="section-heading">
          <h2 id="quick-order-heading">Browse the café</h2>
          <Link to="/menu">View full menu</Link>
        </div>

        {status === "ready" ? (
          <div className="category-pill-grid">
            {quickCategories.map((category) => (
              <Link className="category-pill-card" to={`/menu?category=${encodeURIComponent(category.slug)}`} key={category.id}>
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
        ) : null}

        {status === "idle" || status === "loading" ? (
          <div className="category-browser-state" role="status" aria-live="polite">
            <strong>Preparing the café menu</strong>
            <p>Coffee, tea, meals, and cold drinks will be ready in a moment.</p>
          </div>
        ) : null}

        {status === "error" ? (
          <div className="category-browser-state" role="alert">
            <strong>Browse the full café menu</strong>
            <p>Categories could not be loaded right now.</p>
            <div><Link to="/menu">Open menu</Link><button type="button" onClick={reload}>Try again</button></div>
          </div>
        ) : null}

        {status === "empty" ? (
          <div className="category-browser-state">
            <strong>Today’s menu is being prepared</strong>
            <p>Please check back soon for coffee, tea, meals, and more.</p>
          </div>
        ) : null}
      </section>

      {status === "ready" ? (
      <section className="content-block app-content-block quick-add-block" aria-labelledby="quick-order-heading-home">
        <div className="section-heading">
          <div>
            <h2 id="quick-order-heading-home">Quick Order</h2>
            {hasPersonalizedQuickOrder ? <p>Based on what you order most</p> : null}
          </div>
          <Link to="/menu">View menu</Link>
        </div>
        <div className="quick-product-rail">
          {quickOrderItems.map((item) => {
            const productImageUrl = getProductSpecificImageUrl(item);

            return (
              <article className={`quick-product-card${productImageUrl ? " has-product-image" : " is-image-free"}`} key={item.id}>
                {productImageUrl ? (
                  <div className="quick-product-image" style={{ backgroundImage: `url(${productImageUrl})` }} aria-hidden="true" />
                ) : null}
                <div className="quick-product-copy">
                  <h3>{item.name}</h3>
                  <strong>{formatPrice(getConfiguredPrice(item, getDefaultSelections(item)))}</strong>
                </div>
                <button type="button" aria-label={`Quick add ${item.name}`} onClick={() => addQuickItem(item)}>
                  <Plus size={18} strokeWidth={2.8} />
                </button>
              </article>
            );
          })}
        </div>
      </section>
      ) : null}

      <LoyaltyCard error={loyalty.error} loading={loyalty.loading} program={loyalty.program} signedIn={Boolean(session)} />
    </section>
  );
}
