import { mockProducts } from "../data/mockProducts";

export async function getProducts() {
  return mockProducts;
}

// Future Supabase-ready function shape
export async function saveProduct(product) {
  console.log("Future Supabase product save:", product);
}
