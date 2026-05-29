import { NavLink, Outlet } from "react-router-dom";
import { Home, LogIn, LogOut, ReceiptText, Search, ShoppingBag, UserRound } from "lucide-react";
import { useCustomerSession } from "../stores/customerAuthStore.js";

const primaryLinks = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/menu", label: "Browse", icon: Search },
  { to: "/cart", label: "Cart", icon: ShoppingBag },
  { to: "/orders", label: "Orders", icon: ReceiptText },
  { to: "/account", label: "Account", icon: UserRound },
];

export default function AppLayout() {
  const { isAuthenticated, logout } = useCustomerSession();
  const accountLink = isAuthenticated
    ? { to: "/account", label: "Account", icon: UserRound }
    : { to: "/account/login", label: "Login", icon: LogIn };
  const navLinks = [...primaryLinks.slice(0, 4), accountLink];

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="nav-container">
          <NavLink to="/" className="brand" aria-label="Cedar & Oak home">
            <span className="brand-mark" aria-hidden="true">
              C&O
            </span>
            <span>
              <strong>Cedar & Oak</strong>
              <small>Boutique Café</small>
            </span>
          </NavLink>

          <NavLink to="/cart" className="header-cart-link" aria-label="Open cart">
            <ShoppingBag size={18} strokeWidth={2.4} />
          </NavLink>

          <nav className="desktop-nav" aria-label="Desktop ordering navigation">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink key={link.to} to={link.to} end={link.end}>
                  <Icon size={17} strokeWidth={2.35} />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
            {isAuthenticated ? (
              <button className="nav-logout-button" type="button" onClick={logout}>
                <LogOut size={17} strokeWidth={2.35} />
                <span>Logout</span>
              </button>
            ) : null}
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <nav
        className={`bottom-nav${isAuthenticated ? " authenticated-bottom-nav" : ""}`}
        aria-label="Mobile ordering navigation"
      >
        {navLinks.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink key={link.to} to={link.to} end={link.end}>
              <Icon size={20} strokeWidth={2.35} />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
        {isAuthenticated ? (
          <button className="nav-logout-button" type="button" onClick={logout}>
            <LogOut size={20} strokeWidth={2.35} />
            <span>Logout</span>
          </button>
        ) : null}
      </nav>
    </div>
  );
}
