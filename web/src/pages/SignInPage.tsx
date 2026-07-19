import { SignIn } from "@clerk/clerk-react";

export default function SignInPage() {
  return (
    <div className="page-wrapper">
      <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/recipes" />
    </div>
  );
}
