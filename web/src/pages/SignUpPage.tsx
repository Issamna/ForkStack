import { SignUp } from "../lib/auth";
import { appUrl } from "../lib/paths";

export default function SignUpPage() {
  return (
    <div className="page-wrapper">
      <SignUp
        routing="path"
        path={appUrl("/sign-up")}
        signInUrl={appUrl("/sign-in")}
        fallbackRedirectUrl={appUrl("/recipes")}
      />
    </div>
  );
}
