import "server-only";

import type {
  AppRole,
  AuditLogEntry,
  BookingRequest,
  Guest,
  GuestInput,
  HostedSession,
  Hotel,
  HotelMembership,
  HousekeepingInput,
  HousekeepingTask,
  MaintenanceInput,
  MaintenanceTicket,
  ManagerDashboardPayload,
  ManagerStats,
  PortfolioDashboardPayload,
  ReportRoomIssueInput,
  ReservationStatus,
  ReservationSummary,
  ReviewRoomIssueInput,
  RoomStatus,
  Room,
  SearchResults,
  StaffMember,
  TodayDeskPayload,
  WalkInInput,
} from "@/lib/types";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { demoLoginUsers, demoUserForId } from "@/lib/demo-users";
import { roleAllowed } from "@/lib/roles";

type DemoStore = {
  hotels: Hotel[];
  memberships: HotelMembership[];
  rooms: Record<string, Room[]>;
  guests: Record<string, Guest[]>;
  reservations: Record<string, ReservationSummary[]>;
  bookingRequests: Record<string, BookingRequest[]>;
  housekeepingTasks: Record<string, HousekeepingTask[]>;
  staff: Record<string, StaffMember[]>;
  maintenanceTickets: Record<string, MaintenanceTicket[]>;
  auditLogs: Record<string, AuditLogEntry[]>;
};

const orgId = "demo-org";
const demoClerkOrganizationId = "demo-clerk-org";

export function demoIdentityForUser(userId: string) {
  const user = demoUserForId(userId);
  if (!user) return null;
  return {
    userId: user.userId,
    clerkOrganizationId: demoClerkOrganizationId,
    displayName: user.displayName,
    email: user.email,
  };
}

