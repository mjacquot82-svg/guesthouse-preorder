import { NavLink, Outlet } from "react-router-dom";
import { Coffee, Home, ShoppingBag, SlidersHorizontal } from "lucide-react";

const primaryLinks = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/menu", label: "Menu", icon: Coffee },
  { to: "/cart", label: "Cart", icon: ShoppingBag },
];

export default function AppLayout() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <nav className="nav-container" aria-label="Main navigation">
          <NavLink to="/" className="brand" aria-label="Guesthouse Preorder home">
            <span className="brand-mark" aria-hidden="true">
              <Coffee size={18} strokeWidth={2.4} />
            </span>
            <span>
              <strong>Guesthouse Pantry</strong>
              <small>Room ordering</small>
            </span>
          </NavLink>

          <div className="nav-links">
            {primaryLinks.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end}>
                {link.label}
              </NavLink>
            ))}
            <NavLink to="/admin" className="admin-nav-link">
              <SlidersHorizontal size={16} />
              <span>Admin</span>
            </NavLink>
          </div>
        </nav>
      </header>

      <main>
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Mobile ordering navigation">
        {primaryLinks.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink key={link.to} to={link.to} end={link.end}>
              <Icon size={20} strokeWidth={2.35} />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
