import assert from "node:assert/strict";
import test from "node:test";

import { visibleProducts } from "../../src/services/ownerProductFilters.js";

const products = [
  { id: "tea", name: "Tea", description: "Herbal", category: "drinks", available: true, published: true },
  { id: "americano", name: "Americano", description: "Espresso and water", category: "drinks", available: false, published: true },
  { id: "muffin", name: "Muffin", description: "Blueberry", category: "food", available: true, published: false },
];

test("product tools search and sort alphabetically", () => {
  assert.deepEqual(visibleProducts(products).map(({ id }) => id), ["americano", "muffin", "tea"]);
  assert.deepEqual(visibleProducts(products, { query: "espresso" }).map(({ id }) => id), ["americano"]);
});

test("product tools distinguish unavailable from hidden and preserve category scope", () => {
  assert.deepEqual(visibleProducts(products, { status: "unavailable" }).map(({ id }) => id), ["americano"]);
  assert.deepEqual(visibleProducts(products, { status: "hidden" }).map(({ id }) => id), ["muffin"]);
  assert.deepEqual(visibleProducts(products, { category: "drinks", status: "available" }).map(({ id }) => id), ["tea"]);
});
