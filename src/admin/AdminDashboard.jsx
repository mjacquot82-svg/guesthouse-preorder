import { Link } from "react-router-dom";
import { CheckCircle2, Coffee, FolderTree, ReceiptText } from "lucide-react";
import { useCatalogCategories, useCatalogProducts } from "../stores/catalogStore.js";
import { useOrders } from "../stores/orderStore.js";

export default function AdminDashboard() {
  const { products } = useCatalogProducts();
  const { categories } = useCatalogCategories();
  const { activeOrders, completedOrders, newOrders } = useOrders();
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
        <Link className="secondary-button" to="/admin/orders">
          View orders
        </Link>
      </div>

      <div className="admin-metric-grid">
        <article className="admin-metric-card">
          <ReceiptText size={20} strokeWidth={2.35} aria-hidden="true" />
          <span>New Orders</span>
          <strong>{newOrders.length}</strong>
          <p>Awaiting owner review</p>
        </article>
        <article className="admin-metric-card">
          <Coffee size={20} strokeWidth={2.35} aria-hidden="true" />
          <span>Active Orders</span>
          <strong>{activeOrders.length}</strong>
          <p>New, preparing, or ready</p>
        </article>
        <article className="admin-metric-card">
          <CheckCircle2 size={20} strokeWidth={2.35} aria-hidden="true" />
          <span>Completed Orders</span>
          <strong>{completedOrders.length}</strong>
          <p>Finished pickup orders</p>
        </article>
        <article className="admin-metric-card">
          <FolderTree size={20} strokeWidth={2.35} aria-hidden="true" />
          <span>Catalog</span>
          <strong>{products.length}</strong>
          <p>{activeCount} active, {inactiveCount} inactive across {categories.length} categories</p>
        </article>
      </div>
    </section>
  );
}
