import { SignUp } from "@clerk/clerk-react";

export default function SignUpPage() {
  return (
    <div className="page-wrapper">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/recipes"
      />
    </div>
  );
}
