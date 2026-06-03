import { redirect } from "next/navigation";
import { AppTopbar } from "@/components/app-topbar";
import { FrontDeskHub } from "@/components/front-desk-workspace";
import { SetupPanel } from "@/components/setup-panel";
import { getIdentity, isClerkConfigured, isDemoMode, requireHotelSession } from "@/lib/authz";
import { isDatabaseConfigured } from "@/lib/db";
import { addDaysString, getHotel, loadFrontDeskReservations, loadHousekeepingSupervisor, loadTodayDesk } from "@/lib/hotel-service";

export const dynamic = "force-dynamic";

export default async function FrontDeskPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const demoMode = isDemoMode();
  if (!demoMode && (!isClerkConfigured() || !isDatabaseConfigured())) {
    return <SetupPanel clerkConfigured={isClerkConfigured()} databaseConfigured={isDatabaseConfigured()} />;
  }

  const identity = await getIdentity();
  if (!identity) redirect("/sign-in");

  const { hotelId } = await params;
  const { session } = await requireHotelSession(hotelId, ["owner", "manager", "front-desk"]);
  const hotel = await getHotel(hotelId);
  const [today, supervisor] = await Promise.all([
    loadTodayDesk(hotelId),
    session.rolePreviewEnabled ? loadHousekeepingSupervisor(hotelId) : Promise.resolve(null),
  ]);
  const availability = await loadFrontDeskReservations(hotelId, today.today, addDaysString(today.today, 14));
  const rolePreview = session.rolePreviewEnabled ? { hotelId, hotelName: hotel.name, session, housekeepers: supervisor?.housekeepers ?? [] } : undefined;

  return (
    <div className="page-shell">
      <AppTopbar rolePreview={rolePreview} contextLabel="Front desk" contextDetail={hotel.name} />
      <main className="container front-desk-container stack">
        <FrontDeskHub hotelId={hotel.id} hotelName={hotel.name} today={today} availability={availability} />
      </main>
    </div>
  );
}
