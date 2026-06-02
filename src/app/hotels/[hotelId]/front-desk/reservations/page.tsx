import Link from "next/link";
import { redirect } from "next/navigation";
import { AppTopbar } from "@/components/app-topbar";
import { FrontDeskReservationsPage } from "@/components/front-desk-workspace";
import { SetupPanel } from "@/components/setup-panel";
import { getIdentity, isClerkConfigured, isDemoMode, requireHotelSession } from "@/lib/authz";
import { isDatabaseConfigured } from "@/lib/db";
import { addDaysString, getHotel, loadFrontDeskReservations, loadHousekeepingSupervisor, todayString } from "@/lib/hotel-service";

export const dynamic = "force-dynamic";

export default async function ReservationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ hotelId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const demoMode = isDemoMode();
  if (!demoMode && (!isClerkConfigured() || !isDatabaseConfigured())) {
    return <SetupPanel clerkConfigured={isClerkConfigured()} databaseConfigured={isDatabaseConfigured()} />;
  }

  const identity = await getIdentity();
  if (!identity) redirect("/sign-in");

  const { hotelId } = await params;
  const query = await searchParams;
  const today = todayString();
  const rangeStart = dateParam(query.start) ?? today;
  const requestedRangeEnd = dateParam(query.end) ?? addDaysString(rangeStart, 14);
  const rangeEnd = requestedRangeEnd > rangeStart ? requestedRangeEnd : addDaysString(rangeStart, 14);

  const { session } = await requireHotelSession(hotelId, ["owner", "manager", "front-desk"]);
  const hotel = await getHotel(hotelId);
  const [payload, supervisor] = await Promise.all([
    loadFrontDeskReservations(hotelId, rangeStart, rangeEnd),
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
            <h1>Arrivals / in-house</h1>
            <p className="muted">{hotel.name}</p>
          </div>
          <div className="actions">
            <Link className="button" href={`/hotels/${hotel.id}/front-desk`}>
              Front desk
            </Link>
            <Link className="button" href={`/hotels/${hotel.id}/front-desk/walk-in`}>
              Create walk-in
            </Link>
          </div>
        </div>
        <FrontDeskReservationsPage hotelId={hotel.id} hotelName={hotel.name} payload={payload} />
      </main>
    </div>
  );
}

function dateParam(value: string | string[] | undefined) {
  const first = Array.isArray(value) ? value[0] : value;
  if (!first || !/^\d{4}-\d{2}-\d{2}$/.test(first)) return null;
  return first;
}
