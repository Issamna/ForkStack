import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { appUrl } from "./lib/paths";
import "./index.css";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
if (!publishableKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={publishableKey}
      signInUrl={appUrl("/sign-in")}
      signUpUrl={appUrl("/sign-up")}
      afterSignOutUrl={appUrl("/")}
    >
      <RouterProvider router={router} />
    </ClerkProvider>
  </React.StrictMode>,
);
