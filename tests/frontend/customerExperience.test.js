import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getApiErrorMessage, getCustomerErrorMessage } from "../../src/services/customerMessages.js";
import { formatCustomerPhone, isCompleteCustomerPhone, normalizeCustomerPhone } from "../../src/services/customerPhone.js";

const authPageSource = await readFile(new URL("../../src/pages/CustomerAuthPage.jsx", import.meta.url), "utf8");
const resetPageSource = await readFile(new URL("../../src/pages/CustomerResetPage.jsx", import.meta.url), "utf8");
const verifyPageSource = await readFile(new URL("../../src/pages/CustomerVerifyPage.jsx", import.meta.url), "utf8");
const accountPageSource = await readFile(new URL("../../src/pages/AccountPage.jsx", import.meta.url), "utf8");
const cartPageSource = await readFile(new URL("../../src/pages/CartPage.jsx", import.meta.url), "utf8");

test("customer phone input formats progressively and normalizes to E.164", () => {
  assert.equal(formatCustomerPhone("519"), "519");
  assert.equal(formatCustomerPhone("519881"), "(519) 881");
  assert.equal(formatCustomerPhone("5198816869"), "(519) 881-6869");
  assert.equal(formatCustomerPhone("+1 (519) 881-6869"), "(519) 881-6869");
  assert.equal(normalizeCustomerPhone("(519) 881-6869"), "+15198816869");
  assert.equal(isCompleteCustomerPhone("519881686"), false);
  assert.equal(isCompleteCustomerPhone("5198816869"), true);
});

test("customer errors never stringify structured objects", () => {
  const fallback = "Please try again.";
  assert.equal(getApiErrorMessage({ detail: [{ msg: "invalid" }] }, fallback), fallback);
  assert.equal(getApiErrorMessage({ detail: { message: "Check your phone." } }, fallback), "Check your phone.");
  assert.equal(getCustomerErrorMessage({ message: "[object Object]" }, fallback), fallback);
  assert.equal(getCustomerErrorMessage({ message: { unsafe: true } }, fallback), fallback);
});

test("customer forms default persistence and expose guarded pending states", () => {
  assert.match(authPageSource, /useState\(true\)/);
  assert.match(authPageSource, /disabled=\{isSubmitting \|\| isResending\}/);
  assert.match(authPageSource, /Creating account…/);
  assert.match(authPageSource, /Signing in…/);
  assert.match(resetPageSource, /disabled=\{isSubmitting\}/);
  assert.match(resetPageSource, /Updating…/);
  assert.match(verifyPageSource, /disabled=\{isResending\}/);
  assert.match(accountPageSource, /disabled=\{isSaving\}/);
  assert.match(cartPageSource, /disabled=\{isPlacingOrder\}/);
  assert.match(cartPageSource, /Placing order…/);
});
