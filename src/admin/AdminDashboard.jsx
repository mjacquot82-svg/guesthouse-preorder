import { Link } from "react-router-dom";
import { Boxes, Coffee, FolderTree, SlidersHorizontal } from "lucide-react";
import { useCatalogCategories, useCatalogProducts } from "../stores/catalogStore.js";

export default function AdminDashboard() {
  const { products } = useCatalogProducts();
  const { categories } = useCatalogCategories();
  const activeCount = products.filter((product) => product.active).length;
  const inactiveCount = products.length - activeCount;

  return (
    <section className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">Coffee shop owner</p>
          <h1>Dashboard</h1>
          <p>Manage menu data from one local admin foundation.</p>
        </div>
        <Link className="primary-button" to="/admin/catalog">
          Manage catalog
        </Link>
      </div>

      <div className="admin-metric-grid">
        <article className="admin-metric-card">
          <Coffee size={20} strokeWidth={2.35} aria-hidden="true" />
          <span>Products</span>
          <strong>{products.length}</strong>
          <p>{activeCount} active, {inactiveCount} inactive</p>
        </article>
        <article className="admin-metric-card">
          <FolderTree size={20} strokeWidth={2.35} aria-hidden="true" />
          <span>Categories</span>
          <strong>{categories.length}</strong>
          <p>Editable menu organization</p>
        </article>
        <article className="admin-metric-card">
          <Boxes size={20} strokeWidth={2.35} aria-hidden="true" />
          <span>Future models</span>
          <strong>6</strong>
          <p>Variants, modifiers, accounts, loyalty, orders</p>
        </article>
        <article className="admin-metric-card">
          <SlidersHorizontal size={20} strokeWidth={2.35} aria-hidden="true" />
          <span>Settings</span>
          <strong>Draft</strong>
          <p>Business details stored locally</p>
        </article>
      </div>
    </section>
  );
}
