import { Building2, Hotel, LogIn } from "lucide-react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { DemoLogoutButton } from "@/components/demo-logout-button";
import { getIdentity, isClerkConfigured, isDemoMode, listMembershipsForUser } from "@/lib/authz";

export async function AppTopbar() {
  const demoMode = isDemoMode();
  const identity = await getIdentity();
  let homeHref = "/portfolio";
  let homeLabel = "Portfolio";
  if (identity) {
    const memberships = await listMembershipsForUser(identity.userId).catch(() => []);
    const primary = memberships[0];
    if (primary && primary.role !== "owner") {
      homeHref = `/hotels/${primary.hotelId}`;
      homeLabel = "My hotel";
    }
  }
  return (
    <header className="topbar">
      <Link href={homeHref} className="brand">
        <span className="brand-mark"><Hotel size={20} /></span>
        <span className="brand-text">
          <span>Hotel Management</span>
          <small>Hosted operations</small>
        </span>
      </Link>
      <nav className="actions">
        <Link className="button" href={homeHref}><Building2 size={16} /> {homeLabel}</Link>
        {demoMode && identity ? (
          <>
            <span className="status-pill">{identity.displayName}</span>
            <DemoLogoutButton />
          </>
        ) : demoMode ? (
          <Link className="button" href="/sign-in"><LogIn size={16} /> Demo sign in</Link>
        ) : isClerkConfigured() ? (
          <UserButton />
        ) : (
          <Link className="button" href="/sign-in"><LogIn size={16} /> Sign in</Link>
        )}
      </nav>
    </header>
  );
}
