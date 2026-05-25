import { redirect } from "next/navigation";
import { AppTopbar } from "@/components/app-topbar";
import { PortfolioDashboard } from "@/components/portfolio-dashboard";
import { SetupPanel } from "@/components/setup-panel";
import { getIdentity, isClerkConfigured, isDemoMode, requireAnyHotelSession } from "@/lib/authz";
import { isDatabaseConfigured } from "@/lib/db";
import { loadPortfolio } from "@/lib/hotel-service";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  if (!isDemoMode() && (!isClerkConfigured() || !isDatabaseConfigured())) {
    return <SetupPanel clerkConfigured={isClerkConfigured()} databaseConfigured={isDatabaseConfigured()} />;
  }
  const identity = await getIdentity();
  if (!identity) redirect("/sign-in");
  const { session } = await requireAnyHotelSession();
  if (session.role !== "owner" && session.activeHotelId) {
    redirect(`/hotels/${session.activeHotelId}`);
  }
  const payload = await loadPortfolio(session);
  return (
    <div className="page-shell">
      <AppTopbar />
      <PortfolioDashboard payload={payload} />
    </div>
  );
}
