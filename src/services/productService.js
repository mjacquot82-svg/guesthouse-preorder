import { getCatalogProducts, saveCatalogProducts } from "../stores/catalogStore.js";

export async function getProducts() {
  return getCatalogProducts();
}

// Future Supabase-ready function shape
export async function saveProduct(product) {
  const products = getCatalogProducts();
  const existingProduct = products.find((item) => item.id === product.id);
  const nextProducts = existingProduct
    ? products.map((item) => (item.id === product.id ? product : item))
    : [...products, product];

  saveCatalogProducts(nextProducts);
  return product;
}
