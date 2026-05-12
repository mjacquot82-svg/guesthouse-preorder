import { useMemo, useState } from "react";
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
    return JSON.parse(window.localStorage.getItem("guesthouse-cart")) || [];
  } catch {
    return [];
  }
}

function storeCart(cart) {
  window.localStorage.setItem("guesthouse-cart", JSON.stringify(cart));
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
  const [selectionsByProduct, setSelectionsByProduct] = useState({});

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
  }

  function getItemQuantity(product) {
    const selections = getSelections(product);
    const cartLineId = getCartLineId(product, getSelectedOptions(product, selections));
    return cart.find((item) => item.id === cartLineId)?.quantity || 0;
  }

  return (
    <section className="page-section menu-page">
      <div className="cafe-board-hero">
        <p className="eyebrow">Guesthouse coffee bar</p>
        <h1>Pantry Menu</h1>
        <p>
          A small catalog of warm drinks, simple snacks, and cozy add-ons prepared for
          your room or porch table.
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

      <div className="cafe-menu-board">
        <aside className="menu-board-note" aria-label="Cafe note">
          <span>Today&apos;s board</span>
          <p>Pick your base item, choose any options, and add it to your pantry order.</p>
          <small>{availableItems.length} available favorites</small>
          {featuredItems.length ? (
            <div className="featured-list">
              {featuredItems.slice(0, 4).map((item) => (
                <span key={item.id}>{item.name}</span>
              ))}
            </div>
          ) : null}
        </aside>

        <section className="menu-card menu-card-featured" aria-labelledby="active-menu-heading">
          {activeMenuSection ? (
            <>
              <div className="menu-card-heading">
                <span className="pin-mark" aria-hidden="true" />
                <div>
                  <h2 id="active-menu-heading">{activeMenuSection.name}</h2>
                  <p>{activeMenuSection.note}</p>
                </div>
              </div>

              <ul className="drink-card-grid">
                {activeMenuSection.items.map((item, index) => {
                  const selections = getSelections(item);
                  const quantity = getItemQuantity(item);
                  const price = getConfiguredPrice(item, selections);

                  return (
                    <li
                      className="drink-card"
                      key={item.id}
                      style={{ "--tilt": index % 2 ? "0.45deg" : "-0.35deg" }}
                    >
                      <div>
                        <div className="drink-card-title">
                          <h3>{item.name}</h3>
                          <strong>{formatPrice(price)}</strong>
                        </div>
                        <p>{item.description}</p>
                      </div>

                      <ProductModifiers
                        product={item}
                        selections={selections}
                        onChange={(groupId, value) => updateSelection(item.id, groupId, value)}
                      />

                      <button type="button" onClick={() => addItem(item)}>
                        {quantity ? `Add again - ${quantity}` : "Add"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <div className="empty-menu-note">
              <h2>No available items</h2>
              <p>The pantry menu is being updated.</p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
