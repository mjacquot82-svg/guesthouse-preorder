import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ReceiptText } from "lucide-react";
import { useCustomerAuth } from "../auth/CustomerAuthContext.jsx";
import { fetchCustomerOrder, fetchCustomerOrders } from "../services/customerAccountApi.js";
import { useCustomerCatalog } from "../stores/customerCatalogStore.js";
import { getCustomerErrorMessage } from "../services/customerMessages.js";

const money = (cents) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);

function reorderCart(order, catalog) {
  return order.items.flatMap((item) => {
    const product = catalog?.products.find((candidate) => candidate.slug === item.product_slug);
    if (!product) return [];
    const selected = [];
    if (item.variant_key) {
      const group = product.modifierGroups.find((candidate) => candidate.id === "size");
      const option = group?.options.find((candidate) => candidate.id === item.variant_key);
      if (group && option) selected.push({ group, option });
    }
    for (const modifier of item.modifiers) {
      const group = product.modifierGroups.find((candidate) => candidate.id === modifier.group_key);
      const option = group?.options.find((candidate) => candidate.id === modifier.option_key);
      if (group && option) selected.push({ group, option });
    }
    const signature = selected.map(({ group, option }) => `${group.id}:${option.id}`).sort().join("|");
    return [{
      id: signature ? `${product.id}__${signature}` : product.id,
      productId: product.id, name: product.name, description: product.description,
      price: product.price + selected.reduce((sum, value) => sum + value.option.priceDelta, 0),
      basePrice: product.price, category: product.category, quantity: item.quantity,
      options: selected.map(({ group, option }) => ({ groupName: group.name, name: option.name, priceDelta: option.priceDelta })),
    }];
  });
}

export default function OrdersPageMobile() {
  const navigate = useNavigate();
  const { session, status: authStatus } = useCustomerAuth();
  const { catalog } = useCustomerCatalog();
  const [orders, setOrders] = useState([]);
  const [detail, setDetail] = useState(null);
  const [message, setMessage] = useState("");
  useEffect(() => { if (session) fetchCustomerOrders().then(setOrders).catch((error) => setMessage(getCustomerErrorMessage(error, "We couldn’t load your orders. Please try again."))); }, [session]);
  if (authStatus === "loading") return <section className="page-section compact-section"><p>Checking your orders…</p></section>;
  if (!session) return <section className="page-section ordering-page app-simple-page"><div className="ordering-top-card compact-app-heading"><div><p className="eyebrow">Order history</p><h1>Orders</h1><p>Sign in to view orders placed with your customer account.</p></div></div><div className="form-actions"><Link className="primary-button" to="/login">Sign In</Link><Link className="secondary-button" to="/register">Create Account</Link></div></section>;
  async function showOrder(id) { try { setDetail(await fetchCustomerOrder(id)); } catch (error) { setMessage(getCustomerErrorMessage(error, "We couldn’t load that order. Please try again.")); } }
  function reorder() {
    const cart = reorderCart(detail, catalog);
    if (!cart.length) { setMessage("These items are no longer available on the current menu."); return; }
    window.localStorage.setItem("cafe-cart", JSON.stringify(cart));
    navigate("/cart");
  }
  return <section className="page-section ordering-page app-simple-page">
    <div className="ordering-top-card compact-app-heading"><div><p className="eyebrow">Order history</p><h1>Orders</h1><p>Your previous customer-account orders.</p></div></div>
    {message ? <p className="form-status">{message}</p> : null}
    {detail ? <div className="content-block app-content-block order-detail-card"><h2>Order {detail.public_token.slice(0, 8).toUpperCase()}</h2><p>{detail.items.map((item) => `${item.quantity} × ${item.product_name}`).join(", ")}</p><strong>{money(detail.total_cents)}</strong><div className="form-actions"><button className="primary-button" type="button" onClick={reorder}>Reorder</button><button className="secondary-button" type="button" onClick={() => setDetail(null)}>Collapse</button></div></div> : null}
    {!detail && orders.length ? <div className="account-settings-list">{orders.map((order) => <button className="content-block app-content-block compact-info-row" key={order.id} type="button" onClick={() => showOrder(order.id)}><ReceiptText size={18} /><span>{order.item_count} item{order.item_count === 1 ? "" : "s"} · {new Date(order.created_at).toLocaleDateString()}</span><strong>{money(order.total_cents)}</strong></button>)}</div> : null}
    {!detail && !orders.length ? <div className="content-block app-content-block app-status-card"><ReceiptText size={20} /><div><h2>No previous orders</h2><p>Your first signed-in order will appear here.</p></div><Link className="primary-button" to="/menu">Browse menu</Link></div> : null}
  </section>;
}
