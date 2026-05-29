import { useMemo, useState } from "react";
import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";
import { useCatalogCategories } from "../stores/catalogStore.js";
import { useDailySpecials } from "../stores/dailySpecialStore.js";

const emptySpecial = {
  id: "",
  title: "",
  description: "",
  price: "",
  categoryId: "",
  imageUrl: "",
  active: false,
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
};

function formatPrice(price) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

function formatDate(dateValue) {
  if (!dateValue) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateValue}T00:00:00`));
}

function createSpecialId(title) {
  const baseId = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `daily-special-${baseId || Date.now()}`;
}

function toFormSpecial(special) {
  return {
    ...emptySpecial,
    ...special,
    price: String(special.price ?? ""),
  };
}

export default function DailySpecialPage() {
  const { categories } = useCatalogCategories();
  const { dailySpecials, addDailySpecial, updateDailySpecial, removeDailySpecial } = useDailySpecials();
  const [selectedSpecialId, setSelectedSpecialId] = useState("");
  const [formSpecial, setFormSpecial] = useState(emptySpecial);
  const [status, setStatus] = useState("");

  const selectedSpecial = useMemo(
    () => dailySpecials.find((special) => special.id === selectedSpecialId),
    [dailySpecials, selectedSpecialId]
  );

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  function updateField(field, value) {
    setFormSpecial((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setSelectedSpecialId("");
    setFormSpecial(emptySpecial);
  }

  function startEdit(special) {
    setSelectedSpecialId(special.id);
    setFormSpecial(toFormSpecial(special));
    setStatus("");
  }

  function handleSubmit(event) {
    event.preventDefault();

    const price = Number(formSpecial.price);
    const payload = {
      ...formSpecial,
      id: selectedSpecialId || createSpecialId(formSpecial.title),
      title: formSpecial.title.trim(),
      description: formSpecial.description.trim(),
      imageUrl: formSpecial.imageUrl.trim(),
      price,
      active: Boolean(formSpecial.active),
    };

    if (!payload.title || Number.isNaN(price) || price <= 0) {
      setStatus("Add a title and a valid price.");
      return;
    }

    if (!payload.startDate || !payload.endDate || payload.endDate < payload.startDate) {
      setStatus("Choose a valid start and end date.");
      return;
    }

    if (selectedSpecial) {
      updateDailySpecial(selectedSpecial.id, payload);
      setStatus(`${payload.title} updated.`);
    } else {
      const existingIds = new Set(dailySpecials.map((special) => special.id));
      const uniqueId = existingIds.has(payload.id) ? `${payload.id}-${Date.now()}` : payload.id;
      addDailySpecial({ ...payload, id: uniqueId });
      setStatus(`${payload.title} created.`);
    }

    resetForm();
  }

  function toggleActive(special) {
    updateDailySpecial(special.id, { active: !special.active });
    setStatus(`${special.title} ${special.active ? "deactivated" : "activated"}.`);
  }

  function handleRemove(special) {
    removeDailySpecial(special.id);
    if (selectedSpecialId === special.id) {
      resetForm();
    }
    setStatus(`${special.title} deleted.`);
  }

  return (
    <section className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">Lunch feature</p>
          <h1>Daily Special</h1>
          <p>Create, schedule, and activate the lunch special shown to customers.</p>
        </div>
        <button className="secondary-button" type="button" onClick={resetForm}>
          <Plus size={17} strokeWidth={2.35} aria-hidden="true" />
          New special
        </button>
      </div>

      <div className="admin-two-column">
        <section className="admin-panel" aria-labelledby="daily-special-editor-heading">
          <h2 id="daily-special-editor-heading">
            {selectedSpecial ? "Edit special" : "Create special"}
          </h2>
          <form className="admin-form" onSubmit={handleSubmit}>
            <label>
              <span>Title</span>
              <input
                required
                type="text"
                value={formSpecial.title}
                onChange={(event) => updateField("title", event.target.value)}
                placeholder="Turkey Club + Soup"
              />
            </label>

            <label>
              <span>Description</span>
              <textarea
                rows="3"
                value={formSpecial.description}
                onChange={(event) => updateField("description", event.target.value)}
              />
            </label>

            <div className="admin-form-grid">
              <label>
                <span>Price</span>
                <input
                  min="0"
                  required
                  step="0.01"
                  type="number"
                  value={formSpecial.price}
                  onChange={(event) => updateField("price", event.target.value)}
                />
              </label>

              <label>
                <span>Category</span>
                <select
                  value={formSpecial.categoryId}
                  onChange={(event) => updateField("categoryId", event.target.value)}
                >
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              <span>Image URL</span>
              <input
                type="url"
                value={formSpecial.imageUrl}
                onChange={(event) => updateField("imageUrl", event.target.value)}
                placeholder="Optional placeholder image URL"
              />
            </label>

            <div className="admin-form-grid">
              <label>
                <span>Start Date</span>
                <input
                  required
                  type="date"
                  value={formSpecial.startDate}
                  onChange={(event) => updateField("startDate", event.target.value)}
                />
              </label>

              <label>
                <span>End Date</span>
                <input
                  required
                  type="date"
                  value={formSpecial.endDate}
                  onChange={(event) => updateField("endDate", event.target.value)}
                />
              </label>
            </div>

            <label className="admin-check-row">
              <input
                checked={formSpecial.active}
                type="checkbox"
                onChange={(event) => updateField("active", event.target.checked)}
              />
              <span>Active daily special</span>
            </label>

            <div className="admin-form-actions">
              <button className="primary-button" type="submit">
                {selectedSpecial ? "Save changes" : "Create special"}
              </button>
              {selectedSpecial ? (
                <button className="secondary-button" type="button" onClick={resetForm}>
                  Cancel
                </button>
              ) : null}
            </div>
            {status ? <p className="form-status">{status}</p> : null}
          </form>
        </section>

        <section className="admin-panel" aria-labelledby="daily-special-list-heading">
          <div className="section-heading">
            <h2 id="daily-special-list-heading">Specials</h2>
            <span>{dailySpecials.length} total</span>
          </div>

          <div className="admin-list">
            {dailySpecials.map((special) => {
              const category = categoryById.get(special.categoryId);

              return (
                <article className="admin-list-row daily-special-row" key={special.id}>
                  <div>
                    <strong>{special.title}</strong>
                    <span>{category?.name || "No category"}</span>
                    <p>{special.description}</p>
                  </div>
                  <div className="admin-row-meta">
                    <strong>{formatPrice(special.price)}</strong>
                    <span className="daily-special-date">
                      <CalendarDays size={14} strokeWidth={2.35} aria-hidden="true" />
                      {formatDate(special.startDate)} - {formatDate(special.endDate)}
                    </span>
                    <button
                      className={special.active ? "status-pill available" : "status-pill"}
                      type="button"
                      onClick={() => toggleActive(special)}
                    >
                      {special.active ? "Active" : "Inactive"}
                    </button>
                  </div>
                  <div className="admin-row-actions">
                    <button type="button" onClick={() => startEdit(special)} aria-label={`Edit ${special.title}`}>
                      <Pencil size={16} strokeWidth={2.3} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => handleRemove(special)} aria-label={`Delete ${special.title}`}>
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
