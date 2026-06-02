import Link from "next/link";
import { redirect } from "next/navigation";
import { AppTopbar } from "@/components/app-topbar";
import { ReservationDetailView } from "@/components/front-desk-workspace";
import { SetupPanel } from "@/components/setup-panel";
import { getIdentity, isClerkConfigured, isDemoMode, requireHotelSession } from "@/lib/authz";
import { isDatabaseConfigured } from "@/lib/db";
import { getHotel, loadHousekeepingSupervisor, loadReservationDetail } from "@/lib/hotel-service";

export const dynamic = "force-dynamic";

export default async function ReservationDetailPage({ params }: { params: Promise<{ hotelId: string; reservationId: string }> }) {
  const demoMode = isDemoMode();
  if (!demoMode && (!isClerkConfigured() || !isDatabaseConfigured())) {
    return <SetupPanel clerkConfigured={isClerkConfigured()} databaseConfigured={isDatabaseConfigured()} />;
  }

  const identity = await getIdentity();
  if (!identity) redirect("/sign-in");

  const { hotelId, reservationId } = await params;
  const { session } = await requireHotelSession(hotelId, ["owner", "manager", "front-desk"]);
  const hotel = await getHotel(hotelId);
  const [reservation, supervisor] = await Promise.all([
    loadReservationDetail(hotelId, reservationId),
    session.rolePreviewEnabled ? loadHousekeepingSupervisor(hotelId) : Promise.resolve(null),
  ]);
  const rolePreview = session.rolePreviewEnabled ? { hotelId, hotelName: hotel.name, session, housekeepers: supervisor?.housekeepers ?? [] } : undefined;

  return (
    <div className="page-shell">
      <AppTopbar rolePreview={rolePreview} />
      <main className="container stack">
        <div className="page-title">
          <div>
            <p className="eyebrow">Front desk</p>
            <h1>Reservation detail</h1>
            <p className="muted">{hotel.name}</p>
          </div>
          <div className="actions">
            <Link className="button" href={`/hotels/${hotel.id}/front-desk/reservations`}>
              Reservations
            </Link>
            <Link className="button" href={`/hotels/${hotel.id}/front-desk`}>
              Front desk
            </Link>
          </div>
        </div>
        <ReservationDetailView hotelId={hotel.id} reservation={reservation} />
      </main>
    </div>
  );
}
