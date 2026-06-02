import { redirect } from "next/navigation";
import { AppTopbar } from "@/components/app-topbar";
import { HotelWorkspace } from "@/components/hotel-workspace";
import { SetupPanel } from "@/components/setup-panel";
import { getIdentity, isClerkConfigured, isDemoMode, requireHotelSession } from "@/lib/authz";
import { isDatabaseConfigured } from "@/lib/db";
import { allHotelRoles, getHotel, loadHousekeepingSupervisor, loadManagerDashboard, loadTodayDesk } from "@/lib/hotel-service";
import type { AppRole, ReservationSummary, TodayDeskPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HotelPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const demoMode = isDemoMode();
  if (!demoMode && (!isClerkConfigured() || !isDatabaseConfigured())) {
    return <SetupPanel clerkConfigured={isClerkConfigured()} databaseConfigured={isDatabaseConfigured()} />;
  }
  const identity = await getIdentity();
  if (!identity) redirect("/sign-in");
  const { hotelId } = await params;
  const { session } = await requireHotelSession(hotelId, allHotelRoles);
  const hotel = await getHotel(hotelId);
  const [rawToday, manager, supervisor] = await Promise.all([
    loadTodayDesk(hotelId),
    roleNeedsManager(session.role) ? loadManagerDashboard(hotelId) : Promise.resolve(null),
    roleNeedsHousekeepers(session.role) || session.rolePreviewEnabled ? loadHousekeepingSupervisor(hotelId) : Promise.resolve(null),
  ]);
  const today = limitTodayForRole(session.role, rawToday, session.previewStaffId ?? session.userId);
  const focusedHousekeepingMode = demoMode && session.role === "housekeeping";
  const rolePreview = session.rolePreviewEnabled ? { hotelId, hotelName: hotel.name, session, housekeepers: supervisor?.housekeepers ?? [] } : undefined;
  return (
    <div className="page-shell">
      {focusedHousekeepingMode ? null : <AppTopbar rolePreview={rolePreview} />}
      <HotelWorkspace
        hotel={hotel}
        session={session}
        today={today}
        manager={manager}
        housekeepers={supervisor?.housekeepers ?? []}
        focusedHousekeepingMode={focusedHousekeepingMode}
      />
    </div>
  );
}

function roleNeedsManager(role: AppRole) {
  return role === "owner" || role === "manager";
}

function roleNeedsHousekeepers(role: AppRole) {
  return roleNeedsManager(role) || role === "housekeeping-supervisor";
}

function limitTodayForRole(role: AppRole, today: TodayDeskPayload, staffScopeId: string): TodayDeskPayload {
  if (role === "owner" || role === "manager" || role === "front-desk") return today;

  if (role === "housekeeping") {
    const housekeepingTasks = today.housekeepingTasks.filter((task) => task.assigneeStaffId === staffScopeId);
    const assignedRoomIds = new Set(housekeepingTasks.map((task) => task.roomId));
    const rooms = today.rooms.filter((room) => assignedRoomIds.has(room.id));
    const arrivals = today.arrivals.filter((row) => assignedRoomIds.has(row.roomId)).map(maskReservationForHousekeeping);
    const departures = today.departures.filter((row) => assignedRoomIds.has(row.roomId)).map(maskReservationForHousekeeping);
    return {
      ...today,
      stats: {
        arrivals: 0,
        departures: 0,
        inHouse: 0,
        pendingRequests: 0,
        openMaintenance: 0,
        roomsReady: rooms.filter((room) => room.status === "ready").length,
        roomsDirty: rooms.filter((room) => room.status === "dirty" || room.status === "cleaning").length,
      },
      rooms,
      arrivals,
      departures,
      inHouse: [],
      bookingRequests: [],
      housekeepingTasks,
      maintenanceTickets: [],
    };
  }

  return {
    ...today,
    arrivals: [],
    departures: [],
    inHouse: [],
    bookingRequests: [],
    housekeepingTasks: role === "maintenance" ? [] : today.housekeepingTasks,
  };
}

function maskReservationForHousekeeping(reservation: ReservationSummary): ReservationSummary {
  return {
    ...reservation,
    guestName: "",
    guestPhone: "",
    notes: "",
  };
}
