import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  FolderTree,
  LayoutDashboard,
  ListPlus,
  LogOut,
  Sandwich,
  ReceiptText,
  Settings,
  Store,
} from "lucide-react";
import { useAdminSession } from "../stores/adminAuthStore.js";

const adminLinks = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/catalog", label: "Catalog", icon: Store },
  { to: "/admin/orders", label: "Orders", icon: ReceiptText },
  { to: "/admin/daily-special", label: "Daily Special", icon: Sandwich },
  { to: "/admin/categories", label: "Categories", icon: FolderTree },
  { to: "/admin/modifiers", label: "Modifiers", icon: ListPlus },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout() {
  const location = useLocation();
  const { isAuthenticated, logout, session } = useAdminSession();

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <section className="admin-shell">
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <NavLink className="admin-brand" to="/admin" end>
          <BarChart3 size={21} strokeWidth={2.4} aria-hidden="true" />
          <span>
            <strong>Owner Admin</strong>
            <small>{session?.email}</small>
          </span>
        </NavLink>

        <nav className="admin-nav">
          {adminLinks.map((link) => {
            const Icon = link.icon;

            return (
              <NavLink key={link.to} to={link.to} end={link.end}>
                <Icon size={18} strokeWidth={2.35} aria-hidden="true" />
                <span>{link.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <button className="admin-logout-button" type="button" onClick={logout}>
          <LogOut size={17} strokeWidth={2.35} aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </aside>

      <div className="admin-content">
        <Outlet />
      </div>
    </section>
  );
}
