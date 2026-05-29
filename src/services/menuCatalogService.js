import { isSupabaseConfigured, supabase } from "../lib/supabase.js";

function bySortOrderThenName(a, b) {
  const sortCompare = (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
  return sortCompare || String(a.name || "").localeCompare(String(b.name || ""));
}

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

function throwIfError(error, context) {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

function toCategoryRow(category, index = 0) {
  return {
    id: category.id,
    name: category.name,
    note: category.note || "",
    active: category.active ?? true,
    sort_order: Number(category.sortOrder ?? index) || 0,
  };
}

function fromCategoryRow(row) {
  return {
    id: row.id,
    name: row.name,
    note: row.note || "",
    active: row.active ?? true,
    sortOrder: Number(row.sort_order) || 0,
  };
}

function toProductRow(product, index = 0) {
  return {
    id: product.id,
    category_id: product.category,
    name: product.name,
    description: product.description || "",
    base_price: Number(product.basePrice ?? product.price) || 0,
    price: Number(product.price ?? product.basePrice) || 0,
    image: product.image || "",
    active: product.active ?? product.available ?? true,
    featured: Boolean(product.featured),
    sort_order: Number(product.sortOrder ?? index) || 0,
    metadata: product.metadata || {},
  };
}

function fromProductRow(row, variants, modifierLinks) {
  const productVariants = variants
    .filter((variant) => variant.product_id === row.id)
    .map(fromVariantRow)
    .sort(bySortOrderThenName);
  const modifierGroupIds = modifierLinks
    .filter((link) => link.product_id === row.id && (link.active ?? true))
    .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
    .map((link) => link.modifier_group_id);

  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    category: row.category_id,
    basePrice: Number(row.base_price) || 0,
    price: Number(row.price) || 0,
    image: row.image || "",
    active: row.active ?? true,
    available: row.active ?? true,
    featured: Boolean(row.featured),
    sortOrder: Number(row.sort_order) || 0,
    metadata: row.metadata || {},
    variants: productVariants,
    variantIds: productVariants.map((variant) => variant.id),
    modifierGroupIds,
  };
}

function toVariantRow(productId, variant, index = 0) {
  return {
    id: variant.id,
    product_id: productId,
    name: variant.name,
    price: Number(variant.price) || 0,
    active: variant.active ?? true,
    sort_order: Number(variant.sortOrder ?? index) || 0,
    metadata: variant.metadata || {},
  };
}

function fromVariantRow(row) {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price) || 0,
    active: row.active ?? true,
    sortOrder: Number(row.sort_order) || 0,
    modifierGroupIds: [],
    metadata: row.metadata || {},
  };
}

function toModifierGroupRow(group, index = 0) {
  const selectionType = group.selectionType || group.type || "single";

  return {
    id: group.id,
    name: group.name,
    description: group.description || "",
    active: group.active ?? true,
    selection_type: selectionType,
    required: Boolean(group.required),
    min_selections: Number(group.minSelections) || 0,
    max_selections: Number(group.maxSelections) || 0,
    sort_order: Number(group.sortOrder ?? index) || 0,
    metadata: group.metadata || {},
  };
}

function fromModifierGroupRow(row, options) {
  const groupOptions = options
    .filter((option) => option.modifier_group_id === row.id)
    .map(fromModifierOptionRow)
    .sort(bySortOrderThenName);

  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    active: row.active ?? true,
    type: row.selection_type || "single",
    selectionType: row.selection_type || "single",
    required: Boolean(row.required),
    minSelections: Number(row.min_selections) || 0,
    maxSelections: Number(row.max_selections) || 0,
    options: groupOptions,
    optionIds: groupOptions.map((option) => option.id),
    appliesToProductIds: [],
    sortOrder: Number(row.sort_order) || 0,
    metadata: row.metadata || {},
  };
}

function toModifierOptionRow(groupId, option, index = 0) {
  return {
    id: option.id,
    modifier_group_id: groupId,
    name: option.name,
    price_adjustment: Number(option.priceAdjustment ?? option.priceDelta) || 0,
    active: option.active ?? true,
    sort_order: Number(option.sortOrder ?? index) || 0,
    metadata: option.metadata || {},
  };
}

function fromModifierOptionRow(row) {
  const priceAdjustment = Number(row.price_adjustment) || 0;

  return {
    id: row.id,
    name: row.name,
    priceAdjustment,
    priceDelta: priceAdjustment,
    active: row.active ?? true,
    sortOrder: Number(row.sort_order) || 0,
    metadata: row.metadata || {},
  };
}

function toProductModifierGroupRows(product) {
  return (product.modifierGroupIds || []).map((modifierGroupId, index) => ({
    product_id: product.id,
    modifier_group_id: modifierGroupId,
    active: true,
    sort_order: index,
  }));
}

export async function fetchMenuCatalogFromSupabase() {
  const client = requireSupabase();

  const [
    categoriesResponse,
    productsResponse,
    variantsResponse,
    modifierGroupsResponse,
    modifierOptionsResponse,
    productModifierGroupsResponse,
  ] = await Promise.all([
    client.from("categories").select("*").order("sort_order").order("name"),
    client.from("products").select("*").order("sort_order").order("name"),
    client.from("product_variants").select("*").order("sort_order").order("name"),
    client.from("modifier_groups").select("*").order("sort_order").order("name"),
    client.from("modifier_options").select("*").order("sort_order").order("name"),
    client.from("product_modifier_groups").select("*").order("sort_order"),
  ]);

  throwIfError(categoriesResponse.error, "Could not load categories");
  throwIfError(productsResponse.error, "Could not load products");
  throwIfError(variantsResponse.error, "Could not load product variants");
  throwIfError(modifierGroupsResponse.error, "Could not load modifier groups");
  throwIfError(modifierOptionsResponse.error, "Could not load modifier options");
  throwIfError(productModifierGroupsResponse.error, "Could not load product modifier groups");

  const variantRows = variantsResponse.data || [];
  const modifierLinkRows = productModifierGroupsResponse.data || [];
  const modifierOptionRows = modifierOptionsResponse.data || [];

  return {
    categories: (categoriesResponse.data || []).map(fromCategoryRow),
    products: (productsResponse.data || [])
      .map((product) => fromProductRow(product, variantRows, modifierLinkRows))
      .sort(bySortOrderThenName),
    modifierGroups: (modifierGroupsResponse.data || [])
      .map((group) => fromModifierGroupRow(group, modifierOptionRows))
      .sort(bySortOrderThenName),
  };
}

