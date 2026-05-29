import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  getModifierGroupsForProduct,
} from "../data/catalog.js";
import {
  useCatalogCategories,
  useCatalogModifierGroups,
  useCatalogProducts,
} from "../stores/catalogStore.js";

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

function getDefaultSelections(product, modifierGroups) {
  return getModifierGroupsForProduct(product, modifierGroups).reduce((selections, group) => {
    const selectionType = group.selectionType || group.type;
    const defaultOption = group.required || group.minSelections > 0 ? group.options[0]?.id : "";

    return {
      ...selections,
      [group.id]: selectionType === "multiple" ? [] : defaultOption || "",
    };
  }, {});
}

function getSelectedOptions(product, selections, modifierGroups) {
  return getModifierGroupsForProduct(product, modifierGroups).flatMap((group) => {
    const selectedValue = selections[group.id];
    const selectedIds = Array.isArray(selectedValue) ? selectedValue : [selectedValue];

    return selectedIds
      .map((optionId) => {
        const option = group.options.find((item) => item.id === optionId);
        return option
          ? {
              groupId: group.id,
              groupName: group.name,
              ...option,
              priceDelta: Number(option.priceDelta ?? option.priceAdjustment) || 0,
            }
          : null;
      })
      .filter(Boolean);
  });
}

function getActiveVariants(product) {
  return (product.variants || [])
    .filter((variant) => variant.active)
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
}

function getSelectedVariant(product, variantId) {
  return getActiveVariants(product).find((variant) => variant.id === variantId) || null;
}

function getDisplayPrice(product, selectedVariant) {
  const activeVariants = getActiveVariants(product);

  if (!activeVariants.length) {
    if (product.variants?.length) {
      return "Unavailable";
    }

    return formatPrice(product.price);
  }

  if (selectedVariant) {
    return formatPrice(selectedVariant.price);
  }

  const prices = activeVariants.map((variant) => Number(variant.price) || 0);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  return minPrice === maxPrice ? formatPrice(minPrice) : `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`;
}

function getConfiguredPrice(product, selections, selectedVariant, modifierGroups) {
  const basePrice = selectedVariant ? selectedVariant.price : product.price;

  return getSelectedOptions(product, selections, modifierGroups).reduce(
    (sum, option) => sum + (Number(option.priceDelta) || 0),
    basePrice
  );
}

function getCartLineId(product, selectedOptions, selectedVariant) {
  const optionSignature = selectedOptions
    .map((option) => `${option.groupId}:${option.id}`)
    .sort()
    .join("|");
  const variantSignature = selectedVariant ? `variant:${selectedVariant.id}` : "";
  const signature = [variantSignature, optionSignature].filter(Boolean).join("|");

  return signature ? `${product.id}__${signature}` : product.id;
}

function groupProductsByCategory(products, categories) {
  return categories
    .map((category) => ({
      ...category,
      items: products.filter(
        (product) => product.category === category.id && (product.active ?? product.available)
      ),
    }))
    .filter((section) => section.items.length);
}

function hasValidRequiredSelections(product, selections, modifierGroups) {
  return getModifierGroupsForProduct(product, modifierGroups).every((group) => {
    const minSelections = Number(group.minSelections ?? (group.required ? 1 : 0)) || 0;

    if (!minSelections) {
      return true;
    }

    const selectedValue = selections[group.id];
    const selectedIds = Array.isArray(selectedValue) ? selectedValue : [selectedValue].filter(Boolean);

    return selectedIds.length >= minSelections;
  });
}

