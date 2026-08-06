import { useMemo, useState } from "react";
import { Check, Search, SlidersHorizontal } from "lucide-react";
import { createProductId, useCatalogProducts } from "../stores/catalogStore.js";
import { visibleProducts } from "../services/ownerProductFilters.js";
import { useOwnerAuth } from "../auth/OwnerAuthContext.jsx";
import { canEditProducts, canManageProductAvailability } from "../auth/ownerProductPermissions.js";

const emptyProduct = { id: "", name: "", description: "", price: "", category: "", image: "", available: true, featured: false, modifierGroupIds: [] };
const money = (price) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(price);
const toFormProduct = (product) => ({ ...emptyProduct, ...product, price: String(product.price ?? ""), modifierGroupIds: product.modifierGroupIds || [] });

export default function ProductsPage() {
  const { session } = useOwnerAuth();
  const canEdit = canEditProducts(session);
  const canManageAvailability = canManageProductAvailability(session);
  const { products, categories, modifierGroups, addProduct, updateProduct, setProductAvailability, loading, error } = useCatalogProducts();
  const [selectedProductId, setSelectedProductId] = useState("");
  const [formProduct, setFormProduct] = useState(emptyProduct);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [availabilityBusy, setAvailabilityBusy] = useState("");
  const [notice, setNotice] = useState("");
  const selectedProduct = useMemo(() => products.find((product) => product.id === selectedProductId), [products, selectedProductId]);
  const filtered = useMemo(() => visibleProducts(products, { category, query, status: statusFilter }), [products, category, query, statusFilter]);
  const updateField = (field, value) => setFormProduct((current) => ({ ...current, [field]: value }));
  const resetForm = () => { setSelectedProductId(""); setFormProduct({ ...emptyProduct, category: categories[0]?.id || "" }); };
  const startEdit = (product) => { setSelectedProductId(product.id); setFormProduct(toFormProduct(product)); setNotice(""); window.scrollTo?.({ top: 0, behavior: "smooth" }); };
  function toggleModifierGroup(groupId) { setFormProduct((current) => ({ ...current, modifierGroupIds: current.modifierGroupIds.includes(groupId) ? current.modifierGroupIds.filter((id) => id !== groupId) : [...current.modifierGroupIds, groupId] })); }

  async function toggleAvailability(product) {
    if (availabilityBusy) return;
    const next = !product.available;
    setAvailabilityBusy(product.id); setNotice("");
    try {
      await setProductAvailability(product.id, next);
      setNotice(next ? `${product.name} is back on today’s menu.` : `${product.name} is unavailable today.`);
    } catch (nextError) { setNotice(nextError.message); }
    finally { setAvailabilityBusy(""); }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    const productId = selectedProductId || createProductId(formProduct.name);
    const payload = { ...formProduct, id: productId, name: formProduct.name.trim(), description: formProduct.description.trim(), price: Number(formProduct.price), category: formProduct.category || categories[0]?.id };
    if (!payload.name || !Number.isFinite(payload.price) || payload.price < 0 || !payload.category) { setNotice("Add a name, category, and valid price."); return; }
    setSaving(true); setNotice("");
    try {
      if (selectedProduct) await updateProduct(selectedProduct.id, payload);
      else await addProduct({ ...payload, id: products.some((item) => item.id === productId) ? `${productId}-${Date.now()}` : productId });
      setNotice(`${payload.name} saved.`); resetForm();
    } catch (nextError) { setNotice(nextError.message); }
    finally { setSaving(false); }
  }

  return <section className="page-section admin-products-page">
    <div className="page-heading admin-page-heading"><div><p className="eyebrow">Today’s menu</p><h1>Products</h1><p>Find an item, mark it sold out, or make a quick change.</p></div>{canEdit ? <button className="secondary-button admin-reset-button" type="button" onClick={resetForm}>Add product</button> : null}</div>
    {notice ? <div className="product-notice" role="status" aria-live="polite"><Check size={18} />{notice}</div> : null}
    {error ? <div className="product-notice error" role="alert">{error.message}</div> : null}

    <section className="product-quick-tools" aria-label="Find products">
      <label className="product-search"><Search aria-hidden="true" size={19} /><span className="sr-only">Search products</span><input type="search" placeholder="Search coffee, pastry…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <label><SlidersHorizontal aria-hidden="true" size={18} /><span className="sr-only">Category</span><select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label><span className="sr-only">Menu status</span><select aria-label="Filter by menu status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="available">Available</option><option value="unavailable">Unavailable today</option><option value="hidden">Hidden</option></select></label>
    </section>

    <div className={`admin-products-layout${canEdit ? "" : " availability-only"}`}>
      <section className="product-list-panel" aria-labelledby="product-list-heading"><div className="section-heading"><div><h2 id="product-list-heading">Menu items</h2><span>{loading ? "Loading menu…" : `${filtered.length} of ${products.length} products`}</span></div></div>
        {loading ? <div className="product-list-skeleton" aria-label="Loading products">{[1,2,3,4].map((item) => <span key={item} />)}</div> : filtered.length ? <div className="product-table">{filtered.map((product) => {
          const categoryName = categories.find((item) => item.id === product.category)?.name || product.category;
          const state = !product.published ? "hidden" : product.available ? "available" : "unavailable";
          return <article className={`product-row ${state}`} key={product.id}><div className="product-row-copy"><strong>{product.name}</strong><span>{categoryName}</span><p>{product.description || "No description"}</p></div><div className="product-row-meta"><strong>{money(product.price)}</strong><span className={`menu-state ${state}`}>{state === "unavailable" ? "Unavailable today" : state[0].toUpperCase() + state.slice(1)}</span></div><div className="product-row-actions">{canManageAvailability ? <button className={product.available ? "sold-out-button" : "available-button"} disabled={availabilityBusy === product.id || !product.published} type="button" onClick={() => toggleAvailability(product)}>{availabilityBusy === product.id ? "Updating…" : product.available ? "Mark unavailable" : "Make available"}</button> : null}{canEdit ? <button type="button" onClick={() => startEdit(product)}>Edit</button> : null}</div></article>;
        })}</div> : <div className="product-empty"><Search size={28} /><h3>No matching products</h3><p>Try another search or clear the filters.</p><button className="secondary-button" type="button" onClick={() => { setQuery(""); setCategory("all"); setStatusFilter("all"); }}>Clear filters</button></div>}
      </section>

      {canEdit ? <section className="product-editor-panel" aria-labelledby="product-editor-heading"><div className="section-heading"><div><p className="eyebrow">Quick edit</p><h2 id="product-editor-heading">{selectedProduct ? `Edit ${selectedProduct.name}` : "Add a product"}</h2></div></div><form className="product-form" aria-busy={saving} onSubmit={handleSubmit}>
        <label><span>Name</span><input required value={formProduct.name} onChange={(event) => updateField("name", event.target.value)} /></label>
        <label><span>Description</span><textarea rows="3" value={formProduct.description} onChange={(event) => updateField("description", event.target.value)} /></label>
        <div className="form-grid"><label><span>Price</span><input min="0" required step="0.01" type="number" value={formProduct.price} onChange={(event) => updateField("price", event.target.value)} /></label><label><span>Category</span><select required value={formProduct.category || categories[0]?.id || ""} onChange={(event) => updateField("category", event.target.value)}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
        <label><span>Image</span><input placeholder="Image URL or token" value={formProduct.image} onChange={(event) => updateField("image", event.target.value)} /></label>
        <label className="availability-editor-toggle"><input checked={formProduct.available} type="checkbox" onChange={(event) => updateField("available", event.target.checked)} /><span>Available on today’s menu</span></label>
        <details className="product-advanced"><summary>Featured placement and options</summary><div className="toggle-row"><label><input checked={formProduct.featured} type="checkbox" onChange={(event) => updateField("featured", event.target.checked)} /><span>Featured</span></label></div><fieldset className="admin-modifier-picker"><legend>Options</legend>{modifierGroups.map((group) => <label key={group.id}><input checked={formProduct.modifierGroupIds.includes(group.id)} type="checkbox" onChange={() => toggleModifierGroup(group.id)} /><span>{group.name}</span></label>)}</fieldset></details>
        <div className="form-actions"><button className="primary-button" disabled={saving} type="submit">{saving ? "Saving…" : selectedProduct ? "Save changes" : "Add product"}</button>{selectedProduct ? <button className="secondary-button" type="button" onClick={resetForm}>Cancel</button> : null}</div>
      </form></section> : null}
    </div>
  </section>;
}
