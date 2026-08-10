import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const home = await readFile(new URL("../../src/pages/HomePage.jsx", import.meta.url), "utf8");
const menu = await readFile(new URL("../../src/pages/MenuPage.jsx", import.meta.url), "utf8");

test("Home category cards deep-link with each stable category slug", () => {
  assert.match(home, /category\.slug/);
  assert.match(home, /encodeURIComponent\(category\.slug\)/);
  assert.match(home, /\/menu\?category=/);

  const destination = (slug) => `/menu?category=${encodeURIComponent(slug)}`;
  assert.equal(destination("smoothies"), "/menu?category=smoothies");
  assert.equal(destination("coffee"), "/menu?category=coffee");
  assert.equal(destination("cold-drinks"), "/menu?category=cold-drinks");
});

test("Browse derives category selection from URL state on every render", () => {
  assert.match(menu, /searchParams\.get\("category"\)/);
  assert.match(menu, /resolveMenuCategory\(sections, categorySlug, targetProduct\)/);
  assert.doesNotMatch(menu, /useState\(firstSection\)/);
});

test("Browse category changes create Back-Forward-compatible category URLs", () => {
  assert.match(menu, /setSearchParams\(\{ category: section\.id \}\)/);
  assert.doesNotMatch(menu, /setSearchParams\(\{ category: section\.id \}, \{ replace: true \}\)/);
});

test("Browse clears obsolete product spotlight when selecting a category", () => {
  assert.match(menu, /setSpotlightProductId\(""\)/);
  assert.match(menu, /setExpandedProductId\(""\)/);
  assert.match(menu, /setSearchParams\(\{ category: section\.id \}\)/);
});

test("invalid categories are canonicalized with replace while plain menu stays plain", () => {
  assert.match(menu, /if \(status !== "ready" \|\| targetProduct \|\| !categorySlug\)/);
  assert.match(menu, /setSearchParams\(activeSectionId \? \{ category: activeSectionId \} : \{\}, \{ replace: true \}\)/);
});
