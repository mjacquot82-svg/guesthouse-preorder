import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Home, Search, ShoppingBag, UserRound } from "lucide-react";
import { useCustomerAuth } from "../auth/CustomerAuthContext.jsx";
import guestHouseLogo from "../../inspiration/610636354_18297756187278697_828168607581072468_n.jpg";

const customerLinks = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/menu", label: "Browse", icon: Search },
  { to: "/cart", label: "Cart", icon: ShoppingBag },
];

export default function AppLayout() {
  const location = useLocation();
  const { session } = useCustomerAuth();
  const primaryLinks = [
    ...customerLinks,
    {
      to: session ? "/account" : "/account/sign-in",
      label: "Account",
      icon: UserRound,
    },
  ];

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="nav-container">
          <NavLink to="/" className="brand" aria-label="The Guest House home">
            <span className="brand-mark" aria-hidden="true">
              <img src={guestHouseLogo} alt="" />
            </span>
            <span>
              <strong>The Guest House</strong>
              <small>Café & Pantry</small>
            </span>
          </NavLink>

          <NavLink to="/cart" className="header-cart-link" aria-label="Open cart">
            <ShoppingBag size={18} strokeWidth={2.4} />
          </NavLink>

          <nav className="desktop-nav" aria-label="Desktop ordering navigation">
            {primaryLinks.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink key={link.to} to={link.to} end={link.end}>
                  <Icon size={17} strokeWidth={2.35} />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
          </nav>
          {location.pathname.startsWith("/admin") ? (
            <nav className="admin-links" aria-label="Owner Portal navigation">
              <NavLink end to="/admin">Dashboard</NavLink>
              <NavLink to="/admin/orders">Orders</NavLink>
              <NavLink to="/admin/products">Products</NavLink>
              <NavLink to="/admin/scheduling">Scheduling</NavLink>
            </nav>
          ) : null}
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
