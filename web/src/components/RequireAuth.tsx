import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

/**
 * Gate protected routes behind a session.
 *
 * Goes through the auth façade rather than Clerk's <SignedIn>/<SignedOut>, so
 * the same guard works when local development runs with mock auth.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  // Render nothing until auth resolves -- redirecting first would bounce a
  // signed-in user out of every hard refresh.
  if (!isLoaded) return null;
  if (!isSignedIn) return <Navigate to="/" replace />;
  return <>{children}</>;
}