const demoGlobal = globalThis as typeof globalThis & { __hotelDemoStore?: DemoStore };

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowString() {
  return new Date(Date.now() + 86400000).toISOString().slice(0, 10);
}

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function initStore(): DemoStore {
  const today = todayString();
  const tomorrow = tomorrowString();
  const hotels: Hotel[] = [
    { id: "hotel-cove-house", organizationId: orgId, name: "Cove House Hotel", city: "Galveston", state: "TX", timezone: "America/Chicago", active: true },
    { id: "hotel-river-gate", organizationId: orgId, name: "River Gate Inn", city: "San Antonio", state: "TX", timezone: "America/Chicago", active: true },
  ];
  const memberships: HotelMembership[] = demoLoginUsers.flatMap((user) =>
    user.hotelIds.map((hotelId) => ({
      id: `member-${hotelId}-${user.userId}`,
      organizationId: orgId,
      hotelId,
      clerkUserId: user.userId,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      active: true,
    })),
  );

  const rooms: DemoStore["rooms"] = {};
  const guests: DemoStore["guests"] = {};
  const reservations: DemoStore["reservations"] = {};
  const bookingRequests: DemoStore["bookingRequests"] = {};
  const housekeepingTasks: DemoStore["housekeepingTasks"] = {};
  const staff: DemoStore["staff"] = {};
  const maintenanceTickets: DemoStore["maintenanceTickets"] = {};
  const auditLogs: DemoStore["auditLogs"] = {};

  hotels.forEach((hotel, index) => {
    const prefix = index === 0 ? "C" : "R";
    rooms[hotel.id] = [
      { id: `${hotel.id}-101`, number: `${prefix}101`, roomType: "King", floor: 1, capacity: 2, nightlyRateCents: 15900, status: "ready" },
      { id: `${hotel.id}-102`, number: `${prefix}102`, roomType: "Double Queen", floor: 1, capacity: 4, nightlyRateCents: 17900, status: "dirty" },
      { id: `${hotel.id}-201`, number: `${prefix}201`, roomType: "Suite", floor: 2, capacity: 4, nightlyRateCents: 24900, status: "occupied" },
      { id: `${hotel.id}-202`, number: `${prefix}202`, roomType: "King", floor: 2, capacity: 2, nightlyRateCents: 15900, status: "maintenance" },
    ];
    guests[hotel.id] = [
      { id: `${hotel.id}-guest-1`, fullName: "Jamie Morgan", email: "jamie@example.com", phone: "555-0101", notes: "", createdAt: today },
      { id: `${hotel.id}-guest-2`, fullName: "Taylor Brooks", email: "taylor@example.com", phone: "555-0119", notes: "Late arrival", createdAt: today },
    ];
    reservations[hotel.id] = [
      {
        id: `${hotel.id}-res-1`,
        guestId: `${hotel.id}-guest-1`,
        guestName: "Jamie Morgan",
        guestPhone: "555-0101",
        roomId: `${hotel.id}-201`,
        roomNumber: `${prefix}201`,
        roomType: "Suite",
        checkIn: today,
        checkOut: tomorrow,
        adults: 2,
        children: 0,
        nightlyRateCents: 24900,
        totalCents: 24900,
        source: "direct",
        status: "checked-in",
        notes: "",
      },
      {
        id: `${hotel.id}-res-2`,
        guestId: `${hotel.id}-guest-2`,
        guestName: "Taylor Brooks",
        guestPhone: "555-0119",
        roomId: `${hotel.id}-101`,
        roomNumber: `${prefix}101`,
        roomType: "King",
        checkIn: today,
        checkOut: tomorrow,
        adults: 1,
        children: 0,
        nightlyRateCents: 15900,
        totalCents: 15900,
        source: "phone",
        status: "confirmed",
        notes: "Late arrival",
      },
    ];
    bookingRequests[hotel.id] = [
      { id: `${hotel.id}-request-1`, fullName: "Alex Rivera", phone: "555-0199", email: "alex@example.com", checkIn: tomorrow, checkOut: tomorrow, requestedRoomType: "King", status: "new", message: "Needs quiet room." },
    ];
    staff[hotel.id] =
      hotel.id === "hotel-cove-house"
        ? [
            { id: "staff-manager", fullName: "Demo Manager", role: "manager", active: true },
            { id: "staff-front-desk", fullName: "Demo Front Desk", role: "front-desk", active: true },
            { id: "staff-housekeeping-supervisor", fullName: "Demo Housekeeping Supervisor", role: "housekeeping-supervisor", active: true },
            { id: "staff-hk-ava", fullName: "Ava Patel", role: "housekeeping", active: true },
            { id: "staff-hk-ben", fullName: "Ben Carter", role: "housekeeping", active: true },
            { id: "staff-hk-mia", fullName: "Mia Nguyen", role: "housekeeping", active: true },
            { id: "staff-hk-noah", fullName: "Noah Williams", role: "housekeeping", active: true },
            { id: "staff-maintenance", fullName: "Demo Maintenance", role: "maintenance", active: true },
          ]
        : [
            { id: `${hotel.id}-manager`, fullName: "River Gate Manager", role: "manager", active: true },
            { id: `${hotel.id}-hk-ava`, fullName: "River Gate Housekeeper", role: "housekeeping", active: true },
            { id: `${hotel.id}-maintenance`, fullName: "River Gate Maintenance", role: "maintenance", active: true },
          ];
    housekeepingTasks[hotel.id] = [
      { id: `${hotel.id}-hk-task-1`, roomId: `${hotel.id}-102`, roomNumber: `${prefix}102`, title: "Turn room after checkout", status: "dirty", dueDate: today, notes: "", assigneeStaffId: hotel.id === "hotel-cove-house" ? "staff-hk-ava" : `${hotel.id}-hk-ava`, assigneeName: hotel.id === "hotel-cove-house" ? "Ava Patel" : "River Gate Housekeeper", updatedAt: new Date().toISOString() },
    ];
    maintenanceTickets[hotel.id] = [
      { id: `${hotel.id}-mt-1`, roomId: `${hotel.id}-202`, roomNumber: `${prefix}202`, title: "HVAC check", priority: "high", status: "open", dueDate: today },
    ];
    auditLogs[hotel.id] = [
      { id: `${hotel.id}-audit-1`, actorRole: "owner", action: "demo.seed", entityType: "hotel", entityId: hotel.id, createdAt: new Date().toISOString() },
    ];
  });

  return { hotels, memberships, rooms, guests, reservations, bookingRequests, housekeepingTasks, staff, maintenanceTickets, auditLogs };
}

function demoStore() {
  demoGlobal.__hotelDemoStore ??= initStore();
  return demoGlobal.__hotelDemoStore;
}

export function resetDemoStore() {
  demoGlobal.__hotelDemoStore = initStore();
}

