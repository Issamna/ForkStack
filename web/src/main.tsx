import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { AuthProvider, IS_MOCK_AUTH } from "./lib/auth";
import { appUrl } from "./lib/paths";
import "./index.css";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
// Mock auth needs no Clerk instance at all -- that is the point of it.
if (!IS_MOCK_AUTH && !publishableKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

// Registered only in a production build: the worker is what makes Chrome offer
// a real install, and a worker intercepting fetches in dev fights the HMR
// socket for no benefit. Failure is non-fatal -- the app works without it.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(appUrl("/sw.js"), { scope: import.meta.env.BASE_URL })
      .catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider publishableKey={publishableKey}>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>,
);
