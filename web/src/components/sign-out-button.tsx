import { LogOut } from "lucide-react";
import { signOut } from "@/app/login/actions";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className={
          className ??
          "inline-flex items-center gap-2 rounded-control px-2 py-2 text-sm text-muted hover:bg-raised hover:text-bone"
        }
      >
        <LogOut aria-hidden className="size-4" />
        Sign out
      </button>
    </form>
  );
}