export function demoMembershipsForUser(userId: string) {
  return demoStore().memberships.filter((membership) => membership.clerkUserId === userId && membership.active);
}

export function demoRequireAnyHotelSession(userId: string) {
  const identity = demoIdentityForUser(userId);
  if (!identity) throw forbidden("Invalid demo user.");
  const memberships = demoMembershipsForUser(userId);
  if (memberships.length === 0) throw forbidden("Your demo user has no hotel memberships.");
  const primary = memberships[0];
  const session: HostedSession = {
    userId,
    displayName: identity.displayName,
    organizationId: primary.organizationId,
    activeHotelId: primary.hotelId,
    role: primary.role,
  };
  return { identity, memberships, session };
}

export function demoRequireHotelSession(userId: string, hotelId: string, allowed: readonly AppRole[]) {
  const identity = demoIdentityForUser(userId);
  if (!identity) throw forbidden("Invalid demo user.");
  const membership = demoStore().memberships.find((candidate) => candidate.hotelId === hotelId && candidate.clerkUserId === userId && candidate.active);
  if (!membership) throw forbidden("You are not a member of this demo hotel.");
  if (!roleAllowed(membership.role, allowed)) throw forbidden("Your demo role cannot perform that action.");
  const session: HostedSession = {
    userId,
    displayName: identity.displayName,
    organizationId: membership.organizationId,
    activeHotelId: hotelId,
    role: membership.role,
  };
  return { identity, membership, session };
}

export function demoGetHotel(hotelId: string) {
  const hotel = demoStore().hotels.find((candidate) => candidate.id === hotelId && candidate.active);
  if (!hotel) throw notFound("Demo hotel was not found.");
  return hotel;
}

function roomsFor(hotelId: string) {
  return demoStore().rooms[hotelId] ?? [];
}

function reservationsFor(hotelId: string) {
  return demoStore().reservations[hotelId] ?? [];
}

function housekeepingFor(hotelId: string) {
  return demoStore().housekeepingTasks[hotelId] ?? [];
}

function maintenanceFor(hotelId: string) {
  return demoStore().maintenanceTickets[hotelId] ?? [];
}

function guestsFor(hotelId: string) {
  return demoStore().guests[hotelId] ?? [];
}

function audit(hotelId: string, session: Pick<HostedSession, "role">, action: string, entityType: string, entityId: string) {
  demoStore().auditLogs[hotelId].unshift({ id: createId("audit"), actorRole: session.role, action, entityType, entityId, createdAt: new Date().toISOString() });
}

function isInactiveMaintenanceStatus(status: MaintenanceInput["status"]) {
  return status === "resolved" || status === "cancelled";
}

function markDemoRoomInMaintenance(hotelId: string, session: HostedSession, roomId: string) {
  const room = roomsFor(hotelId).find((candidate) => candidate.id === roomId);
  if (!room || room.status === "maintenance") return;
  room.status = "maintenance";
  audit(hotelId, session, "room.status.auto", "room", roomId);
}

function releaseDemoRoomFromMaintenanceIfClear(hotelId: string, session: HostedSession, roomId: string) {
  const hasActiveTicket = maintenanceFor(hotelId).some((ticket) => ticket.roomId === roomId && !isInactiveMaintenanceStatus(ticket.status));
  if (hasActiveTicket) return;
  const room = roomsFor(hotelId).find((candidate) => candidate.id === roomId);
  if (!room || room.status !== "maintenance") return;
  room.status = "dirty";
  audit(hotelId, session, "room.status.auto", "room", roomId);
}

function reconcileDemoMaintenanceRoomState(hotelId: string, session: HostedSession, roomId: string, status: MaintenanceInput["status"]) {
  if (isInactiveMaintenanceStatus(status)) {
    releaseDemoRoomFromMaintenanceIfClear(hotelId, session, roomId);
    return;
  }
  markDemoRoomInMaintenance(hotelId, session, roomId);
}

