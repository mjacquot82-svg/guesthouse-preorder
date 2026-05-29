import { useEffect, useState } from "react";
import { initialCatalogProducts, menuCategories, modifierGroups } from "../data/catalog.js";

const CATALOG_STORAGE_KEY = "cafe-catalog-products";
const CATEGORY_STORAGE_KEY = "cafe-catalog-categories";
const MODIFIER_GROUP_STORAGE_KEY = "cafe-catalog-modifier-groups";
const CATALOG_UPDATED_EVENT = "cafe-catalog-updated";
const CATEGORY_UPDATED_EVENT = "cafe-categories-updated";
const MODIFIER_GROUP_UPDATED_EVENT = "cafe-modifier-groups-updated";

const SIZE_MODIFIER_GROUP_ID = "size";

function readStoredProducts() {
  if (typeof window === "undefined") {
    return initialCatalogProducts.map(normalizeProduct);
  }

  try {
    const stored = window.localStorage.getItem(CATALOG_STORAGE_KEY);
    const products = stored ? JSON.parse(stored) : initialCatalogProducts;
    return products.map(normalizeProduct);
  } catch {
    return initialCatalogProducts.map(normalizeProduct);
  }
}

function readStoredCategories() {
  if (typeof window === "undefined") {
    return menuCategories;
  }

  try {
    const stored = window.localStorage.getItem(CATEGORY_STORAGE_KEY);
    return stored ? JSON.parse(stored) : menuCategories;
  } catch {
    return menuCategories;
  }
}

function readStoredModifierGroups() {
  if (typeof window === "undefined") {
    return modifierGroups.map(normalizeModifierGroup);
  }

  try {
    const stored = window.localStorage.getItem(MODIFIER_GROUP_STORAGE_KEY);
    const groups = stored ? JSON.parse(stored) : modifierGroups;
    return groups.map(normalizeModifierGroup).filter((group) => group.id !== SIZE_MODIFIER_GROUP_ID);
  } catch {
    return modifierGroups.map(normalizeModifierGroup).filter((group) => group.id !== SIZE_MODIFIER_GROUP_ID);
  }
}

function writeStoredProducts(products) {
  window.localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(products));
  window.dispatchEvent(new CustomEvent(CATALOG_UPDATED_EVENT));
}

function writeStoredCategories(categories) {
  window.localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categories));
  window.dispatchEvent(new CustomEvent(CATEGORY_UPDATED_EVENT));
}

function writeStoredModifierGroups(groups) {
  window.localStorage.setItem(MODIFIER_GROUP_STORAGE_KEY, JSON.stringify(groups));
  window.dispatchEvent(new CustomEvent(MODIFIER_GROUP_UPDATED_EVENT));
}

function createSizeVariant(product, name, price, sortOrder) {
  return {
    id: `${product.id}-${name.toLowerCase()}`,
    name,
    price,
    active: true,
    sortOrder,
    modifierGroupIds: [],
  };
}

function getMigratedSizeVariants(product) {
  const groupIds = product.modifierGroupIds || [];

  if (!groupIds.includes(SIZE_MODIFIER_GROUP_ID) || product.variants?.length) {
    return Array.isArray(product.variants) ? product.variants : [];
  }

  const basePrice = Number(product.basePrice ?? product.price) || 0;

  return [
    createSizeVariant(product, "Small", Math.max(0, basePrice), 0),
    createSizeVariant(product, "Medium", basePrice + 0.75, 1),
    createSizeVariant(product, "Large", basePrice + 1.25, 2),
  ];
}

function normalizeProduct(product) {
  const variants = getMigratedSizeVariants(product)
    .map((variant, index) => ({
        id: variant.id || `variant-${Date.now()}-${index}`,
        name: variant.name?.trim() || "Untitled variant",
        price: Number(variant.price) || 0,
        active: variant.active ?? true,
        sortOrder: Number(variant.sortOrder ?? index) || 0,
        modifierGroupIds: variant.modifierGroupIds || [],
      }));

  return {
    ...product,
    basePrice: Number(product.basePrice ?? product.price) || 0,
    price: Number(product.price) || 0,
    active: product.active ?? product.available ?? true,
    available: product.available ?? product.active ?? true,
    featured: Boolean(product.featured),
    variants,
    variantIds: variants.map((variant) => variant.id),
    modifierGroupIds: (product.modifierGroupIds || []).filter(
      (groupId) => groupId !== SIZE_MODIFIER_GROUP_ID
    ),
  };
}

function normalizeCategory(category) {
  return {
    id: category.id,
    name: category.name?.trim() || "Untitled category",
    note: category.note?.trim() || "",
    active: category.active ?? true,
    sortOrder: Number(category.sortOrder) || 0,
  };
}

function normalizeModifierOption(option, index) {
  const priceAdjustment = Number(option.priceAdjustment ?? option.priceDelta) || 0;

  return {
    id: option.id || `option-${Date.now()}-${index}`,
    name: option.name?.trim() || "Untitled option",
    priceAdjustment,
    priceDelta: priceAdjustment,
    active: option.active ?? true,
    sortOrder: Number(option.sortOrder ?? index) || 0,
  };
}

