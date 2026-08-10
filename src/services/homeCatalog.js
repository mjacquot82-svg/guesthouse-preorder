const CRAFTED_DRINK_CATEGORIES = new Set([
  "coffee",
  "espresso",
  "tea",
  "iced-drinks",
]);

export function getHomeCategoryById(categories, categoryId) {
  return categories.find((category) => category.id === categoryId);
}

export function createQuickOrderItems(products, { featuredLimit = 4, limit = 6 } = {}) {
  const availableProducts = products.filter((product) => product.available);
  const prioritized = availableProducts
    .filter((product) => product.featured)
    .slice(0, featuredLimit);
  const prioritizedIds = new Set(prioritized.map((product) => product.id));

  return [
    ...prioritized,
    ...availableProducts.filter((product) => !prioritizedIds.has(product.id)),
  ].slice(0, limit);
}

export function createHomeCatalogView(status, catalog) {
  const categories = catalog?.categories || [];
  const products = catalog?.products || [];
  const availableProducts = products.filter((product) => product.available);

  return {
    status,
    categories,
    popularItems: availableProducts
      .filter((product) => product.featured)
      .slice(0, 4),
    lunchSpecial:
      availableProducts.find((product) => product.lunchSpecial) || null,
    coffeeCount: availableProducts.filter((product) =>
      CRAFTED_DRINK_CATEGORIES.has(product.category)
    ).length,
  };
}