function managerStats(hotelId: string): ManagerStats & { roomsTotal: number } {
  const rooms = roomsFor(hotelId);
  const reservations = reservationsFor(hotelId);
  const today = todayString();
  const inHouse = reservations.filter((reservation) => reservation.status === "checked-in").length;
  const roomsTotal = rooms.length;
  return {
    occupancyPercent: roomsTotal === 0 ? 0 : Math.round((inHouse / roomsTotal) * 100),
    arrivalsToday: reservations.filter((reservation) => reservation.checkIn === today && ["pending", "confirmed"].includes(reservation.status)).length,
    departuresToday: reservations.filter((reservation) => reservation.checkOut === today && reservation.status === "checked-in").length,
    inHouse,
    pendingRequests: (demoStore().bookingRequests[hotelId] ?? []).filter((request) => ["new", "contacted"].includes(request.status)).length,
    dirtyRooms: rooms.filter((room) => ["dirty", "cleaning"].includes(room.status)).length,
    openMaintenance: maintenanceFor(hotelId).filter((ticket) => !["resolved", "cancelled"].includes(ticket.status)).length,
    revenueCents: reservations.filter((reservation) => ["checked-in", "checked-out", "confirmed"].includes(reservation.status)).reduce((sum, reservation) => sum + reservation.totalCents, 0),
    roomsTotal,
  };
}

