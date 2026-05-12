import { NavLink, Outlet } from "react-router-dom";

const primaryLinks = [
  { to: "/menu", label: "Menu" },
  { to: "/cart", label: "Cart" },
];

export default function AppLayout() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <nav className="nav-container" aria-label="Main navigation">
          <NavLink to="/" className="brand" aria-label="Guesthouse Preorder home">
            <span>
              <strong>Guesthouse Pantry</strong>
              <small>Room ordering</small>
            </span>
          </NavLink>

          <div className="nav-links">
            <NavLink to="/" end>
              Home
            </NavLink>
            {primaryLinks.map((link) => (
              <NavLink key={link.to} to={link.to}>
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
