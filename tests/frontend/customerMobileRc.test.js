import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const menu = await readFile(new URL("../../src/pages/MenuPage.jsx", import.meta.url), "utf8");
const account = await readFile(new URL("../../src/pages/AccountPage.jsx", import.meta.url), "utf8");
const orders = await readFile(new URL("../../src/pages/OrdersPageMobile.jsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../../src/style.css", import.meta.url), "utf8");

test("mobile quick order supports horizontal swipes without blocking vertical page scroll", () => {
  assert.match(styles, /\.home-page \.quick-product-rail \{[\s\S]*?grid-auto-columns:\s*minmax\(176px, 78%\)/);
  assert.match(styles, /overflow-x:\s*auto/);
  assert.match(styles, /scroll-snap-type:\s*x proximity/);
  assert.match(styles, /touch-action:\s*pan-x pan-y/);
  assert.doesNotMatch(styles, /touch-action:\s*pan-x\s*;/);
  assert.match(styles, /\.home-page \.quick-product-card \{[\s\S]*?scroll-snap-align:\s*start/);
});

test("Home Quick Order links truthfully to the menu", async () => {
  const home = await readFile(new URL("../../src/pages/HomePage.jsx", import.meta.url), "utf8");
  assert.match(home, /<Link to="\/menu">View menu<\/Link>/);
  assert.doesNotMatch(home, /<Link to="\/menu">Customize<\/Link>/);
});

test("mobile loyalty and product cards use compact presentations", () => {
  assert.match(styles, /\.home-page \.loyalty-card \.stamp-row \{[\s\S]*?width:\s*92px/);
  assert.match(styles, /\.app-product-card\.is-expanded \.product-customization/);
  assert.match(styles, /\.product-customization \{[\s\S]*?display:\s*none/);
  assert.match(styles, /\.product-customization\.is-simple \{[\s\S]*?display:\s*grid/);
  assert.match(menu, /aria-expanded=\{isExpanded\}/);
  assert.match(menu, /"Customize"/);
});

test("customization, pricing selections, and add action remain mounted", () => {
  assert.match(menu, /<ProductModifiers/);
  assert.match(menu, /updateSelection\(item\.id, groupId, value\)/);
  assert.match(menu, /getConfiguredPrice\(item, selections\)/);
  assert.match(menu, /className=\{`product-add-button/);
  assert.match(menu, /onAdd=\{\(\) => addItem\(item\)\}/);
});

test("direct and simple products avoid Customize while complex products stay collapsible", () => {
  assert.match(menu, /choicePresentation === "complex"/);
  assert.match(menu, /choicePresentation === "direct"/);
  assert.match(menu, /choicePresentation === "simple" \? " is-simple"/);
  assert.match(menu, /getConfiguredPrice\(item, selections\)/);
  assert.match(menu, /<ProductAddAction isAdded=\{isAdded\} quantity=\{quantity\}/);
});

test("exact cart quantity and repeat-add action are unambiguous", () => {
  assert.match(menu, /\{quantity\} in cart/);
  assert.match(menu, /quantity \? "Add another" : "Add to order"/);
  assert.doesNotMatch(menu, /Add again/);
});

test("generic image keys do not render as individual product photos", () => {
  assert.match(menu, /getProductSpecificImageUrl/);
  assert.match(menu, /productImageUrl \? <div className="product-thumb"/);
  assert.doesNotMatch(menu, /item-thumb-\$\{item\.image\}/);
});

test("customer content clears fixed navigation and accounts for safe area", () => {
  assert.match(styles, /padding-bottom:\s*calc\(88px \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(styles, /\.bottom-nav \{[\s\S]*?padding-bottom:\s*env\(safe-area-inset-bottom, 0px\)/);
});

test("account navigation precedes profile content without duplication", () => {
  const navigationIndex = account.indexOf("account-section-nav");
  const profileIndex = account.indexOf('id="profile"');
  assert.ok(navigationIndex > 0 && navigationIndex < profileIndex);
  assert.equal(account.match(/>My Orders</g)?.length, 1);
  assert.equal(account.match(/>Logout</g)?.length, 1);
});

test("orders keep reorder and use a collapse interaction", () => {
  assert.match(orders, />Reorder</);
  assert.match(orders, />Collapse</);
  assert.doesNotMatch(orders, />Back</);
  assert.match(orders, /compact-info-row/);
});
