import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const home = await readFile(new URL("../../src/pages/HomePage.jsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../../src/style.css", import.meta.url), "utf8");

test("Home hero uses the single approved Ladel's asset and removes legacy content", async () => {
  await access(new URL("../../public/ladels.png", import.meta.url));
  assert.equal((home.match(/className="ladels-hero-logo"/g) || []).length, 1);
  assert.match(home, /src="\/ladels\.png" alt="Ladel's Wellness Café"/);
  assert.doesNotMatch(home, /Fresh café rituals, made easy/);
  assert.doesNotMatch(home, />Coffee bar</);
  assert.doesNotMatch(home, /Seasonal pours, bakery favorites, and quiet coffee bar classics/);
  assert.doesNotMatch(home, /className="cafe-hero-image"/);
  assert.doesNotMatch(home, /\{coffeeCount\} crafted drinks/);
  assert.doesNotMatch(home, /<div className="welcome-actions">/);
});

test("Home hero centers and contains the logo responsively", () => {
  assert.match(styles, /\.home-page \.app-welcome-panel \{[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*center;/);
  assert.match(styles, /\.home-page \.ladels-hero-logo \{[\s\S]*?max-width:\s*100%;[\s\S]*?object-fit:\s*contain;[\s\S]*?object-position:\s*center;/);
  assert.match(styles, /@media \(min-width: 761px\) \{[\s\S]*?\.home-page \.ladels-hero-logo \{[\s\S]*?width:\s*min\(48vw, 430px\);/);
  assert.match(styles, /@media \(max-width: 760px\) \{[\s\S]*?\.home-page \.ladels-hero-logo \{[\s\S]*?width:\s*min\(78vw, 280px\);[\s\S]*?max-height:\s*204px;/);
});

test("Home hero change leaves customer navigation labels in AppLayout", async () => {
  const layout = await readFile(new URL("../../src/layouts/AppLayout.jsx", import.meta.url), "utf8");
  for (const label of ["Home", "Browse", "Cart", "Account"]) {
    assert.match(layout, new RegExp(`label: "${label}"`));
  }
  assert.doesNotMatch(layout, /ladels\.png/);
});
