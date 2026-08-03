import type { ReactNode } from "react";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";

/** Gate protected routes behind a Clerk session. */
export default function RequireAuth({ children }: { children: ReactNode }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
