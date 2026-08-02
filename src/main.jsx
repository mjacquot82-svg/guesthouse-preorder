import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { CustomerAuthProvider } from "./auth/CustomerAuthContext.jsx";
import "./style.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <CustomerAuthProvider>
        <App />
      </CustomerAuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
