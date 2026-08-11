export function getModifierGroupsForProduct(product) {
  return product.modifierGroups || [];
}

export function getProductSpecificImageUrl(product) {
  const image = product?.image?.trim();

  if (!image) {
    return "";
  }

  return /^(https?:\/\/|data:image\/|blob:|\.?\.?\/)/i.test(image) ? image : "";
}

export function getProductChoicePresentation(product) {
  const groups = getModifierGroupsForProduct(product);

  if (!groups.length) {
    return "direct";
  }

  const [group] = groups;
  return groups.length === 1 && group.type === "single" && group.options.length <= 4
    ? "simple"
    : "complex";
}

export function getCategoryById(categories, categoryId) {
  return categories.find((category) => category.id === categoryId);
}

export function resolveMenuCategory(sections, categorySlug, targetProduct) {
  const requestedCategory = targetProduct?.category || categorySlug;

  return sections.some((section) => section.id === requestedCategory)
    ? requestedCategory
    : sections[0]?.id || "";
}

export function getDefaultSelections(product, { selectRequired = false } = {}) {
  return getModifierGroupsForProduct(product).reduce((selections, group) => {
    return {
      ...selections,
      [group.id]: selectRequired && group.required && group.options[0]
        ? (group.allowQuantity ? { [group.options[0].id]: 1 } : group.type === "multiple" ? [group.options[0].id] : group.options[0].id)
        : group.allowQuantity ? {} : group.type === "multiple" ? [] : "",
    };
  }, {});
}

export function getMissingRequiredChoice(product, selections) {
  return getModifierGroupsForProduct(product).find((group) => {
    const selectedValue = selections[group.id];
    if (selectedValue === "__none__") return group.required;
    const selectedCount = group.allowQuantity
      ? Object.values(selectedValue || {}).reduce((sum, quantity) => sum + quantity, 0)
      : Array.isArray(selectedValue)
      ? selectedValue.length
      : selectedValue
        ? 1
        : 0;
    const minimum = group.required ? Math.max(1, group.minSelections || 0) : group.minSelections || 0;
    return selectedCount < minimum || (group.maxSelections > 0 && selectedCount > group.maxSelections) || selectedCount === 0;
  });
}

export function getSelectedOptions(product, selections) {
  return getModifierGroupsForProduct(product).flatMap((group) => {
    const selectedValue = selections[group.id];
    const selectedIds = group.allowQuantity
      ? Object.keys(selectedValue || {}).filter((id) => selectedValue[id] > 0)
      : Array.isArray(selectedValue)
      ? selectedValue
      : [selectedValue];

    return selectedIds
      .map((optionId) => {
        const option = group.options.find((item) => item.id === optionId);
        return option
          ? { groupId: group.id, groupName: group.name, quantity: group.allowQuantity ? selectedValue[optionId] : 1, ...option }
          : null;
      })
      .filter(Boolean);
  });
}

export function getConfiguredPrice(product, selections) {
  return getSelectedOptions(product, selections).reduce(
    (sum, option) => sum + (Number(option.priceDelta) || 0) * (option.quantity || 1),
    product.price
  );
}

export function getCartLineId(product, selectedOptions) {
  const optionSignature = selectedOptions
    .map((option) => `${option.groupId}:${option.id}${(option.quantity || 1) > 1 ? `:${option.quantity}` : ""}`)
    .sort()
    .join("|");

  return optionSignature
    ? `${product.id}__${optionSignature}`
    : product.id;
}

export function groupProductsByCategory(categories, products) {
  return categories
    .map((category) => ({
      ...category,
      items: products.filter(
        (product) =>
          product.category === category.id && product.available
      ),
    }))
    .filter((section) => section.items.length);
}