function countRows(rows: { label: string }[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  rows.forEach((row) => counts.set(row.label, (counts.get(row.label) ?? 0) + 1));
  return [...counts].map(([label, count]) => ({ label, count }));
}

export function demoLoadTodayDesk(hotelId: string): TodayDeskPayload {
  demoGetHotel(hotelId);
  const today = todayString();
  const stats = managerStats(hotelId);
  const rooms = roomsFor(hotelId);
  const reservations = reservationsFor(hotelId);
  return {
    today,
    stats: {
      arrivals: stats.arrivalsToday,
      departures: stats.departuresToday,
      inHouse: stats.inHouse,
      pendingRequests: stats.pendingRequests,
      openMaintenance: stats.openMaintenance,
      roomsReady: rooms.filter((room) => room.status === "ready" || room.status === "available").length,
      roomsDirty: stats.dirtyRooms,
    },
    rooms,
    arrivals: reservations.filter((reservation) => reservation.checkIn === today && ["pending", "confirmed"].includes(reservation.status)),
    departures: reservations.filter((reservation) => reservation.checkOut === today && reservation.status === "checked-in"),
    inHouse: reservations.filter((reservation) => reservation.status === "checked-in"),
    bookingRequests: demoStore().bookingRequests[hotelId] ?? [],
    housekeepingTasks: housekeepingFor(hotelId).filter((task) => !["ready", "blocked"].includes(task.status)),
    maintenanceTickets: maintenanceFor(hotelId).filter((ticket) => !["resolved", "cancelled"].includes(ticket.status)),
  };
}

export function demoLoadManagerDashboard(hotelId: string): ManagerDashboardPayload {
  const today = todayString();
  const reservations = reservationsFor(hotelId);
  const rooms = roomsFor(hotelId);
  return {
    today,
    stats: managerStats(hotelId),
    roomStatusCounts: countRows(rooms.map((room) => ({ label: room.status }))),
    demandByRoomType: countRows(reservations.map((reservation) => ({ label: reservation.roomType }))),
    bookingSourceMix: countRows(reservations.map((reservation) => ({ label: reservation.source }))),
    upcoming: reservations.filter((reservation) => reservation.checkIn >= today && ["pending", "confirmed"].includes(reservation.status)),
    maintenance: maintenanceFor(hotelId).filter((ticket) => !["resolved", "cancelled"].includes(ticket.status)),
    recentAudit: demoStore().auditLogs[hotelId] ?? [],
  };
}

export function demoLoadPortfolio(session: HostedSession): PortfolioDashboardPayload {
  const memberships = demoMembershipsForUser(session.userId);
  const hotels = memberships.map((membership) => {
    const hotel = demoGetHotel(membership.hotelId);
    const stats = managerStats(hotel.id);
    return { hotel, role: membership.role, stats, roomsTotal: stats.roomsTotal };
  });
  const totals = hotels.reduce(
    (acc, row) => ({
      hotels: acc.hotels + 1,
      rooms: acc.rooms + row.roomsTotal,
      inHouse: acc.inHouse + row.stats.inHouse,
      arrivalsToday: acc.arrivalsToday + row.stats.arrivalsToday,
      departuresToday: acc.departuresToday + row.stats.departuresToday,
      openMaintenance: acc.openMaintenance + row.stats.openMaintenance,
      revenueCents: acc.revenueCents + row.stats.revenueCents,
    }),
    { hotels: 0, rooms: 0, inHouse: 0, arrivalsToday: 0, departuresToday: 0, openMaintenance: 0, revenueCents: 0 },
  );
  return { session, hotels, totals };
}

export function demoCreateWalkInReservation(hotelId: string, session: HostedSession, input: WalkInInput) {
  const room = roomsFor(hotelId).find((candidate) => candidate.id === input.roomId);
  if (!room) throw notFound("Room was not found for this demo hotel.");
  if (["occupied", "maintenance"].includes(room.status)) throw badRequest("Room is not available for a walk-in.");
  const guestId = input.guestId?.trim() || createId("guest");
  const reservationId = createId("res");
  const guest = { id: guestId, fullName: input.fullName, email: input.email, phone: input.phone, notes: input.guestNotes, createdAt: todayString() };
  demoStore().guests[hotelId].push(guest);
  const nights = Math.max(1, Math.round((Date.parse(input.checkOut) - Date.parse(input.checkIn)) / 86400000) || 1);
  reservationsFor(hotelId).push({
    id: reservationId,
    guestId,
    guestName: input.fullName,
    guestPhone: input.phone,
    roomId: room.id,
    roomNumber: room.number,
    roomType: room.roomType,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    adults: input.adults,
    children: input.children,
    nightlyRateCents: input.nightlyRateCents,
    totalCents: nights * input.nightlyRateCents,
    source: "walk-in",
    status: "checked-in",
    notes: input.notes,
  });
  room.status = "occupied";
  audit(hotelId, session, "reservation.walk-in", "reservation", reservationId);
  return { id: reservationId };
}

export function demoUpdateReservationStatus(hotelId: string, session: HostedSession, reservationId: string, status: ReservationStatus) {
  const reservation = reservationsFor(hotelId).find((candidate) => candidate.id === reservationId);
  if (!reservation) throw notFound("Reservation was not found for this demo hotel.");
  reservation.status = status;
  const room = roomsFor(hotelId).find((candidate) => candidate.id === reservation.roomId);
  if (room && status === "checked-in") room.status = "occupied";
  if (room && status === "checked-out") {
    room.status = "dirty";
    housekeepingFor(hotelId).push({ id: createId("hk"), roomId: room.id, roomNumber: room.number, title: "Turn room after checkout", status: "dirty", dueDate: todayString(), notes: "", updatedAt: new Date().toISOString() });
  }
  audit(hotelId, session, "reservation.status", "reservation", reservationId);
}

export function demoAssignHousekeepingTask(hotelId: string, session: HostedSession, roomId: string, staffId: string) {
  const room = roomsFor(hotelId).find((candidate) => candidate.id === roomId);
  if (!room) throw notFound("Room was not found for this demo hotel.");
  if (["occupied", "maintenance"].includes(room.status)) throw badRequest("Occupied or maintenance rooms cannot be assigned.");
  const assignee = (demoStore().staff[hotelId] ?? []).find((member) => member.id === staffId && member.role === "housekeeping");
  if (!assignee) throw notFound("Housekeeper was not found for this demo hotel.");
  let task = housekeepingFor(hotelId).find((candidate) => candidate.roomId === roomId && !["ready", "blocked"].includes(candidate.status));
  if (!task) {
    task = { id: createId("hk"), roomId, roomNumber: room.number, title: `Clean room ${room.number}`, status: "dirty", dueDate: todayString(), notes: "", updatedAt: new Date().toISOString() };
    housekeepingFor(hotelId).push(task);
  }
  task.assigneeStaffId = staffId;
  task.assigneeName = assignee.fullName;
  task.status = "dirty";
  room.status = "dirty";
  audit(hotelId, session, "housekeeping.assign", "housekeeping_task", task.id);
  return { id: task.id };
}

function taskForRoom(hotelId: string, roomId: string, session?: HostedSession) {
  const task = housekeepingFor(hotelId).find((candidate) => candidate.roomId === roomId && !["ready", "blocked"].includes(candidate.status));
  if (!task) throw notFound("Housekeeping task was not found for this demo hotel.");
  if (session?.role === "housekeeping" && task.assigneeStaffId !== session.userId) {
    throw forbidden("This room is not assigned to your demo user.");
  }
  return task;
}

export function demoStartHousekeepingRoom(hotelId: string, session: HostedSession, roomId: string) {
  const task = taskForRoom(hotelId, roomId, session);
  task.status = "cleaning";
  task.updatedAt = new Date().toISOString();
  const room = roomsFor(hotelId).find((candidate) => candidate.id === roomId);
  if (room) room.status = "cleaning";
  audit(hotelId, session, "housekeeping.start", "housekeeping_task", task.id);
}

export function demoFinishHousekeepingRoom(hotelId: string, session: HostedSession, roomId: string) {
  const task = taskForRoom(hotelId, roomId, session);
  task.status = "inspection";
  task.updatedAt = new Date().toISOString();
  audit(hotelId, session, "housekeeping.finish", "housekeeping_task", task.id);
}

export function demoApproveHousekeepingRoom(hotelId: string, session: HostedSession, roomId: string) {
  const task = taskForRoom(hotelId, roomId);
  task.status = "ready";
  task.notes = "";
  task.updatedAt = new Date().toISOString();
  const room = roomsFor(hotelId).find((candidate) => candidate.id === roomId);
  if (room) room.status = "ready";
  audit(hotelId, session, "housekeeping.approve", "housekeeping_task", task.id);
}

export function demoSendBackHousekeepingRoom(hotelId: string, session: HostedSession, roomId: string, reason: string) {
  const task = taskForRoom(hotelId, roomId);
  task.status = "cleaning";
  task.notes = reason;
  task.updatedAt = new Date().toISOString();
  const room = roomsFor(hotelId).find((candidate) => candidate.id === roomId);
  if (room) room.status = "cleaning";
  audit(hotelId, session, "housekeeping.send-back", "housekeeping_task", task.id);
}

export function demoCreateMaintenanceTicket(hotelId: string, session: HostedSession, input: MaintenanceInput) {
  const room = roomsFor(hotelId).find((candidate) => candidate.id === input.roomId);
  if (!room) throw notFound("Room was not found for this demo hotel.");
  const id = input.id?.trim() || createId("mt");
  const existing = maintenanceFor(hotelId).find((ticket) => ticket.id === id);
  if (existing) return demoUpdateMaintenanceTicket(hotelId, session, id, input);
  maintenanceFor(hotelId).push({ id, roomId: room.id, roomNumber: room.number, title: input.title, priority: input.priority, status: input.status, dueDate: input.dueDate });
  if (!isInactiveMaintenanceStatus(input.status)) {
    markDemoRoomInMaintenance(hotelId, session, room.id);
  }
  audit(hotelId, session, "maintenance.create", "maintenance_ticket", id);
  return { id };
}

export function demoUpdateMaintenanceTicket(hotelId: string, session: HostedSession, ticketId: string, input: MaintenanceInput) {
  const ticket = maintenanceFor(hotelId).find((candidate) => candidate.id === ticketId);
  if (!ticket) throw notFound("Maintenance ticket was not found for this demo hotel.");
  const room = roomsFor(hotelId).find((candidate) => candidate.id === input.roomId);
  if (!room) throw notFound("Room was not found for this demo hotel.");

  const previousRoomId = ticket.roomId;
  const previousStatus = ticket.status;
  ticket.roomId = room.id;
  ticket.roomNumber = room.number;
  ticket.title = input.title;
  ticket.priority = input.priority;
  ticket.status = input.status;
  ticket.dueDate = input.dueDate;

  if (previousRoomId !== room.id) {
    releaseDemoRoomFromMaintenanceIfClear(hotelId, session, previousRoomId);
  }
  reconcileDemoMaintenanceRoomState(hotelId, session, room.id, input.status);

  const action =
    input.status === "resolved" && previousStatus !== "resolved"
      ? "maintenance.resolve"
      : input.status === "cancelled" && previousStatus !== "cancelled"
        ? "maintenance.cancel"
        : "maintenance.update";
  audit(hotelId, session, action, "maintenance_ticket", ticket.id);
  return ticket;
}

export function demoSearchFrontDesk(hotelId: string, query: string, limit = 25): SearchResults {
  demoGetHotel(hotelId);
  const value = query.trim().toLowerCase();
  if (!value) return { guests: [], reservations: [], rooms: [] };
  const take = Math.max(1, Math.min(50, limit));
  const matches = (...values: string[]) => values.some((item) => item.toLowerCase().includes(value));
  return {
    guests: guestsFor(hotelId).filter((guest) => matches(guest.fullName, guest.email, guest.phone)).slice(0, take),
    reservations: reservationsFor(hotelId)
      .filter((reservation) =>
        matches(
          reservation.id,
          reservation.guestName,
          reservation.guestPhone,
          reservation.roomNumber,
          reservation.checkIn,
          reservation.checkOut,
          reservation.status,
        ),
      )
      .slice(0, take),
    rooms: roomsFor(hotelId).filter((room) => matches(room.number, room.roomType, room.status)).slice(0, take),
  };
}

export function demoSaveGuest(hotelId: string, session: HostedSession, input: GuestInput) {
  const id = input.id?.trim() || createId("guest");
  const guests = guestsFor(hotelId);
  const existing = guests.find((guest) => guest.id === id);
  if (existing) {
    existing.fullName = input.fullName;
    existing.email = input.email;
    existing.phone = input.phone;
    existing.notes = input.notes;
  } else {
    guests.push({ id, fullName: input.fullName, email: input.email, phone: input.phone, notes: input.notes, createdAt: todayString() });
  }
  audit(hotelId, session, existing ? "guest.update" : "guest.create", "guest", id);
  const saved = guests.find((guest) => guest.id === id);
  if (!saved) throw notFound("Guest was not found after saving.");
  return saved;
}

export function demoSaveRoomStatus(hotelId: string, session: HostedSession, roomId: string, status: RoomStatus) {
  const room = roomsFor(hotelId).find((candidate) => candidate.id === roomId);
  if (!room) throw notFound("Room was not found for this demo hotel.");
  if (session.role === "housekeeping" && ["occupied", "maintenance"].includes(room.status)) {
    throw badRequest("Housekeeping cannot change occupied or maintenance rooms.");
  }
  if (session.role === "housekeeping" && status === "ready") {
    throw badRequest("Ready status requires supervisor approval.");
  }
  room.status = status;
  if (["dirty", "cleaning", "ready"].includes(status)) {
    let task = housekeepingFor(hotelId).find((candidate) => candidate.roomId === roomId && !["ready", "blocked"].includes(candidate.status));
    if (!task) {
      task = { id: createId("hk"), roomId, roomNumber: room.number, title: `Room ${room.number} readiness`, status, dueDate: todayString(), notes: "", updatedAt: new Date().toISOString() };
      housekeepingFor(hotelId).push(task);
    }
    task.status = status;
    task.updatedAt = new Date().toISOString();
  }
  audit(hotelId, session, "room.status.update", "room", roomId);
}

export function demoSaveHousekeepingTask(hotelId: string, session: HostedSession, input: HousekeepingInput) {
  const room = roomsFor(hotelId).find((candidate) => candidate.id === input.roomId);
  if (!room) throw notFound("Room was not found for this demo hotel.");
  const id = createId("hk");
  housekeepingFor(hotelId).push({
    id,
    roomId: room.id,
    roomNumber: room.number,
    title: input.title,
    status: input.status,
    dueDate: input.dueDate,
    notes: "",
    updatedAt: new Date().toISOString(),
  });
  if (["dirty", "cleaning", "ready"].includes(input.status)) room.status = input.status as RoomStatus;
  audit(hotelId, session, "housekeeping.create", "housekeeping_task", id);
  return { id };
}

export function demoReportRoomIssue(hotelId: string, session: HostedSession, input: ReportRoomIssueInput) {
  const room = roomsFor(hotelId).find((candidate) => candidate.id === input.roomId);
  if (!room) throw notFound("Room was not found for this demo hotel.");
  const id = createId("mt");
  const ticket: MaintenanceTicket = {
    id,
    roomId: room.id,
    roomNumber: room.number,
    title: input.title,
    priority: "medium",
    status: "pending-review",
    dueDate: todayString(),
  };
  maintenanceFor(hotelId).push(ticket);
  const task = housekeepingFor(hotelId).find((candidate) => candidate.roomId === room.id && !["ready", "blocked"].includes(candidate.status));
  if (task) {
    task.status = "blocked";
    task.notes = input.title;
    task.updatedAt = new Date().toISOString();
    audit(hotelId, session, "housekeeping.issue-hold", "housekeeping_task", task.id);
  }
  audit(hotelId, session, "maintenance.report", "maintenance_ticket", id);
  return ticket;
}

export function demoApproveRoomIssueReport(hotelId: string, session: HostedSession, input: ReviewRoomIssueInput) {
  const ticket = maintenanceFor(hotelId).find((candidate) => candidate.id === input.ticketId);
  if (!ticket) throw notFound("Room issue report was not found.");
  if (ticket.status !== "pending-review") throw badRequest("Only pending issue reports can be approved.");
  ticket.title = input.title;
  ticket.priority = input.priority;
  ticket.status = "open";
  const room = roomsFor(hotelId).find((candidate) => candidate.id === ticket.roomId);
  if (room) room.status = "maintenance";
  const task = housekeepingFor(hotelId).find((candidate) => candidate.roomId === ticket.roomId && candidate.status === "blocked");
  if (task) task.updatedAt = new Date().toISOString();
  audit(hotelId, session, "maintenance.approve-report", "maintenance_ticket", ticket.id);
  if (room) audit(hotelId, session, "room.status.auto", "room", room.id);
  return ticket;
}

export function demoCancelRoomIssueReport(hotelId: string, session: HostedSession, ticketId: string) {
  const ticket = maintenanceFor(hotelId).find((candidate) => candidate.id === ticketId);
  if (!ticket) throw notFound("Room issue report was not found.");
  if (ticket.status !== "pending-review") throw badRequest("Only pending issue reports can be cancelled.");
  ticket.status = "cancelled";
  const task = housekeepingFor(hotelId).find((candidate) => candidate.roomId === ticket.roomId && candidate.status === "blocked");
  if (task) {
    task.status = "dirty";
    task.updatedAt = new Date().toISOString();
    audit(hotelId, session, "housekeeping.issue-release", "housekeeping_task", task.id);
  }
  audit(hotelId, session, "maintenance.cancel-report", "maintenance_ticket", ticket.id);
  return ticket;
}

export function demoCreateBackup(hotelId: string) {
  demoGetHotel(hotelId);
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      hotel: demoGetHotel(hotelId),
      rooms: roomsFor(hotelId),
      guests: guestsFor(hotelId),
      reservations: reservationsFor(hotelId),
      bookingRequests: demoStore().bookingRequests[hotelId] ?? [],
      housekeepingTasks: housekeepingFor(hotelId),
      maintenanceTickets: maintenanceFor(hotelId),
      auditLogs: demoStore().auditLogs[hotelId] ?? [],
    },
    null,
    2,
  );
}

