import { SignUp } from "@clerk/clerk-react";

// Clerk paths are origin-relative, so they need the deploy base prefix
// ('/ForkStack' on GitHub Pages, '' in dev).
const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignUpPage() {
  return (
    <div className="page-wrapper">
      <SignUp
        routing="path"
        path={`${base}/sign-up`}
        signInUrl={`${base}/sign-in`}
        fallbackRedirectUrl={`${base}/recipes`}
      />
    </div>
  );
}
