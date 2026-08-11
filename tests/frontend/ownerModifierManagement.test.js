import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { dollarsToCents } from "../../src/services/modifierMoney.js";

test("owner modifier dollar input converts exactly to integer cents", () => {
  assert.equal(dollarsToCents("0"), 0);
  assert.equal(dollarsToCents("0.75"), 75);
  assert.equal(dollarsToCents("12.3"), 1230);
  assert.equal(dollarsToCents("-0.25"), null);
  assert.equal(dollarsToCents("0.001"), null);
  assert.equal(dollarsToCents("not money"), null);
});

test("Products provides modifier entry, first-use state, assignments, and owner-friendly semantics", async () => {
  const products = await readFile(new URL("../../src/admin/ProductsPage.jsx", import.meta.url), "utf8");
  const manager = await readFile(new URL("../../src/admin/ModifierManager.jsx", import.meta.url), "utf8");
  assert.match(products, />Manage modifiers</);
  assert.match(products, /No modifier groups yet/);
  assert.match(products, /This product allows these customizations/);
  assert.match(products, /modifierGroupIds\.includes\(group\.id\)/);
  assert.match(manager, /Modifier groups let customers customize products/);
  assert.match(manager, /Choose one/);
  assert.match(manager, /Choose multiple/);
  assert.match(manager, /Required/);
  assert.match(manager, /Optional/);
  assert.match(manager, /Price adjustment is invalid/);
  assert.match(manager, /Enabled for customer ordering/);
});

test("responsive modifier management styles collapse to one column", async () => {
  const css = await readFile(new URL("../../src/style.css", import.meta.url), "utf8");
  assert.match(css, /\.modifier-manager-layout \{ display: grid/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.modifier-manager-layout \{ grid-template-columns: 1fr; \}/);
});
