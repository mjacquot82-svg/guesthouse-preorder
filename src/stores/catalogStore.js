import { useCallback, useEffect, useState } from "react";
import { useOwnerAuth } from "../auth/OwnerAuthContext.jsx";
import {
  archiveOwnerProduct,
  clearOwnerCatalogCache,
  createOwnerProduct,
  fetchOwnerCatalogCached,
  updateOwnerProduct,
  updateOwnerProductAvailability,
  updateLunchSpecial,
} from "../services/ownerCatalogApi.js";

export function createProductId(name) {
  const value = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return value || `product-${Date.now()}`;
}

function adaptOwnerCatalog(payload) {
  const categories = (payload.categories || []).map((item) => ({
    id: item.slug, backendId: item.id, name: item.name, note: item.note, published: item.published,
  }));
  const modifierGroups = (payload.modifier_groups || []).filter((item) => item.active).map((item) => ({
    id: item.key, backendId: item.id, name: item.name,
  }));
  const categoryByBackendId = new Map(categories.map((item) => [item.backendId, item.id]));
  const groupByBackendId = new Map(modifierGroups.map((item) => [item.backendId, item.id]));
  const products = (payload.products || []).map((item) => ({
    id: item.slug,
    backendId: item.id,
    name: item.name,
    description: item.description,
    price: item.base_price_cents / 100,
    basePriceCents: item.base_price_cents,
    category: categoryByBackendId.get(item.category_id) || item.category_id,
    categoryBackendId: item.category_id,
    image: item.image,
    available: item.available,
    featured: item.featured,
    lunchSpecial: item.lunch_special,
    published: item.published,
    sortOrder: item.sort_order,
    variants: item.variants || [],
    modifierGroupIds: item.modifier_group_ids.map((id) => groupByBackendId.get(id)).filter(Boolean),
  }));
  return { categories, modifierGroups, products };
}

function toWriteProduct(product, categories, modifierGroups) {
  const category = categories.find((item) => item.id === product.category) || categories[0];
  const groupIds = new Map(modifierGroups.map((item) => [item.id, item.backendId]));
  return {
    slug: product.id,
    name: product.name,
    description: product.description || "",
    base_price_cents: Math.round(Number(product.price) * 100),
    category_id: Number(category?.backendId || product.categoryBackendId),
    image: product.image || "",
    available: Boolean(product.available),
    featured: Boolean(product.featured),
    lunch_special: Boolean(product.lunchSpecial),
    published: product.published !== false,
    sort_order: product.sortOrder || 0,
    variants: (product.variants || []).map((item) => ({
      key: item.key, name: item.name, price_cents: item.price_cents,
      active: item.active !== false, sort_order: item.sort_order,
    })),
    modifier_group_ids: (product.modifierGroupIds || []).map((id) => Number(groupIds.get(id))),
  };
}

export function useCatalogProducts({ enabled = true } = {}) {
  const { session } = useOwnerAuth();
  const [catalog, setCatalog] = useState({ categories: [], modifierGroups: [], products: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async ({ force = false } = {}) => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setCatalog(adaptOwnerCatalog(await fetchOwnerCatalogCached({ force })));
      setError(null);
    } catch (nextError) {
      setError(nextError);
      throw nextError;
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { reload().catch(() => {}); }, [reload]);

  async function addProduct(product) {
    await createOwnerProduct(toWriteProduct(product, catalog.categories, catalog.modifierGroups), session.csrf_token);
    clearOwnerCatalogCache();
    await reload({ force: true });
  }
  async function updateProduct(productId, updates) {
    const current = catalog.products.find((item) => item.id === productId);
    const next = { ...current, ...updates };
    await updateOwnerProduct(current.backendId, toWriteProduct(next, catalog.categories, catalog.modifierGroups), session.csrf_token);
    clearOwnerCatalogCache();
    await reload({ force: true });
  }
  async function setProductAvailability(productId, available) {
    const current = catalog.products.find((item) => item.id === productId);
    if (!current) throw new Error("Product not found.");
    setCatalog((value) => ({
      ...value,
      products: value.products.map((item) => item.id === productId ? { ...item, available } : item),
    }));
    try {
      await updateOwnerProductAvailability(current.backendId, available, session.csrf_token);
      clearOwnerCatalogCache();
    } catch (nextError) {
      setCatalog((value) => ({
        ...value,
        products: value.products.map((item) => item.id === productId ? { ...item, available: current.available } : item),
      }));
      throw nextError;
    }
  }
  async function setLunchSpecial(productId) {
    const current = productId
      ? catalog.products.find((item) => item.id === productId)
      : null;
    if (productId && !current) throw new Error("Product not found.");
    await updateLunchSpecial(current ? Number(current.backendId) : null, session.csrf_token);
    clearOwnerCatalogCache();
    await reload({ force: true });
  }
  async function removeProduct(productId) {
    const current = catalog.products.find((item) => item.id === productId);
    await archiveOwnerProduct(current.backendId, session.csrf_token);
    clearOwnerCatalogCache();
    await reload({ force: true });
  }

  return { ...catalog, addProduct, updateProduct, setProductAvailability, setLunchSpecial, removeProduct, loading, error, reload };
}
