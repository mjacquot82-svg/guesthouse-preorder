import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { OwnerAuthProvider } from "./auth/OwnerAuthContext.jsx";
import { CustomerAuthProvider } from "./auth/CustomerAuthContext.jsx";
import "./style.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <OwnerAuthProvider>
        <CustomerAuthProvider>
          <App />
        </CustomerAuthProvider>
      </OwnerAuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
