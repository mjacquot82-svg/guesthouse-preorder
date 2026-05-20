import { useEffect, useState } from "react";
import { initialCatalogProducts } from "../data/catalog.js";

const CATALOG_STORAGE_KEY = "cafe-catalog-products";
const CATALOG_UPDATED_EVENT = "cafe-catalog-updated";

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

function writeStoredProducts(products) {
  window.localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(products));
  window.dispatchEvent(new CustomEvent(CATALOG_UPDATED_EVENT));
}

function normalizeProduct(product) {
  return {
    ...product,
    price: Number(product.price) || 0,
    available: Boolean(product.available),
    featured: Boolean(product.featured),
    modifierGroupIds: product.modifierGroupIds || [],
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

export function getCatalogProducts() {
  return readStoredProducts();
}

export function saveCatalogProducts(products) {
  writeStoredProducts(products.map(normalizeProduct));
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
