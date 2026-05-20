import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  getCategoryById,
  getModifierGroupsForProduct,
  menuCategories,
} from "../data/catalog.js";
import { useCatalogProducts } from "../stores/catalogStore.js";

function formatPrice(price) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
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

function getDefaultSelections(product) {
  return getModifierGroupsForProduct(product).reduce((selections, group) => {
    const defaultOption = group.options[0]?.id;
    return {
      ...selections,
      [group.id]: group.type === "multiple" ? [] : defaultOption || "",
    };
  }, {});
}

function getSelectedOptions(product, selections) {
  return getModifierGroupsForProduct(product).flatMap((group) => {
    const selectedValue = selections[group.id];
    const selectedIds = Array.isArray(selectedValue) ? selectedValue : [selectedValue];

    return selectedIds
      .map((optionId) => {
        const option = group.options.find((item) => item.id === optionId);
        return option ? { groupId: group.id, groupName: group.name, ...option } : null;
      })
      .filter(Boolean);
  });
}

function getConfiguredPrice(product, selections) {
  return getSelectedOptions(product, selections).reduce(
    (sum, option) => sum + (Number(option.priceDelta) || 0),
    product.price
  );
}

function getCartLineId(product, selectedOptions) {
  const optionSignature = selectedOptions
    .map((option) => `${option.groupId}:${option.id}`)
    .sort()
    .join("|");

  return optionSignature ? `${product.id}__${optionSignature}` : product.id;
}

function groupProductsByCategory(products) {
  return menuCategories
    .map((category) => ({
      ...category,
      items: products.filter((product) => product.category === category.id && product.available),
    }))
    .filter((section) => section.items.length);
}

