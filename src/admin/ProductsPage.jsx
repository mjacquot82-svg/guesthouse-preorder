import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  createProductId,
  useCatalogCategories,
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

  return {
    ...emptyProduct,
    ...product,
    basePrice: String(basePrice),
    price: String(basePrice),
    active: product.active ?? product.available ?? true,
    available: product.available ?? product.active ?? true,
    variantIds: product.variantIds || [],
    modifierGroupIds: product.modifierGroupIds || [],
  };
}

export default function ProductsPage() {
  const { products, addProduct, updateProduct, removeProduct } = useCatalogProducts();
  const { categories } = useCatalogCategories();
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
    const payload = {
      ...formProduct,
      id: productId,
      name: formProduct.name.trim(),
      description: formProduct.description.trim(),
      basePrice,
      price: basePrice,
      active: Boolean(formProduct.active),
      available: Boolean(formProduct.active),
      variantIds: formProduct.variantIds || [],
      modifierGroupIds: formProduct.modifierGroupIds || [],
    };

    if (!payload.name || Number.isNaN(payload.basePrice)) {
      setStatus("Add a product name and valid base price.");
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

              return (
                <article className="admin-list-row" key={product.id}>
                  <div>
                    <strong>{product.name}</strong>
                    <span>{category?.name || product.category}</span>
                    <p>{product.description}</p>
                  </div>
                  <div className="admin-row-meta">
                    <strong>{formatPrice(product.basePrice ?? product.price)}</strong>
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
