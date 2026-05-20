import { NavLink, Outlet } from "react-router-dom";
import { Coffee, Home, ReceiptText, Search, ShoppingBag, UserRound } from "lucide-react";

const primaryLinks = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/menu", label: "Browse", icon: Search },
  { to: "/cart", label: "Cart", icon: ShoppingBag },
  { to: "/orders", label: "Orders", icon: ReceiptText },
  { to: "/account", label: "Account", icon: UserRound },
];

export default function AppLayout() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="nav-container">
          <NavLink to="/" className="brand" aria-label="The Guest House home">
            <span className="brand-mark" aria-hidden="true">
              <Coffee size={18} strokeWidth={2.4} />
            </span>
            <span>
              <strong>The Guest House</strong>
              <small>Café & Pantry</small>
            </span>
          </NavLink>

          <NavLink to="/cart" className="header-cart-link" aria-label="Open cart">
            <ShoppingBag size={18} strokeWidth={2.4} />
          </NavLink>
        </div>
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
