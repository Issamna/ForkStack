import { SignIn } from "@clerk/clerk-react";
import { appUrl } from "../lib/paths";

export default function SignInPage() {
  return (
    <div className="page-wrapper">
      <SignIn
        routing="path"
        path={appUrl("/sign-in")}
        signUpUrl={appUrl("/sign-up")}
        fallbackRedirectUrl={appUrl("/recipes")}
      />
    </div>
  );
}