function normalizeModifierGroup(group) {
  const selectionType =
    group.selectionType || group.type || (Number(group.maxSelections) > 1 ? "multiple" : "single");
  const isMultiple = selectionType === "multiple";
  const options = Array.isArray(group.options)
    ? group.options.map(normalizeModifierOption)
    : [];

  return {
    id: group.id,
    name: group.name?.trim() || "Untitled modifier group",
    description: group.description?.trim() || "",
    active: group.active ?? true,
    type: selectionType,
    selectionType,
    required: Boolean(group.required),
    minSelections: Number(group.minSelections ?? (group.required ? 1 : 0)) || 0,
    maxSelections: Number(group.maxSelections ?? (isMultiple ? options.length : 1)) || 0,
    options,
    optionIds: options.map((option) => option.id),
    appliesToProductIds: group.appliesToProductIds || [],
    sortOrder: Number(group.sortOrder) || 0,
  };
}

export function createProductId(name) {
  const baseId = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return baseId || `product-${Date.now()}`;
}

export function createCategoryId(name) {
  const baseId = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return baseId || `category-${Date.now()}`;
}

export function createModifierGroupId(name) {
  const baseId = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return baseId || `modifier-group-${Date.now()}`;
}

export function getCatalogProducts() {
  return readStoredProducts();
}

export function getCatalogCategories() {
  return readStoredCategories();
}

export function getCatalogModifierGroups() {
  return readStoredModifierGroups();
}

export function saveCatalogProducts(products) {
  writeStoredProducts(products.map(normalizeProduct));
}

export function saveCatalogCategories(categories) {
  writeStoredCategories(categories.map(normalizeCategory));
}

export function saveCatalogModifierGroups(groups) {
  writeStoredModifierGroups(groups.map(normalizeModifierGroup));
}

export function useCatalogProducts() {
  const [products, setProducts] = useState(readStoredProducts);

  useEffect(() => {
    function handleCatalogUpdate() {
      setProducts(readStoredProducts());
    }

    window.addEventListener("storage", handleCatalogUpdate);
    window.addEventListener(CATALOG_UPDATED_EVENT, handleCatalogUpdate);

    return () => {
      window.removeEventListener("storage", handleCatalogUpdate);
      window.removeEventListener(CATALOG_UPDATED_EVENT, handleCatalogUpdate);
    };
  }, []);

  function replaceProducts(nextProducts) {
    const normalizedProducts = nextProducts.map(normalizeProduct);
    setProducts(normalizedProducts);
    saveCatalogProducts(normalizedProducts);
  }

  function addProduct(product) {
    const normalizedProduct = normalizeProduct(product);
    replaceProducts([...products, normalizedProduct]);
  }

  function updateProduct(productId, updates) {
    replaceProducts(
      products.map((product) =>
        product.id === productId ? normalizeProduct({ ...product, ...updates }) : product
      )
    );
  }

  function removeProduct(productId) {
    replaceProducts(products.filter((product) => product.id !== productId));
  }

  return {
    products,
    addProduct,
    updateProduct,
    removeProduct,
    replaceProducts,
  };
}

export function useCatalogCategories() {
  const [categories, setCategories] = useState(readStoredCategories);

  useEffect(() => {
    function handleCategoryUpdate() {
      setCategories(readStoredCategories());
    }

    window.addEventListener("storage", handleCategoryUpdate);
    window.addEventListener(CATEGORY_UPDATED_EVENT, handleCategoryUpdate);

    return () => {
      window.removeEventListener("storage", handleCategoryUpdate);
      window.removeEventListener(CATEGORY_UPDATED_EVENT, handleCategoryUpdate);
    };
  }, []);

  function replaceCategories(nextCategories) {
    const normalizedCategories = nextCategories.map(normalizeCategory);
    setCategories(normalizedCategories);
    saveCatalogCategories(normalizedCategories);
  }

  function addCategory(category) {
    replaceCategories([...categories, normalizeCategory(category)]);
  }

  function updateCategory(categoryId, updates) {
    replaceCategories(
      categories.map((category) =>
        category.id === categoryId ? normalizeCategory({ ...category, ...updates }) : category
      )
    );
  }

  function removeCategory(categoryId) {
    replaceCategories(categories.filter((category) => category.id !== categoryId));
  }

  return {
    categories,
    addCategory,
    updateCategory,
    removeCategory,
    replaceCategories,
  };
}

export function useCatalogModifierGroups() {
  const [groups, setGroups] = useState(readStoredModifierGroups);

  useEffect(() => {
    function handleModifierGroupUpdate() {
      setGroups(readStoredModifierGroups());
    }

    window.addEventListener("storage", handleModifierGroupUpdate);
    window.addEventListener(MODIFIER_GROUP_UPDATED_EVENT, handleModifierGroupUpdate);

    return () => {
      window.removeEventListener("storage", handleModifierGroupUpdate);
      window.removeEventListener(MODIFIER_GROUP_UPDATED_EVENT, handleModifierGroupUpdate);
    };
  }, []);

  function replaceModifierGroups(nextGroups) {
    const normalizedGroups = nextGroups
      .map(normalizeModifierGroup)
      .filter((group) => group.id !== SIZE_MODIFIER_GROUP_ID);
    setGroups(normalizedGroups);
    saveCatalogModifierGroups(normalizedGroups);
  }

  function addModifierGroup(group) {
    replaceModifierGroups([...groups, normalizeModifierGroup(group)]);
  }

  function updateModifierGroup(groupId, updates) {
    replaceModifierGroups(
      groups.map((group) =>
        group.id === groupId ? normalizeModifierGroup({ ...group, ...updates }) : group
      )
    );
  }

  function removeModifierGroup(groupId) {
    replaceModifierGroups(groups.filter((group) => group.id !== groupId));
  }

  return {
    modifierGroups: groups,
    addModifierGroup,
    updateModifierGroup,
    removeModifierGroup,
    replaceModifierGroups,
  };
}
