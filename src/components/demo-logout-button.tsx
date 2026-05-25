"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function DemoLogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function logout() {
    startTransition(() => {
      void fetch("/api/session", { method: "DELETE" }).finally(() => {
        router.push("/sign-in");
        router.refresh();
      });
    });
  }

  return (
    <button className="button" type="button" onClick={logout} disabled={pending}>
      <LogOut size={16} />
      {pending ? "Signing out..." : "Log out"}
    </button>
  );
}
