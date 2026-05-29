import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BellRing, CheckCircle2, Coffee, FolderTree, Megaphone, ReceiptText } from "lucide-react";
import { getCommunicationPreferenceSummary } from "../services/customerService.js";
import { useCatalogCategories, useCatalogProducts } from "../stores/catalogStore.js";
import { useOrders } from "../stores/orderStore.js";

export default function AdminDashboard() {
  const { products } = useCatalogProducts();
  const { categories } = useCatalogCategories();
  const { activeOrders, newOrders, waitingForPickupOrders } = useOrders();
  const [communicationSummary, setCommunicationSummary] = useState(null);
  const [communicationSummaryError, setCommunicationSummaryError] = useState("");
  const activeCount = products.filter((product) => product.active).length;
  const inactiveCount = products.length - activeCount;

  useEffect(() => {
    let isMounted = true;

    async function loadCommunicationSummary() {
      try {
        const summary = await getCommunicationPreferenceSummary();

        if (isMounted) {
          setCommunicationSummary(summary);
          setCommunicationSummaryError("");
        }
      } catch (error) {
        if (isMounted) {
          setCommunicationSummaryError(
            error instanceof Error ? error.message : "Could not load subscriber counts."
          );
        }
      }
    }

    loadCommunicationSummary();

    return () => {
      isMounted = false;
    };
  }, []);

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
          <p>Still being prepared</p>
        </article>
        <article className="admin-metric-card">
          <CheckCircle2 size={20} strokeWidth={2.35} aria-hidden="true" />
          <span>Waiting For Pickup</span>
          <strong>{waitingForPickupOrders.length}</strong>
          <p>Ready and on the counter</p>
        </article>
        <article className="admin-metric-card">
          <FolderTree size={20} strokeWidth={2.35} aria-hidden="true" />
          <span>Catalog</span>
          <strong>{products.length}</strong>
          <p>{activeCount} active, {inactiveCount} inactive across {categories.length} categories</p>
        </article>
      </div>

      <div className="admin-panel admin-communication-summary">
        <div>
          <p className="eyebrow">Customer communication</p>
          <h2>Subscriber Summary</h2>
        </div>
        <div className="admin-communication-grid">
          <div className="admin-communication-item">
            <Coffee size={18} strokeWidth={2.35} aria-hidden="true" />
            <span>Lunch Special Subscribers</span>
            <strong>{communicationSummary?.lunchSpecialSubscribers ?? "-"}</strong>
          </div>
          <div className="admin-communication-item">
            <Megaphone size={18} strokeWidth={2.35} aria-hidden="true" />
            <span>Promotion Subscribers</span>
            <strong>{communicationSummary?.promotionSubscribers ?? "-"}</strong>
          </div>
          <div className="admin-communication-item">
            <BellRing size={18} strokeWidth={2.35} aria-hidden="true" />
            <span>Pickup Notification Subscribers</span>
            <strong>{communicationSummary?.pickupNotificationSubscribers ?? "-"}</strong>
          </div>
          <div className="admin-communication-item">
            <FolderTree size={18} strokeWidth={2.35} aria-hidden="true" />
            <span>New Product Announcement Subscribers</span>
            <strong>{communicationSummary?.newProductAnnouncementSubscribers ?? "-"}</strong>
          </div>
        </div>
        {communicationSummaryError ? <p className="form-status">{communicationSummaryError}</p> : null}
      </div>
    </section>
  );
}