export async function upsertCategoriesToSupabase(categories) {
  const client = requireSupabase();
  const rows = categories.map(toCategoryRow);
  const { error } = await client.from("categories").upsert(rows);
  throwIfError(error, "Could not save categories");
}

export async function deleteCategoryFromSupabase(categoryId) {
  const client = requireSupabase();
  const { error } = await client.from("categories").delete().eq("id", categoryId);
  throwIfError(error, "Could not delete category");
}

export async function replaceProductsInSupabase(products) {
  const client = requireSupabase();
  const productRows = products.map(toProductRow);
  const variantRows = products.flatMap((product) =>
    (product.variants || []).map((variant, index) => toVariantRow(product.id, variant, index))
  );
  const modifierLinkRows = products.flatMap(toProductModifierGroupRows);
  const productIds = products.map((product) => product.id);

  if (productRows.length) {
    const { error } = await client.from("products").upsert(productRows);
    throwIfError(error, "Could not save products");
  }

  if (productIds.length) {
    throwIfError(
      (await client.from("product_variants").delete().in("product_id", productIds)).error,
      "Could not replace product variants"
    );

    throwIfError(
      (await client.from("product_modifier_groups").delete().in("product_id", productIds)).error,
      "Could not replace product modifier links"
    );
  }

  if (variantRows.length) {
    const { error } = await client.from("product_variants").upsert(variantRows);
    throwIfError(error, "Could not save product variants");
  }

  if (modifierLinkRows.length) {
    const { error } = await client
      .from("product_modifier_groups")
      .upsert(modifierLinkRows, { onConflict: "product_id,modifier_group_id" });
    throwIfError(error, "Could not save product modifier links");
  }
}

export async function deleteProductFromSupabase(productId) {
  const client = requireSupabase();
  const { error } = await client.from("products").delete().eq("id", productId);
  throwIfError(error, "Could not delete product");
}

export async function replaceModifierGroupsInSupabase(modifierGroups) {
  const client = requireSupabase();
  const groupRows = modifierGroups.map(toModifierGroupRow);
  const optionRows = modifierGroups.flatMap((group) =>
    (group.options || []).map((option, index) => toModifierOptionRow(group.id, option, index))
  );
  const groupIds = modifierGroups.map((group) => group.id);

  if (groupRows.length) {
    const { error } = await client.from("modifier_groups").upsert(groupRows);
    throwIfError(error, "Could not save modifier groups");
  }

  if (groupIds.length) {
    throwIfError(
      (await client.from("modifier_options").delete().in("modifier_group_id", groupIds)).error,
      "Could not replace modifier options"
    );
  }

  if (optionRows.length) {
    const { error } = await client.from("modifier_options").upsert(optionRows);
    throwIfError(error, "Could not save modifier options");
  }
}

export async function deleteModifierGroupFromSupabase(groupId) {
  const client = requireSupabase();

  throwIfError(
    (await client.from("product_modifier_groups").delete().eq("modifier_group_id", groupId)).error,
    "Could not remove modifier group product links"
  );

  const { error } = await client.from("modifier_groups").delete().eq("id", groupId);
  throwIfError(error, "Could not delete modifier group");
}

export async function seedMenuCatalogInSupabase(catalog) {
  await upsertCategoriesToSupabase(catalog.categories);
  await replaceModifierGroupsInSupabase(catalog.modifierGroups);
  await replaceProductsInSupabase(catalog.products);
}

export async function syncMenuCatalogToSupabase(catalog) {
  const client = requireSupabase();

  await seedMenuCatalogInSupabase(catalog);

  const remoteCatalog = await fetchMenuCatalogFromSupabase();
  const productIds = new Set(catalog.products.map((product) => product.id));
  const modifierGroupIds = new Set(catalog.modifierGroups.map((group) => group.id));
  const categoryIds = new Set(catalog.categories.map((category) => category.id));

  const deletedProductIds = remoteCatalog.products
    .map((product) => product.id)
    .filter((productId) => !productIds.has(productId));
  const deletedModifierGroupIds = remoteCatalog.modifierGroups
    .map((group) => group.id)
    .filter((groupId) => !modifierGroupIds.has(groupId));
  const deletedCategoryIds = remoteCatalog.categories
    .map((category) => category.id)
    .filter((categoryId) => !categoryIds.has(categoryId));

  if (deletedProductIds.length) {
    throwIfError(
      (await client.from("products").delete().in("id", deletedProductIds)).error,
      "Could not remove deleted products"
    );
  }

  for (const groupId of deletedModifierGroupIds) {
    await deleteModifierGroupFromSupabase(groupId);
  }

  if (deletedCategoryIds.length) {
    throwIfError(
      (await client.from("categories").delete().in("id", deletedCategoryIds)).error,
      "Could not remove deleted categories"
    );
  }
}
