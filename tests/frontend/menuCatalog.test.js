import assert from "node:assert/strict";
import test from "node:test";

import {
  getCartLineId,
  getCategoryById,
  getConfiguredPrice,
  getDefaultSelections,
  getModifierGroupsForProduct,
  getSelectedOptions,
  groupProductsByCategory,
} from "../../src/services/menuCatalog.js";

function adaptedDrink() {
  return {
    id: "latte",
    backendId: "100",
    name: "Latte",
    price: 5.25,
    basePriceCents: 525,
    category: "espresso",
    available: true,
    featured: true,
    modifierGroups: [
      {
        id: "size",
        name: "Size",
        type: "single",
        required: true,
        options: [
          {
            id: "small",
            backendId: "1001",
            variantId: "1001",
            name: "Small",
            priceDelta: 0,
          },
          {
            id: "large",
            backendId: "1002",
            variantId: "1002",
            name: "Large",
            priceDelta: 1.25,
          },
        ],
      },
      {
        id: "milk",
        backendId: "200",
        name: "Milk",
        type: "single",
        required: false,
        options: [
          {
            id: "whole",
            backendId: "2001",
            name: "Whole milk",
            priceDelta: 0,
          },
          {
            id: "oat",
            backendId: "2002",
            name: "Oat",
            priceDelta: 0.85,
          },
        ],
      },
      {
        id: "flavour-shots",
        backendId: "300",
        name: "Flavour shots",
        type: "multiple",
        required: false,
        options: [
          {
            id: "vanilla",
            backendId: "3001",
            name: "Vanilla",
            priceDelta: 0.75,
          },
          {
            id: "caramel",
            backendId: "3002",
            name: "Caramel",
            priceDelta: 0.75,
          },
        ],
      },
    ],
  };
}

test("Menu groups adapted products in API category order", () => {
  const categories = [
    { id: "coffee", name: "Coffee", note: "House cups." },
    { id: "espresso", name: "Espresso", note: "Steamed favorites." },
    { id: "extras", name: "Extras", note: "Add-ons." },
  ];
  const products = [
    adaptedDrink(),
    {
      id: "drip-coffee",
      name: "Drip Coffee",
      category: "coffee",
      available: true,
      modifierGroups: [],
    },
    {
      id: "hidden",
      name: "Hidden",
      category: "extras",
      available: false,
      modifierGroups: [],
    },
  ];

  const sections = groupProductsByCategory(categories, products);

  assert.deepEqual(
    sections.map((section) => [section.id, section.items.map((item) => item.id)]),
    [
      ["coffee", ["drip-coffee"]],
      ["espresso", ["latte"]],
    ]
  );
  assert.equal(getCategoryById(categories, "espresso").name, "Espresso");
});

test("Menu defaults to the first variant and single modifier options", () => {
  const product = adaptedDrink();

  assert.deepEqual(getDefaultSelections(product), {
    size: "small",
    milk: "whole",
    "flavour-shots": [],
  });
  assert.deepEqual(
    getModifierGroupsForProduct(product).map((group) => group.id),
    ["size", "milk", "flavour-shots"]
  );
});

test("Menu preserves variant and modifier pricing behavior", () => {
  const product = adaptedDrink();
  const selections = {
    size: "large",
    milk: "oat",
    "flavour-shots": ["vanilla", "caramel"],
  };
  const selected = getSelectedOptions(product, selections);

  assert.deepEqual(
    selected.map(
      ({ groupId, id, backendId, variantId, priceDelta }) => ({
        groupId,
        id,
        backendId,
        variantId,
        priceDelta,
      })
    ),
    [
      {
        groupId: "size",
        id: "large",
        backendId: "1002",
        variantId: "1002",
        priceDelta: 1.25,
      },
      {
        groupId: "milk",
        id: "oat",
        backendId: "2002",
        variantId: undefined,
        priceDelta: 0.85,
      },
      {
        groupId: "flavour-shots",
        id: "vanilla",
        backendId: "3001",
        variantId: undefined,
        priceDelta: 0.75,
      },
      {
        groupId: "flavour-shots",
        id: "caramel",
        backendId: "3002",
        variantId: undefined,
        priceDelta: 0.75,
      },
    ]
  );
  assert.equal(getConfiguredPrice(product, selections), 8.85);
});

test("Menu cart-line identity changes with variants and modifiers", () => {
  const product = adaptedDrink();
  const small = getSelectedOptions(product, {
    size: "small",
    milk: "whole",
    "flavour-shots": [],
  });
  const largeOat = getSelectedOptions(product, {
    size: "large",
    milk: "oat",
    "flavour-shots": ["vanilla"],
  });

  assert.equal(
    getCartLineId(product, small),
    "latte__milk:whole|size:small"
  );
  assert.equal(
    getCartLineId(product, largeOat),
    "latte__flavour-shots:vanilla|milk:oat|size:large"
  );
  assert.notEqual(
    getCartLineId(product, small),
    getCartLineId(product, largeOat)
  );
});
