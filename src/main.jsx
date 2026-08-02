import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { OwnerAuthProvider } from "./auth/OwnerAuthContext.jsx";
import "./style.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <OwnerAuthProvider>
        <App />
      </OwnerAuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
