import { UserProfile } from "@clerk/clerk-react";

export default function AccountPage() {
  return (
    <div className="mx-auto flex max-w-3xl justify-center px-4 py-6">
      <UserProfile />
    </div>
  );
}
