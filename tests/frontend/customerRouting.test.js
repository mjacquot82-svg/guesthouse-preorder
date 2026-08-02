import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../../src/App.jsx", import.meta.url), "utf8");
const ownerContextSource = await readFile(
  new URL("../../src/auth/OwnerAuthContext.jsx", import.meta.url),
  "utf8"
);

test("customer authentication routes are registered", () => {
  for (const path of [
    "login",
    "register",
    "account",
    "account/verify-email",
    "account/reset-password",
  ]) {
    assert.match(appSource, new RegExp(`path=["']${path.replace("/", "\\/")}["']`));
  }
});

test("owner session lookup remains lazy outside protected owner routes", () => {
  assert.doesNotMatch(ownerContextSource, /useEffect/);
  assert.match(ownerContextSource, /fetchOwnerSession\(\)/);
});
