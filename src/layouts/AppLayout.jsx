import { NavLink, Outlet } from "react-router-dom";

const primaryLinks = [
  { to: "/", label: "Home" },
  { to: "/menu", label: "Menu" },
  { to: "/cart", label: "Cart" },
];

const adminLinks = [
  { to: "/admin", label: "Dashboard" },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/products", label: "Products" },
];

export default function AppLayout() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <nav className="nav-container" aria-label="Main navigation">
          <NavLink to="/" className="brand" aria-label="Guesthouse Preorder home">
            <span className="brand-mark">G</span>
            <span>
              <strong>Guesthouse</strong>
              <small>Preorder</small>
            </span>
          </NavLink>

          <div className="nav-links">
            {primaryLinks.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.to === "/"}>
                {link.label}
              </NavLink>
            ))}
          </div>

          <div className="admin-links">
            {adminLinks.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.to === "/admin"}>
                {link.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
