import { useMemo, useState } from "react";
import { createProductId, useCatalogProducts } from "../stores/catalogStore.js";

const emptyProduct = {
  id: "",
  name: "",
  description: "",
  price: "",
  category: "",
  image: "",
  available: true,
  featured: false,
  modifierGroupIds: [],
};

function formatPrice(price) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(price);
}

function toFormProduct(product) {
  return {
    ...emptyProduct,
    ...product,
    price: String(product.price ?? ""),
    modifierGroupIds: product.modifierGroupIds || [],
  };
}

export default function ProductsPage() {
  const { products, categories, modifierGroups, addProduct, updateProduct, removeProduct, loading, error } = useCatalogProducts();
  const [selectedProductId, setSelectedProductId] = useState("");
  const [formProduct, setFormProduct] = useState(emptyProduct);
  const [status, setStatus] = useState("");

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId),
    [products, selectedProductId]
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

  function toggleModifierGroup(groupId) {
    setFormProduct((current) => {
      const currentGroups = current.modifierGroupIds || [];
      return {
        ...current,
        modifierGroupIds: currentGroups.includes(groupId)
          ? currentGroups.filter((item) => item !== groupId)
          : [...currentGroups, groupId],
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
    setFormProduct(emptyProduct);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const productId = selectedProductId || createProductId(formProduct.name);
    const payload = {
      ...formProduct,
      id: productId,
      name: formProduct.name.trim(),
      description: formProduct.description.trim(),
      price: Number(formProduct.price),
    };

    if (!payload.name || Number.isNaN(payload.price)) {
      setStatus("Add a product name and valid price.");
      return;
    }

    if (selectedProduct) {
      try {
        await updateProduct(selectedProduct.id, payload);
        setStatus(`${payload.name} updated.`);
      } catch (saveError) {
        setStatus(saveError.message);
        return;
      }
    } else {
      const existingIds = new Set(products.map((product) => product.id));
      const uniqueId = existingIds.has(productId) ? `${productId}-${Date.now()}` : productId;
      try {
        await addProduct({ ...payload, id: uniqueId });
        setStatus(`${payload.name} added.`);
      } catch (saveError) {
        setStatus(saveError.message);
        return;
      }
    }

    resetForm();
  }

  async function handleRemove(product) {
    try {
      await removeProduct(product.id);
    } catch (removeError) {
      setStatus(removeError.message);
      return;
    }
    if (selectedProductId === product.id) {
      resetForm();
    }
    setStatus(`${product.name} archived.`);
  }

  return (
    <section className="page-section admin-products-page">
      <div className="page-heading admin-page-heading">
        <div>
          <p className="eyebrow">Owner workspace</p>
          <h1>Products</h1>
          <p>Manage the production catalog.</p>
        </div>
        <button className="secondary-button admin-reset-button" type="button" onClick={resetForm}>
          New product
        </button>
      </div>

      <div className="admin-products-layout">
        <section className="product-editor-panel" aria-labelledby="product-editor-heading">
          <h2 id="product-editor-heading">{selectedProduct ? "Edit product" : "Add product"}</h2>
          <form className="product-form" onSubmit={handleSubmit}>
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

            <div className="form-grid">
              <label>
                <span>Price</span>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={formProduct.price}
                  onChange={(event) => updateField("price", event.target.value)}
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
              <span>Image token</span>
              <input
                type="text"
                value={formProduct.image}
                onChange={(event) => updateField("image", event.target.value)}
              />
            </label>

            <div className="toggle-row">
              <label>
                <input
                  checked={formProduct.available}
                  type="checkbox"
                  onChange={(event) => updateField("available", event.target.checked)}
                />
                <span>Available</span>
              </label>
              <label>
                <input
                  checked={formProduct.featured}
                  type="checkbox"
                  onChange={(event) => updateField("featured", event.target.checked)}
                />
                <span>Featured</span>
              </label>
            </div>

            <fieldset className="admin-modifier-picker">
              <legend>Modifier groups</legend>
              {modifierGroups.map((group) => (
                <label key={group.id}>
                  <input
                    checked={(formProduct.modifierGroupIds || []).includes(group.id)}
                    type="checkbox"
                    onChange={() => toggleModifierGroup(group.id)}
                  />
                  <span>{group.name}</span>
                </label>
              ))}
            </fieldset>

            <div className="form-actions">
              <button className="primary-button" type="submit">
                {selectedProduct ? "Save changes" : "Add product"}
              </button>
              {selectedProduct ? (
                <button className="secondary-button" type="button" onClick={resetForm}>
                  Cancel
                </button>
              ) : null}
            </div>
            {status ? <p className="form-status">{status}</p> : null}
            {error ? <p className="form-status">{error.message}</p> : null}
          </form>
        </section>

        <section className="product-list-panel" aria-labelledby="product-list-heading">
          <div className="section-heading">
            <h2 id="product-list-heading">Catalog items</h2>
            <span>{loading ? "Loading…" : `${products.length} products`}</span>
          </div>

          <div className="product-table">
            {sortedProducts.map((product) => {
              const category = categories.find((item) => item.id === product.category);

              return (
                <article className="product-row" key={product.id}>
                  <div>
                    <strong>{product.name}</strong>
                    <span>{category?.name || product.category}</span>
                    <p>{product.description}</p>
                  </div>
                  <div className="product-row-meta">
                    <strong>{formatPrice(product.price)}</strong>
                    <button
                      className={product.available ? "status-pill available" : "status-pill"}
                      type="button"
                      onClick={() => updateProduct(product.id, { available: !product.available })}
                    >
                      {product.available ? "Available" : "Hidden"}
                    </button>
                  </div>
                  <div className="product-row-actions">
                    <button type="button" onClick={() => startEdit(product)}>
                      Edit
                    </button>
                    <button type="button" onClick={() => handleRemove(product)}>
                      Remove
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
