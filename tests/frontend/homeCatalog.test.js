import assert from "node:assert/strict";
import test from "node:test";

import {
  createHomeCatalogView,
  getHomeCategoryById,
} from "../../src/services/homeCatalog.js";

function adaptedCatalog() {
  return {
    categories: [
      { id: "coffee", name: "Coffee" },
      { id: "espresso", name: "Espresso" },
      { id: "pastries", name: "Pastries" },
      { id: "iced-drinks", name: "Iced Drinks" },
    ],
    products: [
      {
        id: "drip-coffee",
        category: "coffee",
        name: "Drip Coffee",
        available: true,
        featured: true,
        sortOrder: 0,
      },
      {
        id: "cold-brew",
        category: "iced-drinks",
        name: "Cold Brew",
        available: true,
        featured: true,
        sortOrder: 1,
      },
      {
        id: "latte",
        category: "espresso",
        name: "Latte",
        available: true,
        featured: true,
        sortOrder: 2,
      },
      {
        id: "croissant",
        category: "pastries",
        name: "Butter Croissant",
        available: true,
        featured: true,
        sortOrder: 7,
      },
      {
        id: "muffin",
        category: "pastries",
        name: "Blueberry Muffin",
        available: true,
        featured: false,
        sortOrder: 8,
      },
      {
        id: "hidden-tea",
        category: "tea",
        name: "Hidden Tea",
        available: false,
        featured: true,
        sortOrder: 9,
      },
    ],
  };
}

test("Home preserves featured product order and crafted-drink count", () => {
  const catalog = adaptedCatalog();
  const view = createHomeCatalogView("ready", catalog);

  assert.equal(view.status, "ready");
  assert.equal(view.categories, catalog.categories);
  assert.deepEqual(
    view.popularItems.map((product) => product.id),
    ["drip-coffee", "cold-brew", "latte", "croissant"]
  );
  assert.equal(view.coffeeCount, 3);
});

test("Home resolves category summaries from adapted API categories", () => {
  const categories = adaptedCatalog().categories;

  assert.equal(getHomeCategoryById(categories, "espresso").name, "Espresso");
  assert.equal(getHomeCategoryById(categories, "missing"), undefined);
});

test("Home produces safe loading and error projections without stale data", () => {
  const loading = createHomeCatalogView("loading", null);
  const error = createHomeCatalogView("error", null);

  assert.deepEqual(loading, {
    status: "loading",
    categories: [],
    popularItems: [],
    coffeeCount: 0,
  });
  assert.deepEqual(error, {
    status: "error",
    categories: [],
    popularItems: [],
    coffeeCount: 0,
  });
});

test("Home handles a successful empty catalog", () => {
  assert.deepEqual(
    createHomeCatalogView("empty", {
      categories: [],
      products: [],
    }),
    {
      status: "empty",
      categories: [],
      popularItems: [],
      coffeeCount: 0,
    }
  );
});
