import { SignUp } from "@clerk/clerk-react";

export default function SignUpPage() {
  return (
    <div className="page-wrapper">
      <SignUp signInUrl="/sign-in" fallbackRedirectUrl="/recipes" />
    </div>
  );
}
