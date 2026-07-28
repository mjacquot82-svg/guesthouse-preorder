export function getModifierGroupsForProduct(product) {
  return product.modifierGroups || [];
}

export function getCategoryById(categories, categoryId) {
  return categories.find((category) => category.id === categoryId);
}

export function getDefaultSelections(product) {
  return getModifierGroupsForProduct(product).reduce((selections, group) => {
    const defaultOption = group.options[0]?.id;
    return {
      ...selections,
      [group.id]: group.type === "multiple" ? [] : defaultOption || "",
    };
  }, {});
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
