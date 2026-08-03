import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { AuthProvider, IS_MOCK_AUTH } from "./lib/auth";
import "./index.css";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
// Mock auth needs no Clerk instance at all -- that is the point of it.
if (!IS_MOCK_AUTH && !publishableKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider publishableKey={publishableKey}>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>,
);
