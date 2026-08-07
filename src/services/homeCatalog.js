const CRAFTED_DRINK_CATEGORIES = new Set([
  "coffee",
  "espresso",
  "tea",
  "iced-drinks",
]);

export function getHomeCategoryById(categories, categoryId) {
  return categories.find((category) => category.id === categoryId);
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
