import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { dollarsToCents, toOwnerCustomizationWrite } from "../../src/services/modifierMoney.js";

test("owner modifier dollar input converts exactly to integer cents", () => {
  assert.equal(dollarsToCents("0"), 0);
  assert.equal(dollarsToCents("0.75"), 75);
  assert.equal(dollarsToCents("12.3"), 1230);
  assert.equal(dollarsToCents("-0.25"), null);
  assert.equal(dollarsToCents("0.001"), null);
  assert.equal(dollarsToCents("not money"), null);
});

test("Products and first-use screen use café-friendly customer-option language", async () => {
  const products = await readFile(new URL("../../src/admin/ProductsPage.jsx", import.meta.url), "utf8");
  const manager = await readFile(new URL("../../src/admin/ModifierManager.jsx", import.meta.url), "utf8");
  assert.match(products, />Manage customer options</);
  assert.match(products, /No customer options yet/);
  assert.match(products, /Which options can customers choose for this product/);
  assert.match(products, /modifierGroupIds\.includes\(group\.id\)/);
  assert.match(manager, /Create customization/);
  assert.match(manager, /No customer options yet/);
  assert.match(manager, /Name it, such as Milk/);
  assert.match(manager, /add the choices you offer/i);
  assert.doesNotMatch(manager, /Modifier groups/);
  assert.doesNotMatch(manager, /Customer-facing name/);
});

test("create and edit use one coherent form with draft choices and one save action", async () => {
  const manager = await readFile(new URL("../../src/admin/ModifierManager.jsx", import.meta.url), "utf8");
  assert.match(manager, /choices: \[choiceDraft\(\), choiceDraft\(\)\]/);
  assert.match(manager, />\+ Add choice</);
  assert.match(manager, /Save customization/);
  assert.match(manager, /Save changes/);
  assert.match(manager, /One save creates this customization and its starting choices/);
  assert.match(manager, /partialCustomization/);
  assert.match(manager, /if \(busy\) return/);
  assert.match(manager, /Your entries are still here; try again/);
});

test("simple single-choice rules map to the authoritative domain without numeric UI", async () => {
  const base = { name: "Milk", description: "", selectionType: "single", active: true, choices: [], sortOrder: 0 };
  assert.deepEqual(toOwnerCustomizationWrite({ ...base, required: false }, 4).group, {
    name: "Milk", description: "", selection_type: "single", required: false,
    min_selections: 0, max_selections: 1, active: true, sort_order: 0,
  });
  assert.deepEqual(toOwnerCustomizationWrite({ ...base, required: true }, 4).group, {
    name: "Milk", description: "", selection_type: "single", required: true,
    min_selections: 1, max_selections: 1, active: true, sort_order: 0,
  });
});

test("advanced limits appear only for choose-more-than-one while ordering stays implicit", async () => {
  const manager = await readFile(new URL("../../src/admin/ModifierManager.jsx", import.meta.url), "utf8");
  assert.match(manager, /Choose one/);
  assert.match(manager, /Choose more than one/);
  assert.match(manager, /draft\.selectionType === "single"[\s\S]*?: <div className="customization-limits"/);
  assert.match(manager, /Minimum choices/);
  assert.match(manager, /Maximum choices/);
  assert.doesNotMatch(manager, />Display order</);
  assert.match(manager, /Move up/);
  assert.match(manager, /Move down/);
});

test("choice price and availability language hide cents and safe-disable mechanics", async () => {
  const manager = await readFile(new URL("../../src/admin/ModifierManager.jsx", import.meta.url), "utf8");
  assert.match(manager, /Extra price/);
  assert.match(manager, /placeholder="0\.00"/);
  assert.match(manager, /Available to customers/);
  assert.match(manager, /Make unavailable/);
  assert.match(manager, /retained for existing products and order history/);
  assert.doesNotMatch(manager, /price_adjustment_cents/);
});

test("responsive modifier management styles collapse to one column", async () => {
  const css = await readFile(new URL("../../src/style.css", import.meta.url), "utf8");
  assert.match(css, /\.modifier-manager-layout \{[^}]*display: grid/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.modifier-manager-layout \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /\.customization-choice-row \{[\s\S]*?grid-template-columns:/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.customization-choice-row \{ grid-template-columns: 1fr; \}/);
});
