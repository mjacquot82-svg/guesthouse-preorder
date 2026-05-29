import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  createCategoryId,
  useCatalogCategories,
  useCatalogProducts,
} from "../stores/catalogStore.js";

const emptyCategory = {
  id: "",
  name: "",
  note: "",
  active: true,
  sortOrder: 0,
};

function toFormCategory(category) {
  return {
    ...emptyCategory,
    ...category,
  };
}

export default function CategoriesPage() {
  const { categories, addCategory, updateCategory, removeCategory } = useCatalogCategories();
  const { products } = useCatalogProducts();
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [formCategory, setFormCategory] = useState(emptyCategory);
  const [status, setStatus] = useState("");

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId),
    [categories, selectedCategoryId]
  );

  const productCounts = useMemo(
    () =>
      products.reduce((counts, product) => {
        counts[product.category] = (counts[product.category] || 0) + 1;
        return counts;
      }, {}),
    [products]
  );

  function updateField(field, value) {
    setFormCategory((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setSelectedCategoryId("");
    setFormCategory(emptyCategory);
  }

  function startEdit(category) {
    setSelectedCategoryId(category.id);
    setFormCategory(toFormCategory(category));
    setStatus("");
  }

  function handleSubmit(event) {
    event.preventDefault();

    const categoryId = selectedCategoryId || createCategoryId(formCategory.name);
    const payload = {
      ...formCategory,
      id: categoryId,
      name: formCategory.name.trim(),
      note: formCategory.note.trim(),
    };

    if (!payload.name) {
      setStatus("Add a category name.");
      return;
    }

    if (selectedCategory) {
      updateCategory(selectedCategory.id, payload);
      setStatus(`${payload.name} updated.`);
    } else {
      const existingIds = new Set(categories.map((category) => category.id));
      const uniqueId = existingIds.has(categoryId) ? `${categoryId}-${Date.now()}` : categoryId;
      addCategory({ ...payload, id: uniqueId });
      setStatus(`${payload.name} created.`);
    }

    resetForm();
  }

  function handleRemove(category) {
    const assignedProducts = productCounts[category.id] || 0;

    if (assignedProducts > 0) {
      setStatus(`Move ${assignedProducts} product${assignedProducts === 1 ? "" : "s"} before deleting.`);
      return;
    }

    removeCategory(category.id);
    if (selectedCategoryId === category.id) {
      resetForm();
    }
    setStatus(`${category.name} deleted.`);
  }

  return (
    <section className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">Menu organization</p>
          <h1>Categories</h1>
          <p>Create and maintain the category list used by catalog products.</p>
        </div>
        <button className="secondary-button" type="button" onClick={resetForm}>
          <Plus size={17} strokeWidth={2.35} aria-hidden="true" />
          New category
        </button>
      </div>

      <div className="admin-two-column">
        <section className="admin-panel" aria-labelledby="category-editor-heading">
          <h2 id="category-editor-heading">
            {selectedCategory ? "Edit category" : "Create category"}
          </h2>
          <form className="admin-form" onSubmit={handleSubmit}>
            <label>
              <span>Name</span>
              <input
                required
                type="text"
                value={formCategory.name}
                onChange={(event) => updateField("name", event.target.value)}
              />
            </label>

            <label>
              <span>Description</span>
              <textarea
                rows="3"
                value={formCategory.note}
                onChange={(event) => updateField("note", event.target.value)}
              />
            </label>

            <label className="admin-check-row">
              <input
                checked={formCategory.active}
                type="checkbox"
                onChange={(event) => updateField("active", event.target.checked)}
              />
              <span>Active category</span>
            </label>

            <div className="admin-form-actions">
              <button className="primary-button" type="submit">
                {selectedCategory ? "Save changes" : "Create category"}
              </button>
              {selectedCategory ? (
                <button className="secondary-button" type="button" onClick={resetForm}>
                  Cancel
                </button>
              ) : null}
            </div>
            {status ? <p className="form-status">{status}</p> : null}
          </form>
        </section>

        <section className="admin-panel" aria-labelledby="category-list-heading">
          <div className="section-heading">
            <h2 id="category-list-heading">Categories</h2>
            <span>{categories.length} total</span>
          </div>

          <div className="admin-list">
            {categories.map((category) => {
              const assignedProducts = productCounts[category.id] || 0;

              return (
                <article className="admin-list-row" key={category.id}>
                  <div>
                    <strong>{category.name}</strong>
                    <span>{assignedProducts} products</span>
                    <p>{category.note}</p>
                  </div>
                  <div className="admin-row-actions">
                    <button type="button" onClick={() => startEdit(category)} aria-label={`Edit ${category.name}`}>
                      <Pencil size={16} strokeWidth={2.3} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => handleRemove(category)} aria-label={`Delete ${category.name}`}>
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