function ProductModifiers({ product, selections, modifierGroups, onChange }) {
  const attachedModifierGroups = getModifierGroupsForProduct(product, modifierGroups);

  if (!attachedModifierGroups.length) {
    return null;
  }

  return (
    <>
      {attachedModifierGroups.map((group) => {
        const selectionType = group.selectionType || group.type;
        const maxSelections = Number(group.maxSelections) || 0;
        const selectedValue = selections[group.id];
        const selectedCount = Array.isArray(selectedValue)
          ? selectedValue.length
          : selectedValue
            ? 1
            : 0;

        return (
        <fieldset key={group.id} className="modifier-group">
          <legend>{group.name}{group.required ? "" : " (optional)"}</legend>
          <div className="modifier-options">
            {group.options.map((option) => {
              const isSelected = Array.isArray(selectedValue)
                ? selectedValue.includes(option.id)
                : selectedValue === option.id;
              const selectionLimitReached =
                selectionType === "multiple" &&
                maxSelections > 0 &&
                selectedCount >= maxSelections &&
                !isSelected;

              return (
                <label key={option.id} className={isSelected ? "selected" : ""}>
                  <input
                    checked={isSelected}
                    disabled={selectionLimitReached}
                    name={`${product.id}-${group.id}`}
                    type={selectionType === "multiple" ? "checkbox" : "radio"}
                    value={option.id}
                    onChange={(event) => {
                      if (selectionType === "multiple") {
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
        );
      })}
    </>
  );
}

function ProductVariants({ product, selectedVariantId, onChange }) {
  const variants = getActiveVariants(product);

  if (!variants.length) {
    if (product.variants?.length) {
      return <p className="variant-unavailable-note">No active variants available.</p>;
    }

    return null;
  }

  return (
    <fieldset className="modifier-group variant-selector">
      <legend>Choose Size</legend>
      <div className="modifier-options">
        {variants.map((variant) => {
          const isSelected = selectedVariantId === variant.id;

          return (
            <label key={variant.id} className={isSelected ? "selected" : ""}>
              <input
                checked={isSelected}
                name={`${product.id}-variant`}
                type="radio"
                value={variant.id}
                onChange={() => onChange(variant.id)}
              />
              <span>{variant.name}</span>
              <small>{formatPrice(variant.price)}</small>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function MenuPage() {
  const { products } = useCatalogProducts();
  const { categories } = useCatalogCategories();
  const { modifierGroups } = useCatalogModifierGroups();
  const [searchParams, setSearchParams] = useSearchParams();
  const sections = useMemo(() => groupProductsByCategory(products, categories), [products, categories]);
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
  const firstSection = sections[0]?.id || "";
  const targetProductId = searchParams.get("product") || "";
  const targetProduct = products.find(
    (product) => product.id === targetProductId && (product.active ?? product.available)
  );
  const [activeSection, setActiveSection] = useState(firstSection);
  const [cart, setCart] = useState(getStoredCart);
  const [lastAdded, setLastAdded] = useState("");
  const [addedLineId, setAddedLineId] = useState("");
  const [bagIsUpdating, setBagIsUpdating] = useState(false);
  const [spotlightProductId, setSpotlightProductId] = useState("");
  const [selectionsByProduct, setSelectionsByProduct] = useState({});
  const [variantsByProduct, setVariantsByProduct] = useState({});
  const addedResetTimer = useRef(null);
  const bagPulseTimer = useRef(null);
  const spotlightTimer = useRef(null);

  useEffect(() => {
    return () => {
      clearTimeout(addedResetTimer.current);
      clearTimeout(bagPulseTimer.current);
      clearTimeout(spotlightTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!targetProduct) {
      return;
    }

    setActiveSection(targetProduct.category);
  }, [targetProduct]);

  useEffect(() => {
    if (!targetProduct || activeSection !== targetProduct.category) {
      return;
    }

    clearTimeout(spotlightTimer.current);

    requestAnimationFrame(() => {
      const productCard = document.getElementById(`product-${targetProduct.id}`);

      if (!productCard) {
        return;
      }

      productCard.scrollIntoView({ behavior: "smooth", block: "center" });
      productCard.focus({ preventScroll: true });
      setSpotlightProductId(targetProduct.id);

      spotlightTimer.current = setTimeout(() => {
        setSpotlightProductId("");
      }, 1800);
    });
  }, [activeSection, targetProduct]);

  const activeSectionId = sections.some((section) => section.id === activeSection)
    ? activeSection
    : firstSection;
  const activeMenuSection = sections.find((section) => section.id === activeSectionId);
  const availableItems = products.filter((product) => product.active ?? product.available);
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
    return selectionsByProduct[product.id] || getDefaultSelections(product, modifierGroups);
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

  function updateVariantSelection(productId, variantId) {
    setVariantsByProduct((current) => ({
      ...current,
      [productId]: variantId,
    }));
  }

  function addItem(product) {
    const selections = getSelections(product);
    const selectedVariant = getSelectedVariant(product, variantsByProduct[product.id]);

    if (product.variants?.length && !selectedVariant) {
      return;
    }

    if (!hasValidRequiredSelections(product, selections, modifierGroups)) {
      return;
    }

    const selectedOptions = getSelectedOptions(product, selections, modifierGroups);
    const configuredPrice = getConfiguredPrice(product, selections, selectedVariant, modifierGroups);
    const cartLineId = getCartLineId(product, selectedOptions, selectedVariant);
    const category = categoryById.get(product.category);
    const cartItem = {
      id: cartLineId,
      productId: product.id,
      variantId: selectedVariant?.id || "",
      name: product.name,
      variantName: selectedVariant?.name || "",
      variantPrice: selectedVariant?.price ?? null,
      description: product.description,
      price: configuredPrice,
      finalPrice: configuredPrice,
      basePrice: selectedVariant?.price ?? product.price,
      category: category?.name || product.category,
      selectedModifiers: selectedOptions.map((option) => ({
        groupId: option.groupId,
        groupName: option.groupName,
        optionId: option.id,
        name: option.name,
        priceDelta: option.priceDelta,
      })),
    };
    cartItem.options = cartItem.selectedModifiers;
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
    const selectedVariant = getSelectedVariant(product, variantsByProduct[product.id]);

    if (product.variants?.length && !selectedVariant) {
      return 0;
    }

    const cartLineId = getCartLineId(
      product,
      getSelectedOptions(product, selections, modifierGroups),
      selectedVariant
    );
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
            onClick={() => {
              setActiveSection(section.id);
              if (targetProductId) {
                setSearchParams({});
              }
            }}
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
                  const selectedVariant = getSelectedVariant(item, variantsByProduct[item.id]);
                  const hasVariants = (item.variants?.length || 0) > 0;
                  const quantity = getItemQuantity(item);
                  const price = selectedVariant
                    ? getConfiguredPrice(item, selections, selectedVariant, modifierGroups)
                    : null;
                  const category = categoryById.get(item.category);
                  const cartLineId = getCartLineId(
                    item,
                    getSelectedOptions(item, selections, modifierGroups),
                    selectedVariant
                  );
                  const isAdded = addedLineId === cartLineId;

                  const isSpotlighted = spotlightProductId === item.id;

                  return (
                    <li
                      className={`drink-card app-product-card${isSpotlighted ? " is-spotlighted" : ""}`}
                      id={`product-${item.id}`}
                      key={item.id}
                      tabIndex={-1}
                    >
                      <div className={`product-thumb item-thumb-${item.image}`} aria-hidden="true" />
                      <div className="product-card-main">
                        <div className="drink-card-title">
                          <div>
                            <span>{category?.name || "Cafe"}</span>
                            <h3>{item.name}</h3>
                          </div>
                          <strong>{price === null ? getDisplayPrice(item, selectedVariant) : formatPrice(price)}</strong>
                        </div>
                        <p>{item.description}</p>

                        <div className="modifier-stack">
                          <ProductVariants
                            product={item}
                            selectedVariantId={variantsByProduct[item.id] || ""}
                            onChange={(variantId) => updateVariantSelection(item.id, variantId)}
                          />

                          <ProductModifiers
                            product={item}
                            selections={selections}
                            modifierGroups={modifierGroups}
                            onChange={(groupId, value) => updateSelection(item.id, groupId, value)}
                          />
                        </div>

                        <button
                          className={isAdded ? "is-added" : ""}
                          type="button"
                          disabled={hasVariants && !selectedVariant}
                          onClick={() => addItem(item)}
                        >
                          <span>
                            {hasVariants && !getActiveVariants(item).length
                              ? "No active variants"
                              : hasVariants && !selectedVariant
                                ? "Choose a size"
                              : isAdded
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
