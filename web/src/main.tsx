import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import "./index.css";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
if (!publishableKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

// Clerk resolves these against the origin, not the router basename, so on
// GitHub Pages ('/ForkStack/') a bare '/sign-in' would land off the app.
const base = import.meta.env.BASE_URL.replace(/\/$/, "");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={publishableKey}
      signInUrl={`${base}/sign-in`}
      signUpUrl={`${base}/sign-up`}
      afterSignOutUrl={`${base}/`}
    >
      <RouterProvider router={router} />
    </ClerkProvider>
  </React.StrictMode>,
);
