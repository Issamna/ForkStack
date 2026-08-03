import { SignIn } from "@clerk/clerk-react";

// Clerk paths are origin-relative, so they need the deploy base prefix
// ('/ForkStack' on GitHub Pages, '' in dev).
const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignInPage() {
  return (
    <div className="page-wrapper">
      <SignIn
        routing="path"
        path={`${base}/sign-in`}
        signUpUrl={`${base}/sign-up`}
        fallbackRedirectUrl={`${base}/recipes`}
      />
    </div>
  );
}
