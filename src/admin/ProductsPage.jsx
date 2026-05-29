import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createProductId,
  useCatalogCategories,
  useCatalogModifierGroups,
  useCatalogProducts,
} from "../stores/catalogStore.js";

const emptyProduct = {
  id: "",
  name: "",
  description: "",
  category: "coffee",
  basePrice: "",
  price: "",
  image: "coffee",
  active: true,
  available: true,
  featured: false,
  variants: [],
  variantIds: [],
  modifierGroupIds: [],
};

function formatPrice(price) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

function toFormProduct(product) {
  const basePrice = product.basePrice ?? product.price ?? "";
  const variants = Array.isArray(product.variants) ? product.variants : [];

  return {
    ...emptyProduct,
    ...product,
    basePrice: String(basePrice),
    price: String(basePrice),
    active: product.active ?? product.available ?? true,
    available: product.available ?? product.active ?? true,
    variants: variants
      .map((variant, index) => ({
        id: variant.id,
        name: variant.name || "",
        price: String(variant.price ?? ""),
        active: variant.active ?? true,
        sortOrder: Number(variant.sortOrder ?? index) || 0,
        modifierGroupIds: variant.modifierGroupIds || [],
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
    variantIds: variants.map((variant) => variant.id),
    modifierGroupIds: product.modifierGroupIds || [],
  };
}

function createVariantId(name) {
  const baseId = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${baseId || "variant"}-${Date.now()}`;
}

export default function ProductsPage() {
  const { products, addProduct, updateProduct, removeProduct } = useCatalogProducts();
  const { categories } = useCatalogCategories();
  const { modifierGroups } = useCatalogModifierGroups();
  const [selectedProductId, setSelectedProductId] = useState("");
  const [formProduct, setFormProduct] = useState(emptyProduct);
  const [status, setStatus] = useState("");

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId),
    [products, selectedProductId]
  );

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  const sortedProducts = useMemo(
    () =>
      [...products].sort((a, b) => {
        const categoryCompare = a.category.localeCompare(b.category);
        return categoryCompare || a.name.localeCompare(b.name);
      }),
    [products]
  );

  function updateField(field, value) {
    setFormProduct((current) => ({ ...current, [field]: value }));
  }

  function updateModifierGroupSelection(groupId, isSelected) {
    setFormProduct((current) => {
      const currentIds = current.modifierGroupIds || [];

      return {
        ...current,
        modifierGroupIds: isSelected
          ? [...new Set([...currentIds, groupId])]
          : currentIds.filter((id) => id !== groupId),
      };
    });
  }

  function addVariant() {
    setFormProduct((current) => ({
      ...current,
      variants: [
        ...(current.variants || []),
        {
          id: createVariantId("variant"),
          name: "",
          price: current.basePrice || "",
          active: true,
          sortOrder: current.variants?.length || 0,
          modifierGroupIds: [],
        },
      ],
    }));
  }

  function updateVariant(variantId, field, value) {
    setFormProduct((current) => ({
      ...current,
      variants: (current.variants || []).map((variant) =>
        variant.id === variantId ? { ...variant, [field]: value } : variant
      ),
    }));
  }

  function removeVariant(variantId) {
    setFormProduct((current) => ({
      ...current,
      variants: (current.variants || [])
        .filter((variant) => variant.id !== variantId)
        .map((variant, index) => ({ ...variant, sortOrder: index })),
    }));
  }

  function moveVariant(variantId, direction) {
    setFormProduct((current) => {
      const variants = [...(current.variants || [])];
      const currentIndex = variants.findIndex((variant) => variant.id === variantId);
      const nextIndex = currentIndex + direction;

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= variants.length) {
        return current;
      }

      const [variant] = variants.splice(currentIndex, 1);
      variants.splice(nextIndex, 0, variant);

      return {
        ...current,
        variants: variants.map((item, index) => ({ ...item, sortOrder: index })),
      };
    });
  }

  function startEdit(product) {
    setSelectedProductId(product.id);
    setFormProduct(toFormProduct(product));
    setStatus("");
  }

  function resetForm() {
    setSelectedProductId("");
    setFormProduct({ ...emptyProduct, category: categories[0]?.id || "coffee" });
  }

  function handleSubmit(event) {
    event.preventDefault();

    const productId = selectedProductId || createProductId(formProduct.name);
    const basePrice = Number(formProduct.basePrice);
    const variants = (formProduct.variants || []).map((variant, index) => ({
      id: variant.id || createVariantId(variant.name),
      name: variant.name.trim(),
      price: Number(variant.price),
      active: Boolean(variant.active),
      sortOrder: index,
      modifierGroupIds: variant.modifierGroupIds || [],
    }));
    const payload = {
      ...formProduct,
      id: productId,
      name: formProduct.name.trim(),
      description: formProduct.description.trim(),
      basePrice,
      price: basePrice,
      active: Boolean(formProduct.active),
      available: Boolean(formProduct.active),
      variants,
      variantIds: variants.map((variant) => variant.id),
      modifierGroupIds: formProduct.modifierGroupIds || [],
    };

    if (!payload.name || Number.isNaN(payload.basePrice)) {
      setStatus("Add a product name and valid base price.");
      return;
    }

    if (variants.some((variant) => !variant.name || Number.isNaN(variant.price))) {
      setStatus("Each variant needs a name and valid price.");
      return;
    }

    if (selectedProduct) {
      updateProduct(selectedProduct.id, payload);
      setStatus(`${payload.name} updated.`);
    } else {
      const existingIds = new Set(products.map((product) => product.id));
      const uniqueId = existingIds.has(productId) ? `${productId}-${Date.now()}` : productId;
      addProduct({ ...payload, id: uniqueId });
      setStatus(`${payload.name} added.`);
    }

    resetForm();
  }

  function handleRemove(product) {
    removeProduct(product.id);
    if (selectedProductId === product.id) {
      resetForm();
    }
    setStatus(`${product.name} deleted.`);
  }

  return (
    <section className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">Catalog management</p>
          <h1>Catalog</h1>
          <p>Create products, edit menu details, and control active status.</p>
        </div>
        <button className="secondary-button" type="button" onClick={resetForm}>
          <Plus size={17} strokeWidth={2.35} aria-hidden="true" />
          New product
        </button>
      </div>

      <div className="admin-two-column">
        <section className="admin-panel" aria-labelledby="product-editor-heading">
          <h2 id="product-editor-heading">{selectedProduct ? "Edit product" : "Create product"}</h2>
          <form className="admin-form" onSubmit={handleSubmit}>
            <label>
              <span>Name</span>
              <input
                required
                type="text"
                value={formProduct.name}
                onChange={(event) => updateField("name", event.target.value)}
              />
            </label>

            <label>
              <span>Description</span>
              <textarea
                rows="3"
                value={formProduct.description}
                onChange={(event) => updateField("description", event.target.value)}
              />
            </label>

            <div className="admin-form-grid">
              <label>
                <span>Base Price</span>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={formProduct.basePrice}
                  onChange={(event) => updateField("basePrice", event.target.value)}
                />
              </label>

              <label>
                <span>Category</span>
                <select
                  value={formProduct.category}
                  onChange={(event) => updateField("category", event.target.value)}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              <span>Image</span>
              <input
                type="text"
                value={formProduct.image}
                onChange={(event) => updateField("image", event.target.value)}
              />
            </label>

            <label className="admin-check-row">
              <input
                checked={formProduct.active}
                type="checkbox"
                onChange={(event) => updateField("active", event.target.checked)}
              />
              <span>Active product</span>
            </label>

            <section className="variant-editor-section" aria-labelledby="variant-editor-heading">
              <div className="section-heading">
                <div>
                  <h3 id="variant-editor-heading">Variants</h3>
                  <p>Use variants when a product has separate sizes or prices.</p>
                </div>
                <button className="secondary-button" type="button" onClick={addVariant}>
                  <Plus size={16} strokeWidth={2.35} aria-hidden="true" />
                  Add variant
                </button>
              </div>

              {formProduct.variants?.length ? (
                <div className="variant-editor-list">
                  {formProduct.variants.map((variant, index) => (
                    <article className="variant-editor-row" key={variant.id}>
                      <div className="variant-sort-actions" aria-label={`Reorder ${variant.name || "variant"}`}>
                        <button
                          type="button"
                          onClick={() => moveVariant(variant.id, -1)}
                          disabled={index === 0}
                          aria-label="Move variant up"
                        >
                          <ArrowUp size={15} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveVariant(variant.id, 1)}
                          disabled={index === formProduct.variants.length - 1}
                          aria-label="Move variant down"
                        >
                          <ArrowDown size={15} aria-hidden="true" />
                        </button>
                      </div>
                      <label>
                        <span>Variant Name</span>
                        <input
                          type="text"
                          value={variant.name}
                          onChange={(event) => updateVariant(variant.id, "name", event.target.value)}
                        />
                      </label>
                      <label>
                        <span>Price</span>
                        <input
                          min="0"
                          step="0.01"
                          type="number"
                          value={variant.price}
                          onChange={(event) => updateVariant(variant.id, "price", event.target.value)}
                        />
                      </label>
                      <label className="admin-check-row variant-active-row">
                        <input
                          checked={variant.active}
                          type="checkbox"
                          onChange={(event) => updateVariant(variant.id, "active", event.target.checked)}
                        />
                        <span>Active</span>
                      </label>
                      <button
                        className="icon-button danger-button"
                        type="button"
                        onClick={() => removeVariant(variant.id)}
                        aria-label={`Delete ${variant.name || "variant"}`}
                      >
                        <Trash2 size={16} strokeWidth={2.3} aria-hidden="true" />
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-variant-note">No variants. Customers will order this product at its base price.</p>
              )}
            </section>

            <section className="variant-editor-section" aria-labelledby="modifier-linkage-heading">
              <div className="section-heading">
                <div>
                  <h3 id="modifier-linkage-heading">Modifier groups</h3>
                  <p>Attach add-ons and customizations to this product.</p>
                </div>
              </div>

              {modifierGroups.length ? (
                <div className="modifier-link-list">
                  {modifierGroups.map((group) => {
                    const optionCount = group.options?.length || 0;
                    const isAttached = formProduct.modifierGroupIds?.includes(group.id);

                    return (
                      <label className="admin-check-row modifier-link-row" key={group.id}>
                        <input
                          checked={isAttached}
                          type="checkbox"
                          onChange={(event) =>
                            updateModifierGroupSelection(group.id, event.target.checked)
                          }
                        />
                        <span>
                          {group.name}
                          <small>
                            {group.active ?? true ? "Active" : "Inactive"} ·{" "}
                            {group.required ? "Required" : "Optional"} · min {group.minSelections} · max{" "}
                            {group.maxSelections || optionCount} · {optionCount} options
                          </small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="empty-variant-note">No modifier groups are configured yet.</p>
              )}
            </section>

            <div className="admin-form-actions">
              <button className="primary-button" type="submit">
                {selectedProduct ? "Save changes" : "Create product"}
              </button>
              {selectedProduct ? (
                <button className="secondary-button" type="button" onClick={resetForm}>
                  Cancel
                </button>
              ) : null}
            </div>
            {status ? <p className="form-status">{status}</p> : null}
          </form>
        </section>

        <section className="admin-panel" aria-labelledby="product-list-heading">
          <div className="section-heading">
            <h2 id="product-list-heading">Products</h2>
            <span>{products.length} total</span>
          </div>

          <div className="admin-list">
            {sortedProducts.map((product) => {
              const category = categoryById.get(product.category);
              const isActive = product.active ?? product.available;
              const variantCount = product.variants?.length || 0;

              return (
                <article className="admin-list-row" key={product.id}>
                  <div>
                    <strong>{product.name}</strong>
                    <span>{category?.name || product.category}</span>
                    <p>{product.description}</p>
                  </div>
                  <div className="admin-row-meta">
                    <strong>{formatPrice(product.basePrice ?? product.price)}</strong>
                    <span>{variantCount} {variantCount === 1 ? "variant" : "variants"}</span>
                    <button
                      className={isActive ? "status-pill available" : "status-pill"}
                      type="button"
                      onClick={() =>
                        updateProduct(product.id, { active: !isActive, available: !isActive })
                      }
                    >
                      {isActive ? "Active" : "Inactive"}
                    </button>
                  </div>
                  <div className="admin-row-actions">
                    <button type="button" onClick={() => startEdit(product)} aria-label={`Edit ${product.name}`}>
                      <Pencil size={16} strokeWidth={2.3} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => handleRemove(product)} aria-label={`Delete ${product.name}`}>
                      <Trash2 size={16} strokeWidth={2.3} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}
