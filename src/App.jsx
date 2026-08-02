import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout.jsx";
import AdminDashboard from "./admin/AdminDashboard.jsx";
import OrdersPage from "./admin/OrdersPage.jsx";
import ProductsPage from "./admin/ProductsPage.jsx";
import CartPage from "./pages/CartPage.jsx";
import ConfirmationPage from "./pages/ConfirmationPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import MenuPage from "./pages/MenuPage.jsx";
import OrdersPageMobile from "./pages/OrdersPageMobile.jsx";
import AccountPage from "./pages/AccountPage.jsx";
import OwnerLoginPage from "./admin/OwnerLoginPage.jsx";
import RequireOwner from "./auth/RequireOwner.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="orders" element={<OrdersPageMobile />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="confirmation" element={<ConfirmationPage />} />
        <Route path="owner/login" element={<OwnerLoginPage />} />
        <Route path="admin" element={<RequireOwner />}>
          <Route index element={<AdminDashboard />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="*" element={<Navigate replace to="/admin" />} />
        </Route>
      </Route>
    </Routes>
  );
}
