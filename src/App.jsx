import { Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout.jsx";
import AdminLayout from "./admin/AdminLayout.jsx";
import AnalyticsPage from "./admin/AnalyticsPage.jsx";
import AdminDashboard from "./admin/AdminDashboard.jsx";
import AdminLogin from "./admin/AdminLogin.jsx";
import CategoriesPage from "./admin/CategoriesPage.jsx";
import DailySpecialPage from "./admin/DailySpecialPage.jsx";
import ModifiersPage from "./admin/ModifiersPage.jsx";
import ProductsPage from "./admin/ProductsPage.jsx";
import SettingsPage from "./admin/SettingsPage.jsx";
import AdminOrdersPage from "./admin/OrdersPage.jsx";
import CartPage from "./pages/CartPage.jsx";
import ConfirmationPage from "./pages/ConfirmationPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import MenuPage from "./pages/MenuPage.jsx";
import OrdersPageMobile from "./pages/OrdersPageMobile.jsx";
import AccountPage from "./pages/AccountPage.jsx";
import AccountOrdersPage from "./pages/AccountOrdersPage.jsx";
import AccountLoginPage from "./pages/AccountLoginPage.jsx";
import CreateAccountPage from "./pages/CreateAccountPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="orders" element={<OrdersPageMobile />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="account/orders" element={<AccountOrdersPage />} />
        <Route path="account/login" element={<AccountLoginPage />} />
        <Route path="account/create" element={<CreateAccountPage />} />
        <Route path="confirmation" element={<ConfirmationPage />} />
      </Route>
      <Route path="admin/login" element={<AdminLogin />} />
      <Route path="admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="catalog" element={<ProductsPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="daily-special" element={<DailySpecialPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="modifiers" element={<ModifiersPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
