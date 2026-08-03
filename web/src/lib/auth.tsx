/**
 * Auth façade.
 *
 * Every component imports auth from here, never from `@clerk/clerk-react`
 * directly. That lets local development and end-to-end tests run against a
 * mock identity with no Clerk instance, no network, and no real user data.
 *
 * `VITE_AUTH_MODE=mock` selects the mock. It is read from Vite's build-time
 * env, so a production build has the real Clerk implementation compiled in and
 * the mock cannot be switched on at runtime.
 */
import type { ReactNode } from "react";
import {
  ClerkProvider,
  SignIn as ClerkSignIn,
  SignInButton as ClerkSignInButton,
  SignUp as ClerkSignUp,
  SignUpButton as ClerkSignUpButton,
  UserButton as ClerkUserButton,
  UserProfile as ClerkUserProfile,
  useAuth as useClerkAuth,
  useClerk,
  useUser as useClerkUser,
} from "@clerk/clerk-react";
import { appUrl } from "./paths";

export const AUTH_MODE = import.meta.env.VITE_AUTH_MODE ?? "clerk";
export const IS_MOCK_AUTH = AUTH_MODE === "mock";

const MOCK_USER_ID =
  (import.meta.env.VITE_MOCK_USER_ID as string | undefined) ?? "user_local_dev";
const MOCK_USER = {
  id: MOCK_USER_ID,
  username: "local.dev",
  fullName: "Local Dev",
  imageUrl: "",
  primaryEmailAddress: { emailAddress: "dev@localhost" },
};

export interface AuthState {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
}

/* ------------------------------------------------------------------ mock */

function MockProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function useMockAuth(): AuthState {
  return { isLoaded: true, isSignedIn: true, userId: MOCK_USER_ID };
}

function MockPassthrough({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

function MockUserButton() {
  return (
    <span
      title="Mock user (local development)"
      className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-accent text-[11px] font-bold text-primary"
    >
      LD
    </span>
  );
}

function MockUserProfile() {
  return (
    <div className="card-surface p-5">
      <h2 className="font-serif text-[21px] font-semibold text-primary">
        Mock sign-in
      </h2>
      <p className="meta mt-1">
        Local development is running without Clerk. Signed in as{" "}
        <code>{MOCK_USER_ID}</code>.
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- exports */

export function AuthProvider({
  children,
  publishableKey,
}: {
  children: ReactNode;
  publishableKey?: string;
}) {
  if (IS_MOCK_AUTH) return <MockProvider>{children}</MockProvider>;
  return (
    <ClerkProvider
      publishableKey={publishableKey!}
      signInUrl={appUrl("/sign-in")}
      signUpUrl={appUrl("/sign-up")}
      afterSignOutUrl={appUrl("/")}
    >
      {children}
    </ClerkProvider>
  );
}

export const useAuth: () => AuthState = IS_MOCK_AUTH
  ? useMockAuth
  : (useClerkAuth as unknown as () => AuthState);

export function useCurrentUser() {
  // Hooks can't be called conditionally, so both run and one result is chosen.
  const clerk = IS_MOCK_AUTH ? null : useClerkUser();
  return IS_MOCK_AUTH ? { user: MOCK_USER } : { user: clerk?.user ?? null };
}

export function useSignOut(): () => Promise<void> | void {
  const clerk = IS_MOCK_AUTH ? null : useClerk();
  if (IS_MOCK_AUTH) return () => {};
  return () => clerk!.signOut();
}

export const SignInButton = IS_MOCK_AUTH ? MockPassthrough : ClerkSignInButton;
export const SignUpButton = IS_MOCK_AUTH ? MockPassthrough : ClerkSignUpButton;
export const UserButton = IS_MOCK_AUTH ? MockUserButton : ClerkUserButton;
export const UserProfile = IS_MOCK_AUTH ? MockUserProfile : ClerkUserProfile;
export const SignIn = IS_MOCK_AUTH ? MockUserProfile : ClerkSignIn;
export const SignUp = IS_MOCK_AUTH ? MockUserProfile : ClerkSignUp;

/** Bearer token for API calls; the mock sends a value the local API accepts. */
export async function getAuthToken(): Promise<string | null> {
  if (IS_MOCK_AUTH) return `mock:${MOCK_USER_ID}`;
  const clerk = (window as unknown as { Clerk?: any }).Clerk;
  return clerk?.session ? await clerk.session.getToken() : null;
}
