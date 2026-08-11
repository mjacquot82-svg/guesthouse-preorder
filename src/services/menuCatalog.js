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
    const defaultOption = group.options[0]?.id;
    return {
      ...selections,
      [group.id]: group.type === "multiple" || (group.required && !selectRequired) ? [] : defaultOption || "",
    };
  }, {});
}

export function getMissingRequiredChoice(product, selections) {
  return getModifierGroupsForProduct(product).find((group) => {
    const selectedValue = selections[group.id];
    const selectedCount = Array.isArray(selectedValue)
      ? selectedValue.length
      : selectedValue
        ? 1
        : 0;
    const minimum = group.required ? Math.max(1, group.minSelections || 0) : group.minSelections || 0;
    return selectedCount < minimum;
  });
}

export function getSelectedOptions(product, selections) {
  return getModifierGroupsForProduct(product).flatMap((group) => {
    const selectedValue = selections[group.id];
    const selectedIds = Array.isArray(selectedValue)
      ? selectedValue
      : [selectedValue];

    return selectedIds
      .map((optionId) => {
        const option = group.options.find((item) => item.id === optionId);
        return option
          ? { groupId: group.id, groupName: group.name, ...option }
          : null;
      })
      .filter(Boolean);
  });
}

export function getConfiguredPrice(product, selections) {
  return getSelectedOptions(product, selections).reduce(
    (sum, option) => sum + (Number(option.priceDelta) || 0),
    product.price
  );
}

export function getCartLineId(product, selectedOptions) {
  const optionSignature = selectedOptions
    .map((option) => `${option.groupId}:${option.id}`)
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