function ProductModifiers({ product, selections, onChange }) {
  const modifierGroups = getModifierGroupsForProduct(product);

  if (!modifierGroups.length) {
    return null;
  }

  return (
    <div className="modifier-stack">
      {modifierGroups.map((group) => (
        <fieldset key={group.id} className="modifier-group">
          <legend>{group.name}</legend>
          <div className="modifier-options">
            {group.options.map((option) => {
              const selectedValue = selections[group.id];
              const isSelected = Array.isArray(selectedValue)
                ? selectedValue.includes(option.id)
                : selectedValue === option.id;

              return (
                <label key={option.id} className={isSelected ? "selected" : ""}>
                  <input
                    checked={isSelected}
                    name={`${product.id}-${group.id}`}
                    type={group.type === "multiple" ? "checkbox" : "radio"}
                    value={option.id}
                    onChange={(event) => {
                      if (group.type === "multiple") {
                        const current = Array.isArray(selectedValue) ? selectedValue : [];
                        onChange(
                          group.id,
                          event.target.checked
                            ? [...current, option.id]
                            : current.filter((item) => item !== option.id)
                        );
                        return;
                      }

                      onChange(group.id, option.id);
                    }}
                  />
                  <span>{option.name}</span>
                  {option.priceDelta ? <small>+{formatPrice(option.priceDelta)}</small> : null}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export default function MenuPage() {
  const { products } = useCatalogProducts();
  const sections = useMemo(() => groupProductsByCategory(products), [products]);
  const firstSection = sections[0]?.id || "";
  const [activeSection, setActiveSection] = useState(firstSection);
  const [cart, setCart] = useState(getStoredCart);
  const [lastAdded, setLastAdded] = useState("");
  const [addedLineId, setAddedLineId] = useState("");
  const [bagIsUpdating, setBagIsUpdating] = useState(false);
  const [selectionsByProduct, setSelectionsByProduct] = useState({});
  const addedResetTimer = useRef(null);
  const bagPulseTimer = useRef(null);

  useEffect(() => {
    return () => {
      clearTimeout(addedResetTimer.current);
      clearTimeout(bagPulseTimer.current);
    };
  }, []);

  const activeSectionId = sections.some((section) => section.id === activeSection)
    ? activeSection
    : firstSection;
  const activeMenuSection = sections.find((section) => section.id === activeSectionId);
  const availableItems = products.filter((product) => product.available);
  const featuredItems = availableItems.filter((product) => product.featured);

  const cartCount = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart]
  );

  const cartTotal = useMemo(
    () => cart.reduce((total, item) => total + item.price * item.quantity, 0),
    [cart]
  );

  function getSelections(product) {
    return selectionsByProduct[product.id] || getDefaultSelections(product);
  }

  function updateSelection(productId, groupId, value) {
    setSelectionsByProduct((current) => ({
      ...current,
      [productId]: {
        ...current[productId],
        [groupId]: value,
      },
    }));
  }

  function addItem(product) {
    const selections = getSelections(product);
    const selectedOptions = getSelectedOptions(product, selections);
    const configuredPrice = getConfiguredPrice(product, selections);
    const cartLineId = getCartLineId(product, selectedOptions);
    const category = getCategoryById(product.category);
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
          item.id === cartLineId ? { ...item, quantity: item.quantity + 1 } : item
        )
      : [...cart, { ...cartItem, quantity: 1 }];

    setCart(nextCart);
    storeCart(nextCart);
    setLastAdded(product.name);
    setAddedLineId(cartLineId);
    setBagIsUpdating(false);

    clearTimeout(addedResetTimer.current);
    clearTimeout(bagPulseTimer.current);

    requestAnimationFrame(() => {
      setBagIsUpdating(true);
    });

    addedResetTimer.current = setTimeout(() => {
      setAddedLineId("");
    }, 1700);

    bagPulseTimer.current = setTimeout(() => {
      setBagIsUpdating(false);
    }, 900);
  }

  function getItemQuantity(product) {
    const selections = getSelections(product);
    const cartLineId = getCartLineId(product, getSelectedOptions(product, selections));
    return cart.find((item) => item.id === cartLineId)?.quantity || 0;
  }

  return (
    <section className="page-section menu-page app-menu-page">
      <div className="ordering-top-card">
        <div>
          <p className="eyebrow">Browse menu</p>
          <h1>Crafted drinks and fresh bites</h1>
          <p>Choose espresso, tea, breakfast, pastries, and seasonal café picks.</p>
        </div>
        <div className="order-meta-pills" aria-label="Menu summary">
          <span>{availableItems.length} items</span>
          <span>{featuredItems.length} favorites</span>
        </div>
      </div>

      <div
        className={`menu-order-strip app-order-strip${bagIsUpdating ? " is-updating" : ""}`}
        aria-live="polite"
      >
        <span>{lastAdded ? `${lastAdded} added` : "Build your café order"}</span>
        <strong key={`${cartCount}-${cartTotal}`}>
          {cartCount} {cartCount === 1 ? "item" : "items"} · {formatPrice(cartTotal)}
        </strong>
        <Link to="/cart">View cart</Link>
      </div>

      <div
        className={`cafe-bag-toast${bagIsUpdating ? " is-visible" : ""}`}
        role="status"
        aria-live="polite"
        aria-hidden={!bagIsUpdating}
      >
        Added to your café bag
      </div>

      <div className="menu-category-rail" aria-label="Menu categories">
        {sections.map((section) => (
          <button
            className={section.id === activeSectionId ? "active" : ""}
            type="button"
            key={section.id}
            onClick={() => setActiveSection(section.id)}
          >
            {section.name}
          </button>
        ))}
      </div>

      <div className="app-menu-surface">
        <section className="menu-card menu-card-featured app-menu-card" aria-labelledby="active-menu-heading">
          {activeMenuSection ? (
            <>
              <div className="menu-card-heading">
                <div>
                  <h2 id="active-menu-heading">{activeMenuSection.name}</h2>
                  <p>{activeMenuSection.note}</p>
                </div>
              </div>

              <ul className="drink-card-grid">
                {activeMenuSection.items.map((item) => {
                  const selections = getSelections(item);
                  const quantity = getItemQuantity(item);
                  const price = getConfiguredPrice(item, selections);
                  const category = getCategoryById(item.category);
                  const cartLineId = getCartLineId(item, getSelectedOptions(item, selections));
                  const isAdded = addedLineId === cartLineId;

                  return (
                    <li className="drink-card app-product-card" key={item.id}>
                      <div className={`product-thumb item-thumb-${item.image}`} aria-hidden="true" />
                      <div className="product-card-main">
                        <div className="drink-card-title">
                          <div>
                            <span>{category?.name || "Cafe"}</span>
                            <h3>{item.name}</h3>
                          </div>
                          <strong>{formatPrice(price)}</strong>
                        </div>
                        <p>{item.description}</p>

                        <ProductModifiers
                          product={item}
                          selections={selections}
                          onChange={(groupId, value) => updateSelection(item.id, groupId, value)}
                        />

                        <button
                          className={isAdded ? "is-added" : ""}
                          type="button"
                          onClick={() => addItem(item)}
                        >
                          <span>
                            {isAdded
                              ? "✓ Added to order"
                              : quantity
                                ? `Add again · ${quantity}`
                                : "Add to order"}
                          </span>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <div className="empty-menu-note">
              <h2>No available items</h2>
              <p>The cafe menu is being updated.</p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