export function demoLoadHousekeepingWork(hotelId: string, session: HostedSession) {
  const payload = demoLoadTodayDesk(hotelId);
  const housekeepingTasks = payload.housekeepingTasks.filter((task) => task.assigneeStaffId === session.userId);
  const assignedRoomIds = new Set(housekeepingTasks.map((task) => task.roomId));
  return {
    today: payload.today,
    rooms: payload.rooms.filter((room) => assignedRoomIds.has(room.id)),
    arrivals: payload.arrivals,
    departures: payload.departures,
    housekeepingTasks,
  };
}

export function demoLoadHousekeepingSupervisor(hotelId: string) {
  const payload = demoLoadTodayDesk(hotelId);
  return {
    today: payload.today,
    rooms: payload.rooms,
    arrivals: payload.arrivals,
    departures: payload.departures,
    housekeepingTasks: payload.housekeepingTasks,
    maintenanceTickets: payload.maintenanceTickets,
    housekeepers: (demoStore().staff[hotelId] ?? []).filter((member) => member.role === "housekeeping" && member.active),
    recentAudit: demoStore().auditLogs[hotelId] ?? [],
  };
}

export function demoExportCsvReport(hotelId: string, report: string) {
  if (!["rooms", "reservations", "maintenance"].includes(report)) throw badRequest("Unknown report type.");
  if (report === "rooms") return toCsv(["number", "roomType", "floor", "capacity", "nightlyRateCents", "status"], roomsFor(hotelId));
  if (report === "maintenance") return toCsv(["id", "roomNumber", "title", "priority", "status", "dueDate"], maintenanceFor(hotelId));
  return toCsv(["id", "guestName", "roomNumber", "checkIn", "checkOut", "status", "totalCents", "source"], reservationsFor(hotelId));
}

function toCsv(headers: string[], rows: object[]) {
  const escape = (value: unknown) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape((row as Record<string, unknown>)[header])).join(","))].join("\n");
}
