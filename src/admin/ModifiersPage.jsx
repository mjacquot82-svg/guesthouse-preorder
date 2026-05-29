import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createModifierGroupId,
  useCatalogModifierGroups,
  useCatalogProducts,
} from "../stores/catalogStore.js";

const emptyGroup = {
  id: "",
  name: "",
  description: "",
  active: true,
  required: false,
  minSelections: 0,
  maxSelections: 1,
  options: [],
  optionIds: [],
};

const emptyOption = {
  id: "",
  name: "",
  priceAdjustment: "",
  active: true,
};

function formatPrice(price) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

function createModifierOptionId(name) {
  const baseId = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${baseId || "option"}-${Date.now()}`;
}

function toFormGroup(group) {
  return {
    ...emptyGroup,
    ...group,
    active: group.active ?? true,
    required: Boolean(group.required),
    minSelections: Number(group.minSelections ?? (group.required ? 1 : 0)) || 0,
    maxSelections: Number(group.maxSelections ?? 1) || 0,
    options: (group.options || [])
      .map((option, index) => ({
        id: option.id,
        name: option.name || "",
        priceAdjustment: String(option.priceAdjustment ?? option.priceDelta ?? 0),
        active: option.active ?? true,
        sortOrder: Number(option.sortOrder ?? index) || 0,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

function toFormOption(option) {
  return {
    ...emptyOption,
    ...option,
    priceAdjustment: String(option.priceAdjustment ?? ""),
    active: option.active ?? true,
  };
}

export default function ModifiersPage() {
  const { modifierGroups, addModifierGroup, updateModifierGroup, removeModifierGroup } =
    useCatalogModifierGroups();
  const { products, replaceProducts } = useCatalogProducts();
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [formGroup, setFormGroup] = useState(emptyGroup);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [formOption, setFormOption] = useState(emptyOption);
  const [status, setStatus] = useState("");

  const selectedGroup = useMemo(
    () => modifierGroups.find((group) => group.id === selectedGroupId),
    [modifierGroups, selectedGroupId]
  );

  const productCounts = useMemo(
    () =>
      products.reduce((counts, product) => {
        (product.modifierGroupIds || []).forEach((groupId) => {
          counts[groupId] = (counts[groupId] || 0) + 1;
        });
        return counts;
      }, {}),
    [products]
  );

  const sortedGroups = useMemo(
    () =>
      [...modifierGroups].sort((a, b) => {
        const sortCompare = (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
        return sortCompare || a.name.localeCompare(b.name);
      }),
    [modifierGroups]
  );

  function updateGroupField(field, value) {
    setFormGroup((current) => {
      if (field === "required") {
        const required = Boolean(value);
        return {
          ...current,
          required,
          minSelections: required ? Math.max(1, Number(current.minSelections) || 0) : current.minSelections,
        };
      }

      return { ...current, [field]: value };
    });
  }

  function resetGroupForm() {
    setSelectedGroupId("");
    setFormGroup(emptyGroup);
    resetOptionForm();
  }

  function startEditGroup(group) {
    setSelectedGroupId(group.id);
    setFormGroup(toFormGroup(group));
    resetOptionForm();
    setStatus("");
  }

  function resetOptionForm() {
    setSelectedOptionId("");
    setFormOption(emptyOption);
  }

  function startEditOption(option) {
    setSelectedOptionId(option.id);
    setFormOption(toFormOption(option));
    setStatus("");
  }

  function updateOptionField(field, value) {
    setFormOption((current) => ({ ...current, [field]: value }));
  }

  function handleOptionSubmit(event) {
    event?.preventDefault();

    const optionName = formOption.name.trim();
    const priceAdjustment = Number(formOption.priceAdjustment);

    if (!optionName || Number.isNaN(priceAdjustment)) {
      setStatus("Add an option name and valid price adjustment.");
      return;
    }

    setFormGroup((current) => {
      const optionId = selectedOptionId || createModifierOptionId(optionName);
      const existingIds = new Set((current.options || []).map((option) => option.id));
      const uniqueId = !selectedOptionId && existingIds.has(optionId) ? `${optionId}-${Date.now()}` : optionId;
      const optionPayload = {
        id: selectedOptionId || uniqueId,
        name: optionName,
        priceAdjustment,
        priceDelta: priceAdjustment,
        active: Boolean(formOption.active),
      };
      const currentOptions = current.options || [];
      const nextOptions = selectedOptionId
        ? currentOptions.map((option) =>
            option.id === selectedOptionId ? { ...option, ...optionPayload } : option
          )
        : [...currentOptions, optionPayload];

      return {
        ...current,
        options: nextOptions.map((option, index) => ({
          ...option,
          sortOrder: index,
        })),
      };
    });

    setStatus(selectedOptionId ? `${optionName} updated. Save the group to persist it.` : `${optionName} added. Save the group to persist it.`);
    resetOptionForm();
  }

  function removeOption(optionId) {
    setFormGroup((current) => ({
      ...current,
      options: (current.options || [])
        .filter((option) => option.id !== optionId)
        .map((option, index) => ({ ...option, sortOrder: index })),
    }));

    if (selectedOptionId === optionId) {
      resetOptionForm();
    }

    setStatus("Option removed. Save the group to persist it.");
  }

  function toggleOptionActive(optionId) {
    setFormGroup((current) => ({
      ...current,
      options: (current.options || []).map((option) =>
        option.id === optionId ? { ...option, active: !(option.active ?? true) } : option
      ),
    }));
  }

  function handleGroupSubmit(event) {
    event.preventDefault();

    const name = formGroup.name.trim();
    const minSelections = Number(formGroup.minSelections);
    const maxSelections = Number(formGroup.maxSelections);
    const options = (formGroup.options || []).map((option, index) => {
      const priceAdjustment = Number(option.priceAdjustment ?? option.priceDelta);

      return {
        ...option,
        name: option.name.trim(),
        priceAdjustment,
        priceDelta: priceAdjustment,
        active: option.active ?? true,
        sortOrder: index,
      };
    });

    if (!name) {
      setStatus("Add a modifier group name.");
      return;
    }

    if (
      Number.isNaN(minSelections) ||
      Number.isNaN(maxSelections) ||
      minSelections < 0 ||
      maxSelections < 0 ||
      maxSelections < minSelections
    ) {
      setStatus("Use valid minimum and maximum selections.");
      return;
    }

    if (formGroup.required && minSelections < 1) {
      setStatus("Required groups need at least one minimum selection.");
      return;
    }

    if (options.some((option) => !option.name || Number.isNaN(option.priceAdjustment))) {
      setStatus("Every option needs a name and valid price adjustment.");
      return;
    }

    const groupId = selectedGroupId || createModifierGroupId(name);
    const payload = {
      ...formGroup,
      id: groupId,
      name,
      description: formGroup.description.trim(),
      active: Boolean(formGroup.active),
      required: Boolean(formGroup.required),
      minSelections,
      maxSelections,
      selectionType: maxSelections > 1 ? "multiple" : "single",
      type: maxSelections > 1 ? "multiple" : "single",
      options,
      optionIds: options.map((option) => option.id),
    };

    if (selectedGroup) {
      updateModifierGroup(selectedGroup.id, payload);
      setStatus(`${payload.name} updated.`);
    } else {
      const existingIds = new Set(modifierGroups.map((group) => group.id));
      const uniqueId = existingIds.has(groupId) ? `${groupId}-${Date.now()}` : groupId;
      addModifierGroup({ ...payload, id: uniqueId });
      setStatus(`${payload.name} created.`);
    }

    resetGroupForm();
  }

  function handleRemoveGroup(group) {
    removeModifierGroup(group.id);
    replaceProducts(
      products.map((product) => ({
        ...product,
        modifierGroupIds: (product.modifierGroupIds || []).filter((groupId) => groupId !== group.id),
      }))
    );

    if (selectedGroupId === group.id) {
      resetGroupForm();
    }

    setStatus(`${group.name} deleted and removed from assigned products.`);
  }

  return (
    <section className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">Menu customization</p>
          <h1>Modifiers</h1>
          <p>Create option groups such as milk, flavour shots, extras, and add-ons.</p>
        </div>
        <button className="secondary-button" type="button" onClick={resetGroupForm}>
          <Plus size={17} strokeWidth={2.35} aria-hidden="true" />
          New group
        </button>
      </div>

      <div className="admin-two-column">
        <section className="admin-panel" aria-labelledby="modifier-editor-heading">
          <h2 id="modifier-editor-heading">
            {selectedGroup ? "Edit modifier group" : "Create modifier group"}
          </h2>
          <form className="admin-form" onSubmit={handleGroupSubmit}>
            <label>
              <span>Name</span>
              <input
                required
                type="text"
                value={formGroup.name}
                onChange={(event) => updateGroupField("name", event.target.value)}
              />
            </label>

            <label>
              <span>Description</span>
              <textarea
                rows="3"
                value={formGroup.description}
                onChange={(event) => updateGroupField("description", event.target.value)}
              />
            </label>

            <div className="admin-form-grid">
              <label>
                <span>Minimum Selections</span>
                <input
                  min="0"
                  step="1"
                  type="number"
                  value={formGroup.minSelections}
                  onChange={(event) => updateGroupField("minSelections", event.target.value)}
                />
              </label>
              <label>
                <span>Maximum Selections</span>
                <input
                  min="0"
                  step="1"
                  type="number"
                  value={formGroup.maxSelections}
                  onChange={(event) => updateGroupField("maxSelections", event.target.value)}
                />
              </label>
            </div>

            <div className="admin-form-grid compact-check-grid">
              <label className="admin-check-row">
                <input
                  checked={formGroup.active}
                  type="checkbox"
                  onChange={(event) => updateGroupField("active", event.target.checked)}
                />
                <span>Active group</span>
              </label>
              <label className="admin-check-row">
                <input
                  checked={formGroup.required}
                  type="checkbox"
                  onChange={(event) => updateGroupField("required", event.target.checked)}
                />
                <span>Required</span>
              </label>
            </div>

            <section className="variant-editor-section" aria-labelledby="option-editor-heading">
              <div className="section-heading">
                <div>
                  <h3 id="option-editor-heading">Options</h3>
                  <p>Add choices and price adjustments for this group.</p>
                </div>
              </div>

              <div className="modifier-option-form">
                <label>
                  <span>Option Name</span>
                  <input
                    type="text"
                    value={formOption.name}
                    onChange={(event) => updateOptionField("name", event.target.value)}
                  />
                </label>
                <label>
                  <span>Price Adjustment</span>
                  <input
                    step="0.01"
                    type="number"
                    value={formOption.priceAdjustment}
                    onChange={(event) => updateOptionField("priceAdjustment", event.target.value)}
                  />
                </label>
                <label className="admin-check-row variant-active-row">
                  <input
                    checked={formOption.active}
                    type="checkbox"
                    onChange={(event) => updateOptionField("active", event.target.checked)}
                  />
                  <span>Active</span>
                </label>
                <div className="admin-row-actions modifier-option-actions">
                  <button
                    type="button"
                    onClick={handleOptionSubmit}
                    aria-label={selectedOptionId ? "Save option" : "Add option"}
                  >
                    <Plus size={16} strokeWidth={2.3} aria-hidden="true" />
                  </button>
                  {selectedOptionId ? (
                    <button type="button" onClick={resetOptionForm} aria-label="Cancel option edit">
                      <X size={16} strokeWidth={2.3} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </div>

              {formGroup.options?.length ? (
                <div className="modifier-option-list">
                  {formGroup.options.map((option) => {
                    const isActive = option.active ?? true;

                    return (
                      <article className="modifier-option-row" key={option.id}>
                        <div>
                          <strong>{option.name}</strong>
                          <span>{formatPrice(Number(option.priceAdjustment ?? option.priceDelta) || 0)}</span>
                        </div>
                        <button
                          className={isActive ? "status-pill available" : "status-pill"}
                          type="button"
                          onClick={() => toggleOptionActive(option.id)}
                        >
                          {isActive ? "Active" : "Inactive"}
                        </button>
                        <div className="admin-row-actions">
                          <button type="button" onClick={() => startEditOption(option)} aria-label={`Edit ${option.name}`}>
                            <Pencil size={16} strokeWidth={2.3} aria-hidden="true" />
                          </button>
                          <button type="button" onClick={() => removeOption(option.id)} aria-label={`Delete ${option.name}`}>
                            <Trash2 size={16} strokeWidth={2.3} aria-hidden="true" />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="empty-variant-note">No options yet.</p>
              )}
            </section>

            <div className="admin-form-actions">
              <button className="primary-button" type="submit">
                {selectedGroup ? "Save changes" : "Create group"}
              </button>
              {selectedGroup ? (
                <button className="secondary-button" type="button" onClick={resetGroupForm}>
                  Cancel
                </button>
              ) : null}
            </div>
            {status ? <p className="form-status">{status}</p> : null}
          </form>
        </section>

        <section className="admin-panel" aria-labelledby="modifier-list-heading">
          <div className="section-heading">
            <h2 id="modifier-list-heading">Modifier groups</h2>
            <span>{modifierGroups.length} total</span>
          </div>

          <div className="admin-list">
            {sortedGroups.map((group) => {
              const optionCount = group.options?.length || 0;
              const assignedProducts = productCounts[group.id] || 0;
              const isActive = group.active ?? true;

              return (
                <article className="admin-list-row modifier-group-row" key={group.id}>
                  <div>
                    <strong>{group.name}</strong>
                    <span>
                      {group.required ? "Required" : "Optional"} · min {group.minSelections} · max{" "}
                      {group.maxSelections || optionCount}
                    </span>
                    <p>{group.description || `${optionCount} options · ${assignedProducts} products`}</p>
                  </div>
                  <div className="admin-row-meta">
                    <strong>{optionCount} options</strong>
                    <span>{assignedProducts} products</span>
                    <button
                      className={isActive ? "status-pill available" : "status-pill"}
                      type="button"
                      onClick={() => updateModifierGroup(group.id, { active: !isActive })}
                    >
                      {isActive ? "Active" : "Inactive"}
                    </button>
                  </div>
                  <div className="admin-row-actions">
                    <button type="button" onClick={() => startEditGroup(group)} aria-label={`Edit ${group.name}`}>
                      <Pencil size={16} strokeWidth={2.3} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => handleRemoveGroup(group)} aria-label={`Delete ${group.name}`}>
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
