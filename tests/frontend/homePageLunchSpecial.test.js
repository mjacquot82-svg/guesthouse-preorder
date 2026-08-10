import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const home = await readFile(new URL("../../src/pages/HomePage.jsx", import.meta.url), "utf8");

test("homepage keeps lunch promotion distinct from restored quick ordering", () => {
  assert.doesNotMatch(home, /Order a favorite/);
  assert.match(home, /quick-product-rail/);
  assert.match(home, /Today’s Lunch Special/);
  assert.match(home, /Order Today’s Special/);
  assert.match(home, /recommendation\.description/);
  assert.match(home, /getConfiguredPrice\(recommendation/);
});

test("homepage removes compact favorites and renders a complete fallback", () => {
  assert.doesNotMatch(home, /Café favorites/);
  assert.doesNotMatch(home, /cafe-favorites-block/);
  assert.match(home, /Today’s Picks/);
  assert.match(home, /Browse today’s menu/);
  assert.match(home, /Something delicious is always waiting/);
});

test("homepage grid prioritizes lunch before browse and quick order", async () => {
  const styles = await readFile(new URL("../../src/style.css", import.meta.url), "utf8");
  const lunchStyles = styles.match(/\.home-page \.lunch-special-block \{[\s\S]*?\}/g) || [];

  assert.ok(lunchStyles.length >= 2);
  assert.match(lunchStyles.join("\n"), /grid-column:\s*1\s*\/\s*-1/);
  assert.match(styles, /\.home-page\.ordering-page \{[\s\S]*?grid-template-columns:/);
  assert.match(styles, /\.home-page \.home-category-block \{ grid-column: 1; \}/);
  assert.match(styles, /\.home-page \.quick-add-block \{ grid-column: 2; \}/);
  assert.match(styles, /\.home-page \.loyalty-card \{ grid-column: 1 \/ -1; \}/);
  assert.ok(home.indexOf("lunch-special-block") < home.indexOf("home-category-block"));
  assert.ok(home.indexOf("home-category-block") < home.indexOf("quick-add-block"));
});

test("category browser retains a stable place through catalog states", () => {
  assert.match(home, /Preparing the café menu/);
  assert.match(home, /Browse the full café menu/);
  assert.match(home, /Today’s menu is being prepared/);
  assert.match(home, /category-pill-grid/);
});

test("Home distinguishes unresolved, unavailable, and genuinely empty catalog states", () => {
  assert.match(home, /status === "ready" \? <span>\{coffeeCount\} crafted drinks<\/span> : null/);
  assert.match(home, /Loading today’s drinks…/);
  assert.match(home, /Menu count unavailable/);
  assert.match(home, /No crafted drinks available today/);
  assert.match(home, /Loading today’s special…/);
  assert.match(home, /Today’s special is temporarily unavailable/);
  assert.match(home, /onClick=\{reload\}>Try again/);
});

test("quick order restores one-tap horizontal product cards", () => {
  assert.match(home, /Quick Order/);
  assert.match(home, /quick-product-rail/);
  assert.match(home, /quick-product-card/);
  assert.match(home, /Quick add/);
  assert.match(home, /addQuickItem/);
  assert.match(home, /storeCart/);
  assert.match(home, /getProductSpecificImageUrl\(item\)/);
  assert.match(home, /productImageUrl \? \(/);
  assert.doesNotMatch(home, /item-thumb-\$\{item\.image\}/);
});

test("image-less lunch specials never inherit generic product photography", async () => {
  const styles = await readFile(new URL("../../src/style.css", import.meta.url), "utf8");

  assert.match(home, /getProductSpecificImageUrl\(recommendation\)/);
  assert.match(home, /recommendationImageUrl \? \(/);
  assert.doesNotMatch(home, /item-thumb-\$\{recommendation\.image\}/);
  assert.doesNotMatch(home, /Browse today’s café menu for fresh, seasonal recommendations/);
  assert.match(styles, /\.lunch-special-block\.is-image-free/);
});

test("mobile lunch special is compact and text-safe", async () => {
  const styles = await readFile(new URL("../../src/style.css", import.meta.url), "utf8");

  assert.match(styles, /\.home-page \.lunch-special-copy \{[\s\S]*?min-width:\s*0/);
  assert.match(styles, /\.home-page \.lunch-special-copy h3 \{[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(styles, /\.home-page \.lunch-special-copy \{[\s\S]*?padding:\s*16px/);
});
