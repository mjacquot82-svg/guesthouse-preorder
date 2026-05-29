import { useEffect, useState } from "react";
import { initialCatalogProducts, menuCategories } from "../data/catalog.js";

const CATALOG_STORAGE_KEY = "cafe-catalog-products";
const CATEGORY_STORAGE_KEY = "cafe-catalog-categories";
const CATALOG_UPDATED_EVENT = "cafe-catalog-updated";
const CATEGORY_UPDATED_EVENT = "cafe-categories-updated";

function readStoredProducts() {
  if (typeof window === "undefined") {
    return initialCatalogProducts;
  }

  try {
    const stored = window.localStorage.getItem(CATALOG_STORAGE_KEY);
    return stored ? JSON.parse(stored) : initialCatalogProducts;
  } catch {
    return initialCatalogProducts;
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

function writeStoredProducts(products) {
  window.localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(products));
  window.dispatchEvent(new CustomEvent(CATALOG_UPDATED_EVENT));
}

function writeStoredCategories(categories) {
  window.localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categories));
  window.dispatchEvent(new CustomEvent(CATEGORY_UPDATED_EVENT));
}

function normalizeProduct(product) {
  return {
    ...product,
    basePrice: Number(product.basePrice ?? product.price) || 0,
    price: Number(product.price) || 0,
    active: product.active ?? product.available ?? true,
    available: product.available ?? product.active ?? true,
    featured: Boolean(product.featured),
    variantIds: product.variantIds || [],
    modifierGroupIds: product.modifierGroupIds || [],
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

export function getCatalogProducts() {
  return readStoredProducts();
}

export function getCatalogCategories() {
  return readStoredCategories();
}

export function saveCatalogProducts(products) {
  writeStoredProducts(products.map(normalizeProduct));
}

export function saveCatalogCategories(categories) {
  writeStoredCategories(categories.map(normalizeCategory));
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
