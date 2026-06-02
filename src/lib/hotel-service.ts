import "server-only";

import { isDemoMode } from "@/lib/authz";
import {
  isHousekeepingActionAllowed,
  isMaintenanceCreateStatusAllowed,
  isMaintenanceTransitionAllowed,
  isReservationTransitionAllowed,
  normalizeSearchLimit,
} from "@/lib/validation";
import { appRoles } from "@/lib/roles";
import {
  demoApproveHousekeepingRoom,
  demoAssignHousekeepingTask,
  demoApproveRoomIssueReport,
  demoCancelRoomIssueReport,
  demoCreateBackup,
  demoCreateMaintenanceTicket,
  demoCreateWalkInReservation,
  demoExportCsvReport,
  demoFinishHousekeepingRoom,
  demoGetHotel,
  demoLoadFrontDeskReservations,
  demoLoadHousekeepingSupervisor,
  demoLoadHousekeepingWork,
  demoLoadManagerDashboard,
  demoLoadPortfolio,
  demoLoadReservationDetail,
  demoLoadTodayDesk,
  demoReportRoomIssue,
  demoSaveGuest,
  demoSaveHousekeepingTask,
  demoSaveRoomStatus,
  demoSearchFrontDesk,
  demoSendBackHousekeepingRoom,
  demoStartHousekeepingRoom,
  demoUpdateMaintenanceTicket,
  demoUpdateReservationStatus,
} from "@/lib/demo-store";
import { getSql } from "@/lib/db";
import { badRequest, notFound } from "@/lib/errors";
import type {
  AppRole,
  AuditLogEntry,
  BookingRequest,
  CountRow,
  FrontDeskReservationsPayload,
  Guest,
  GuestInput,
  HostedSession,
  Hotel,
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

const allHotelRoles = appRoles;

export function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}

export function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function nightsBetween(checkIn: string, checkOut: string) {
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 1;
  return Math.max(1, Math.round((end - start) / 86400000));
}

export function addDaysString(date: string, days: number) {
  const base = Date.parse(`${date}T00:00:00Z`);
  const timestamp = Number.isNaN(base) ? Date.now() : base;
  return new Date(timestamp + days * 86400000).toISOString().slice(0, 10);
}

const activeReservationStatuses: ReservationStatus[] = ["pending", "confirmed", "checked-in"];

function searchTokens(query: string) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function rankFields(query: string, fields: string[]) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return 999;
  const normalizedFields = fields.map((field) => field.toLowerCase()).filter(Boolean);
  if (normalizedFields.some((field) => field === normalizedQuery)) return 0;
  if (normalizedFields.some((field) => field.startsWith(normalizedQuery))) return 1;
  if (normalizedFields.some((field) => field.includes(normalizedQuery))) return 2;

  const tokens = searchTokens(normalizedQuery);
  const combined = normalizedFields.join(" ");
  if (tokens.length > 0 && tokens.every((token) => combined.includes(token))) return 3;
  return 999;
}

function rankedTake<T>(rows: T[], query: string, limit: number, fieldsFor: (row: T) => string[]) {
  return rows
    .map((row, index) => ({ row, index, rank: rankFields(query, fieldsFor(row)) }))
    .filter((candidate) => candidate.rank < 999)
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .slice(0, limit)
    .map((candidate) => candidate.row);
}

function maskReservationForHousekeeping(reservation: ReservationSummary): ReservationSummary {
  return {
    ...reservation,
    guestName: "",
    guestPhone: "",
    notes: "",
  };
}

async function audit(
  hotelId: string,
  session: Pick<HostedSession, "userId" | "role">,
  action: string,
  entityType: string,
  entityId: string,
  beforeValues: unknown = null,
  afterValues: unknown = null,
) {
  const sql = getSql();
  await sql`
    INSERT INTO audit_logs (id, hotel_id, actor_clerk_user_id, actor_role, action, entity_type, entity_id, before_values, after_values)
    VALUES (${createId("audit")}, ${hotelId}, ${session.userId}, ${session.role}, ${action}, ${entityType}, ${entityId}, ${JSON.stringify(beforeValues)}, ${JSON.stringify(afterValues)})
  `;
}

type RoomRow = Room;
type ReservationRow = ReservationSummary;
type MaintenanceRow = MaintenanceTicket;
type BookingRow = BookingRequest;
type HkRow = HousekeepingTask;
type StaffRow = StaffMember;
type AuditRow = AuditLogEntry;
type HotelRow = Hotel;
type GuestRow = Guest;

function dateOnly(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value.includes("T") ? value.slice(0, 10) : value;
  if (typeof value === "number") return new Date(value).toISOString().slice(0, 10);
  return "";
}

function dateTime(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if (typeof value === "number") return new Date(value).toISOString();
  return "";
}

function normalizeGuest(row: GuestRow): Guest {
  return { ...row, createdAt: dateTime(row.createdAt) };
}

function normalizeReservation(row: ReservationRow): ReservationSummary {
  return { ...row, checkIn: dateOnly(row.checkIn), checkOut: dateOnly(row.checkOut) };
}

function normalizeMaintenance(row: MaintenanceRow): MaintenanceTicket {
  return { ...row, dueDate: dateOnly(row.dueDate) };
}

function normalizeBookingRequest(row: BookingRow): BookingRequest {
  return { ...row, checkIn: dateOnly(row.checkIn), checkOut: dateOnly(row.checkOut) };
}

function normalizeHousekeeping(row: HkRow): HousekeepingTask {
  return { ...row, dueDate: dateOnly(row.dueDate), updatedAt: dateTime(row.updatedAt) };
}

function normalizeAudit(row: AuditRow): AuditLogEntry {
  return { ...row, createdAt: dateTime(row.createdAt) };
}

async function queryRooms(hotelId: string) {
  const sql = getSql();
  return sql<RoomRow[]>`
    SELECT id, number, room_type AS "roomType", floor, capacity, nightly_rate_cents AS "nightlyRateCents", status
    FROM rooms
    WHERE hotel_id = ${hotelId}
    ORDER BY floor, number
  `;
}

async function queryGuests(hotelId: string, whereSql = "", values: string[] = []) {
  const sql = getSql();
  const rows = await sql.query(
    `
      SELECT id, full_name AS "fullName", email, phone, notes, created_at AS "createdAt"
      FROM guests
      WHERE hotel_id = $1 ${whereSql}
      ORDER BY full_name ASC
    `,
    [hotelId, ...values],
  );
  return (rows as unknown as GuestRow[]).map(normalizeGuest);
}

async function queryReservations(hotelId: string, whereSql: string, values: string[] = []) {
  const sql = getSql();
  const params = [hotelId, ...values];
  const rows = await sql.query(
    `
      SELECT
        r.id,
        r.guest_id AS "guestId",
        g.full_name AS "guestName",
        g.phone AS "guestPhone",
        r.room_id AS "roomId",
        rm.number AS "roomNumber",
        rm.room_type AS "roomType",
        r.check_in AS "checkIn",
        r.check_out AS "checkOut",
        r.adults,
        r.children,
        r.nightly_rate_cents AS "nightlyRateCents",
        r.total_cents AS "totalCents",
        r.source,
        r.status,
        r.notes
      FROM reservations r
      JOIN guests g ON g.id = r.guest_id AND g.hotel_id = r.hotel_id
      JOIN rooms rm ON rm.id = r.room_id AND rm.hotel_id = r.hotel_id
      WHERE r.hotel_id = $1 ${whereSql}
      ORDER BY r.check_in ASC, rm.number ASC
    `,
    params,
  );
  return (rows as unknown as ReservationRow[]).map(normalizeReservation);
}

async function queryMaintenance(hotelId: string, whereSql = "AND mt.status NOT IN ('resolved', 'cancelled')", values: unknown[] = []) {
  const sql = getSql();
  const rows = await sql.query(
    `
      SELECT mt.id, mt.room_id AS "roomId", rm.number AS "roomNumber", mt.title, mt.priority, mt.status, mt.due_date AS "dueDate"
      FROM maintenance_tickets mt
      JOIN rooms rm ON rm.id = mt.room_id AND rm.hotel_id = mt.hotel_id
      WHERE mt.hotel_id = $1 ${whereSql}
      ORDER BY mt.due_date ASC, rm.number ASC
    `,
    [hotelId, ...values],
  );
  return (rows as unknown as MaintenanceRow[]).map(normalizeMaintenance);
}

function isInactiveMaintenanceStatus(status: MaintenanceInput["status"]) {
  return status === "resolved" || status === "cancelled";
}

async function markRoomInMaintenance(hotelId: string, session: HostedSession, roomId: string, now: string) {
  const sql = getSql();
  const rows = await sql<{ id: string }[]>`
    UPDATE rooms SET status = 'maintenance', updated_at = ${now}
    WHERE id = ${roomId} AND hotel_id = ${hotelId} AND status <> 'maintenance'
    RETURNING id
  `;
  if (rows[0]) {
    await audit(hotelId, session, "room.status.auto", "room", roomId, null, { status: "maintenance" });
  }
}

async function releaseRoomFromMaintenanceIfClear(hotelId: string, session: HostedSession, roomId: string, now: string) {
  const sql = getSql();
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*) AS count
    FROM maintenance_tickets
    WHERE hotel_id = ${hotelId} AND room_id = ${roomId} AND status NOT IN ('resolved', 'cancelled')
  `;
  if (Number(rows[0]?.count ?? 0) > 0) return;

  const updated = await sql<{ id: string }[]>`
    UPDATE rooms SET status = 'dirty', updated_at = ${now}
    WHERE id = ${roomId} AND hotel_id = ${hotelId} AND status = 'maintenance'
    RETURNING id
  `;
  if (updated[0]) {
    await audit(hotelId, session, "room.status.auto", "room", roomId, null, { status: "dirty", reason: "maintenance-cleared" });
  }
}

async function reconcileMaintenanceRoomState(hotelId: string, session: HostedSession, roomId: string, status: MaintenanceInput["status"], now: string) {
  if (isInactiveMaintenanceStatus(status)) {
    await releaseRoomFromMaintenanceIfClear(hotelId, session, roomId, now);
    return;
  }
  await markRoomInMaintenance(hotelId, session, roomId, now);
}

async function queryHousekeeping(hotelId: string, whereSql = "AND ht.status NOT IN ('ready', 'blocked')", values: string[] = []) {
  const sql = getSql();
  const rows = await sql.query(
    `
      SELECT
        ht.id,
        ht.room_id AS "roomId",
        rm.number AS "roomNumber",
        ht.title,
        ht.status,
        ht.due_date AS "dueDate",
        ht.notes,
        ht.assignee_staff_id AS "assigneeStaffId",
        s.full_name AS "assigneeName",
        ht.updated_at AS "updatedAt"
      FROM housekeeping_tasks ht
      JOIN rooms rm ON rm.id = ht.room_id AND rm.hotel_id = ht.hotel_id
      LEFT JOIN staff s ON s.id = ht.assignee_staff_id AND s.hotel_id = ht.hotel_id
      WHERE ht.hotel_id = $1 ${whereSql}
      ORDER BY ht.due_date ASC, rm.number ASC
    `,
    [hotelId, ...values],
  );
  return (rows as unknown as HkRow[]).map(normalizeHousekeeping);
}

async function queryBookingRequests(hotelId: string) {
  const sql = getSql();
  const rows = await sql<BookingRow[]>`
    SELECT id, full_name AS "fullName", phone, email, check_in AS "checkIn", check_out AS "checkOut", requested_room_type AS "requestedRoomType", status, message
    FROM booking_requests
    WHERE hotel_id = ${hotelId} AND status IN ('new', 'contacted')
    ORDER BY created_at ASC
  `;
  return rows.map(normalizeBookingRequest);
}

async function queryStaff(hotelId: string, role = "housekeeping") {
  const sql = getSql();
  return sql<StaffRow[]>`
    SELECT id, full_name AS "fullName", role, active
    FROM staff
    WHERE hotel_id = ${hotelId} AND role = ${role} AND active = true
    ORDER BY full_name ASC
  `;
}

export async function assertHousekeeperPreviewStaff(hotelId: string, staffId: string) {
  if (isDemoMode()) return;
  const sql = getSql();
  const rows = await sql<StaffRow[]>`
    SELECT id, full_name AS "fullName", role, active
    FROM staff
    WHERE id = ${staffId} AND hotel_id = ${hotelId} AND role = 'housekeeping' AND active = true
    LIMIT 1
  `;
  if (!rows[0]) throw notFound("Housekeeper was not found for this hotel.");
}

async function queryAudit(hotelId: string, limit = 12) {
  const sql = getSql();
  const rows = await sql<AuditRow[]>`
    SELECT id, actor_role AS "actorRole", action, entity_type AS "entityType", entity_id AS "entityId", created_at AS "createdAt"
    FROM audit_logs
    WHERE hotel_id = ${hotelId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(normalizeAudit);
}

async function countNumber(sqlText: string, params: string[]) {
  const sql = getSql();
  const rows = await sql.query(sqlText, params);
  const first = rows[0] as { count?: string | number } | undefined;
  return Number(first?.count ?? 0);
}

async function managerStats(hotelId: string, today = todayString()): Promise<ManagerStats & { roomsTotal: number }> {
  const [roomsTotal, arrivalsToday, departuresToday, inHouse, pendingRequests, dirtyRooms, openMaintenance, revenueRows] = await Promise.all([
    countNumber("SELECT COUNT(*) AS count FROM rooms WHERE hotel_id = $1", [hotelId]),
    countNumber("SELECT COUNT(*) AS count FROM reservations WHERE hotel_id = $1 AND check_in = $2 AND status IN ('pending', 'confirmed')", [hotelId, today]),
    countNumber("SELECT COUNT(*) AS count FROM reservations WHERE hotel_id = $1 AND check_out = $2 AND status = 'checked-in'", [hotelId, today]),
    countNumber("SELECT COUNT(*) AS count FROM reservations WHERE hotel_id = $1 AND status = 'checked-in'", [hotelId]),
    countNumber("SELECT COUNT(*) AS count FROM booking_requests WHERE hotel_id = $1 AND status IN ('new', 'contacted')", [hotelId]),
    countNumber("SELECT COUNT(*) AS count FROM rooms WHERE hotel_id = $1 AND status IN ('dirty', 'cleaning')", [hotelId]),
    countNumber("SELECT COUNT(*) AS count FROM maintenance_tickets WHERE hotel_id = $1 AND status NOT IN ('resolved', 'cancelled')", [hotelId]),
    getSql().query("SELECT COALESCE(SUM(total_cents), 0) AS total FROM reservations WHERE hotel_id = $1 AND check_in <= $2 AND check_out >= $2 AND status IN ('checked-in', 'checked-out', 'confirmed')", [hotelId, today]),
  ]);
  const revenueCents = Number((revenueRows[0] as { total?: string | number } | undefined)?.total ?? 0);
  return {
    occupancyPercent: roomsTotal === 0 ? 0 : Math.round((inHouse / roomsTotal) * 100),
    arrivalsToday,
    departuresToday,
    inHouse,
    pendingRequests,
    dirtyRooms,
    openMaintenance,
    revenueCents,
    roomsTotal,
  };
}

export async function getHotel(hotelId: string): Promise<Hotel> {
  if (isDemoMode()) return demoGetHotel(hotelId);
  const sql = getSql();
  const hotels = await sql<Hotel[]>`
    SELECT id, organization_id AS "organizationId", name, city, state, timezone, active
    FROM hotels WHERE id = ${hotelId} LIMIT 1
  `;
  const hotel = hotels[0];
  if (!hotel) throw notFound("Hotel was not found.");
  return hotel;
}

export async function loadTodayDesk(hotelId: string): Promise<TodayDeskPayload> {
  if (isDemoMode()) return demoLoadTodayDesk(hotelId);
  const today = todayString();
  const stats = await managerStats(hotelId, today);
  const [rooms, arrivals, departures, inHouse, bookingRequests, housekeepingTasks, maintenanceTickets] = await Promise.all([
    queryRooms(hotelId),
    queryReservations(hotelId, "AND r.check_in = $2 AND r.status IN ('pending', 'confirmed')", [today]),
    queryReservations(hotelId, "AND r.check_out = $2 AND r.status = 'checked-in'", [today]),
    queryReservations(hotelId, "AND r.status = 'checked-in'"),
    queryBookingRequests(hotelId),
    queryHousekeeping(hotelId),
    queryMaintenance(hotelId),
  ]);
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
    arrivals,
    departures,
    inHouse,
    bookingRequests,
    housekeepingTasks,
    maintenanceTickets,
  };
}

export async function loadFrontDeskReservations(hotelId: string, rangeStart: string, rangeEnd: string): Promise<FrontDeskReservationsPayload> {
  if (isDemoMode()) return demoLoadFrontDeskReservations(hotelId, rangeStart, rangeEnd);
  const [rooms, reservations] = await Promise.all([
    queryRooms(hotelId),
    queryReservations(
      hotelId,
      "AND r.status IN ('pending', 'confirmed', 'checked-in') AND r.check_in < $2 AND r.check_out > $3",
      [rangeEnd, rangeStart],
    ),
  ]);
  return {
    today: todayString(),
    rangeStart,
    rangeEnd,
    rooms,
    reservations: reservations.filter((reservation) => activeReservationStatuses.includes(reservation.status)),
  };
}

export async function loadReservationDetail(hotelId: string, reservationId: string): Promise<ReservationSummary> {
  if (isDemoMode()) return demoLoadReservationDetail(hotelId, reservationId);
  const reservation = (await queryReservations(hotelId, "AND r.id = $2", [reservationId]))[0];
  if (!reservation) throw notFound("Reservation was not found for this hotel.");
  return reservation;
}

export async function loadManagerDashboard(hotelId: string): Promise<ManagerDashboardPayload> {
  if (isDemoMode()) return demoLoadManagerDashboard(hotelId);
  const today = todayString();
  const next14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const sql = getSql();
  const [stats, roomStatusCounts, demandByRoomType, bookingSourceMix, upcoming, maintenance, recentAudit] = await Promise.all([
    managerStats(hotelId, today),
    sql<CountRow[]>`SELECT status AS label, COUNT(*)::int AS count FROM rooms WHERE hotel_id = ${hotelId} GROUP BY status ORDER BY status`,
    sql<CountRow[]>`SELECT rm.room_type AS label, COUNT(*)::int AS count FROM reservations r JOIN rooms rm ON rm.id = r.room_id AND rm.hotel_id = r.hotel_id WHERE r.hotel_id = ${hotelId} GROUP BY rm.room_type ORDER BY count DESC`,
    sql<CountRow[]>`SELECT source AS label, COUNT(*)::int AS count FROM reservations WHERE hotel_id = ${hotelId} GROUP BY source ORDER BY count DESC`,
    queryReservations(hotelId, "AND r.check_in >= $2 AND r.check_in <= $3 AND r.status IN ('pending', 'confirmed')", [today, next14]),
    queryMaintenance(hotelId),
    queryAudit(hotelId),
  ]);
  return { today, stats, roomStatusCounts, demandByRoomType, bookingSourceMix, upcoming, maintenance, recentAudit };
}

export async function loadPortfolio(session: HostedSession): Promise<PortfolioDashboardPayload> {
  if (isDemoMode()) return demoLoadPortfolio(session);
  const sql = getSql();
  const hotels = await sql<(HotelRow & { role: AppRole })[]>`
    SELECT h.id, h.organization_id AS "organizationId", h.name, h.city, h.state, h.timezone, h.active, hm.role
    FROM hotels h
    JOIN hotel_memberships hm ON hm.hotel_id = h.id
    WHERE hm.clerk_user_id = ${session.userId} AND hm.active = true AND h.active = true
    ORDER BY h.name ASC
  `;
  const summaries = await Promise.all(
    hotels.map(async ({ role, ...hotel }) => ({ hotel, role, stats: await managerStats(hotel.id), roomsTotal: (await managerStats(hotel.id)).roomsTotal })),
  );
  const totals = summaries.reduce(
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
  return { session, hotels: summaries, totals };
}

export async function searchFrontDesk(hotelId: string, query: string, limit = 25): Promise<SearchResults> {
  if (isDemoMode()) return demoSearchFrontDesk(hotelId, query, limit);
  const trimmed = query.trim();
  if (!trimmed) return { guests: [], reservations: [], rooms: [] };
  const rowLimit = normalizeSearchLimit(limit);
  const tokens = searchTokens(trimmed);
  const likeParams = [`%${trimmed.toLowerCase()}%`, ...tokens.map((token) => `%${token}%`)];
  const limitParam = likeParams.length + 2;
  const conditionFor = (expression: string) => {
    const tokenClauses = tokens.map((_, index) => `${expression} LIKE $${index + 3}`);
    return tokenClauses.length > 0 ? `(${expression} LIKE $2 OR (${tokenClauses.join(" AND ")}))` : `${expression} LIKE $2`;
  };
  const sql = getSql();
  const [guests, rooms, reservations] = await Promise.all([
    sql.query(
      `
        SELECT id, full_name AS "fullName", email, phone, notes, created_at AS "createdAt"
        FROM guests
        WHERE hotel_id = $1 AND ${conditionFor("lower(concat_ws(' ', full_name, email, phone, notes))")}
        ORDER BY full_name ASC
        LIMIT $${limitParam}
      `,
      [hotelId, ...likeParams, rowLimit],
    ),
    sql.query(
      `
        SELECT id, number, room_type AS "roomType", floor, capacity, nightly_rate_cents AS "nightlyRateCents", status
        FROM rooms
        WHERE hotel_id = $1 AND ${conditionFor("lower(concat_ws(' ', number, room_type, status, floor::text, capacity::text))")}
        ORDER BY number ASC
        LIMIT $${limitParam}
      `,
      [hotelId, ...likeParams, rowLimit],
    ),
    sql.query(
      `
        SELECT
          r.id,
          r.guest_id AS "guestId",
          g.full_name AS "guestName",
          g.phone AS "guestPhone",
          r.room_id AS "roomId",
          rm.number AS "roomNumber",
          rm.room_type AS "roomType",
          r.check_in AS "checkIn",
          r.check_out AS "checkOut",
          r.adults,
          r.children,
          r.nightly_rate_cents AS "nightlyRateCents",
          r.total_cents AS "totalCents",
          r.source,
          r.status,
          r.notes
        FROM reservations r
        JOIN guests g ON g.id = r.guest_id AND g.hotel_id = r.hotel_id
        JOIN rooms rm ON rm.id = r.room_id AND rm.hotel_id = r.hotel_id
        WHERE r.hotel_id = $1 AND ${conditionFor("lower(concat_ws(' ', r.id, g.full_name, g.phone, g.email, rm.number, rm.room_type, r.check_in, r.check_out, r.status, r.source, r.notes))")}
        ORDER BY r.check_in DESC
        LIMIT $${limitParam}
      `,
      [hotelId, ...likeParams, rowLimit],
    ),
  ]);
  const guestRows = (guests as unknown as GuestRow[]).map(normalizeGuest);
  const roomRows = rooms as unknown as Room[];
  const reservationRows = (reservations as unknown as ReservationRow[]).map(normalizeReservation);
  return {
    guests: rankedTake(guestRows, trimmed, rowLimit, (guest) => [guest.id, guest.fullName, guest.email, guest.phone, guest.notes]),
    rooms: rankedTake(roomRows, trimmed, rowLimit, (room) => [room.id, room.number, room.roomType, room.status, String(room.floor), String(room.capacity)]),
    reservations: rankedTake(reservationRows, trimmed, rowLimit, (reservation) => [
      reservation.id,
      reservation.guestName,
      reservation.guestPhone,
      reservation.roomNumber,
      reservation.roomType,
      reservation.checkIn,
      reservation.checkOut,
      reservation.status,
      reservation.source,
      reservation.notes,
    ]),
  };
}

export async function saveGuest(hotelId: string, session: HostedSession, input: GuestInput): Promise<Guest> {
  if (isDemoMode()) return demoSaveGuest(hotelId, session, input);
  const sql = getSql();
  const now = new Date().toISOString();
  const id = input.id?.trim();
  if (id) {
    const updated = await sql<{ id: string }[]>`
      UPDATE guests
      SET full_name = ${input.fullName}, email = ${input.email}, phone = ${input.phone}, notes = ${input.notes}, updated_at = ${now}
      WHERE id = ${id} AND hotel_id = ${hotelId}
      RETURNING id
    `;
    if (!updated[0]) {
      throw notFound("Guest was not found for this hotel.");
    }
    await audit(hotelId, session, "guest.update", "guest", id, null, { fullName: input.fullName });
    const guest = (await queryGuests(hotelId, "AND id = $2", [id]))[0];
    if (!guest) throw notFound("Guest was not found after saving.");
    return guest;
  }
  const newId = createId("guest");
  await sql`
    INSERT INTO guests (id, hotel_id, full_name, email, phone, notes, created_at, updated_at)
    VALUES (${newId}, ${hotelId}, ${input.fullName}, ${input.email}, ${input.phone}, ${input.notes}, ${now}, ${now})
  `;
  await audit(hotelId, session, "guest.create", "guest", newId, null, { fullName: input.fullName });
  const guest = (await queryGuests(hotelId, "AND id = $2", [newId]))[0];
  if (!guest) throw notFound("Guest was not found after saving.");
  return guest;
}

export async function saveRoomStatus(hotelId: string, session: HostedSession, roomId: string, status: RoomStatus) {
  if (isDemoMode()) return demoSaveRoomStatus(hotelId, session, roomId, status);
  const sql = getSql();
  const rows = await sql<{ id: string; status: RoomStatus; number: string }[]>`
    SELECT id, status, number FROM rooms WHERE id = ${roomId} AND hotel_id = ${hotelId} LIMIT 1
  `;
  const room = rows[0];
  if (!room) throw notFound("Room was not found for this hotel.");
  if (session.role === "housekeeping" && ["occupied", "maintenance"].includes(room.status)) {
    throw badRequest("Housekeeping cannot change occupied or maintenance rooms.");
  }
  if (session.role === "housekeeping" && status === "ready") {
    throw badRequest("Ready status requires supervisor approval.");
  }
  const now = new Date().toISOString();
  await sql`UPDATE rooms SET status = ${status}, updated_at = ${now} WHERE id = ${roomId} AND hotel_id = ${hotelId}`;
  if (["dirty", "cleaning", "ready"].includes(status)) {
    const existing = await sql<{ id: string }[]>`
      SELECT id FROM housekeeping_tasks WHERE hotel_id = ${hotelId} AND room_id = ${roomId} AND status NOT IN ('ready', 'blocked') ORDER BY created_at DESC LIMIT 1
    `;
    const taskId = existing[0]?.id ?? createId("hk");
    if (existing[0]) {
      await sql`UPDATE housekeeping_tasks SET status = ${status}, updated_at = ${now} WHERE id = ${taskId} AND hotel_id = ${hotelId}`;
    } else {
      await sql`
        INSERT INTO housekeeping_tasks (id, hotel_id, room_id, title, status, due_date, notes, created_at, updated_at)
        VALUES (${taskId}, ${hotelId}, ${roomId}, ${`Room ${room.number} readiness`}, ${status}, ${todayString()}, '', ${now}, ${now})
      `;
    }
  }
  await audit(hotelId, session, "room.status.update", "room", roomId, { status: room.status }, { status });
}

export async function saveHousekeepingTask(hotelId: string, session: HostedSession, input: HousekeepingInput) {
  if (isDemoMode()) return demoSaveHousekeepingTask(hotelId, session, input);
  const sql = getSql();
  const roomRows = await sql<{ number: string }[]>`SELECT number FROM rooms WHERE id = ${input.roomId} AND hotel_id = ${hotelId} LIMIT 1`;
  if (!roomRows[0]) throw notFound("Room was not found for this hotel.");
  const now = new Date().toISOString();
  const id = createId("hk");
  await sql`
    INSERT INTO housekeeping_tasks (id, hotel_id, room_id, title, status, due_date, notes, created_at, updated_at)
    VALUES (${id}, ${hotelId}, ${input.roomId}, ${input.title}, ${input.status}, ${input.dueDate}, '', ${now}, ${now})
  `;
  if (["dirty", "cleaning", "ready"].includes(input.status)) {
    await sql`UPDATE rooms SET status = ${input.status}, updated_at = ${now} WHERE id = ${input.roomId} AND hotel_id = ${hotelId}`;
  }
  await audit(hotelId, session, "housekeeping.create", "housekeeping_task", id, null, input);
  return { id };
}

export async function createWalkInReservation(hotelId: string, session: HostedSession, input: WalkInInput) {
  if (isDemoMode()) return demoCreateWalkInReservation(hotelId, session, input);
  const sql = getSql();
  const roomRows = await sql<{ id: string; status: string }[]>`
    SELECT id, status FROM rooms WHERE id = ${input.roomId} AND hotel_id = ${hotelId} LIMIT 1
  `;
  const room = roomRows[0];
  if (!room) throw notFound("Room was not found for this hotel.");
  if (["occupied", "maintenance"].includes(room.status)) throw badRequest("Room is not available for a walk-in.");

  const now = new Date().toISOString();
  const suppliedGuestId = input.guestId?.trim();
  const reservationId = createId("res");
  const totalCents = nightsBetween(input.checkIn, input.checkOut) * input.nightlyRateCents;
  const guestId = suppliedGuestId || createId("guest");

  if (suppliedGuestId) {
    const rows = await sql<{ id: string }[]>`
      UPDATE guests SET full_name = ${input.fullName}, email = ${input.email}, phone = ${input.phone}, notes = ${input.guestNotes}, updated_at = ${now}
      WHERE id = ${suppliedGuestId} AND hotel_id = ${hotelId}
      RETURNING id
    `;
    if (!rows[0]) throw notFound("Guest was not found for this hotel.");
  } else {
    await sql`
      INSERT INTO guests (id, hotel_id, full_name, email, phone, notes, created_at, updated_at)
      VALUES (${guestId}, ${hotelId}, ${input.fullName}, ${input.email}, ${input.phone}, ${input.guestNotes}, ${now}, ${now})
    `;
  }

  await sql`
    INSERT INTO reservations (id, hotel_id, guest_id, room_id, check_in, check_out, adults, children, nightly_rate_cents, total_cents, source, status, notes, created_at, updated_at)
    VALUES (${reservationId}, ${hotelId}, ${guestId}, ${input.roomId}, ${input.checkIn}, ${input.checkOut}, ${input.adults}, ${input.children}, ${input.nightlyRateCents}, ${totalCents}, 'walk-in', 'checked-in', ${input.notes}, ${now}, ${now})
  `;
  await sql`UPDATE rooms SET status = 'occupied', updated_at = ${now} WHERE id = ${input.roomId} AND hotel_id = ${hotelId}`;
  await audit(hotelId, session, "reservation.walk-in", "reservation", reservationId, null, { guestId, roomId: input.roomId, totalCents });
  return { id: reservationId };
}

export async function updateReservationStatus(hotelId: string, session: HostedSession, reservationId: string, status: ReservationStatus) {
  if (isDemoMode()) return demoUpdateReservationStatus(hotelId, session, reservationId, status);
  const sql = getSql();
  const rows = await sql<{ id: string; roomId: string; status: ReservationStatus }[]>`
    SELECT id, room_id AS "roomId", status FROM reservations WHERE id = ${reservationId} AND hotel_id = ${hotelId} LIMIT 1
  `;
  const current = rows[0];
  if (!current) throw notFound("Reservation was not found for this hotel.");
  if (!isReservationTransitionAllowed(current.status, status)) {
    throw badRequest(`Cannot change reservation from "${current.status}" to "${status}".`);
  }
  if (current.status === status) return;
  const now = new Date().toISOString();
  await sql`UPDATE reservations SET status = ${status}, updated_at = ${now} WHERE id = ${reservationId} AND hotel_id = ${hotelId}`;
  if (status === "checked-in") {
    await sql`UPDATE rooms SET status = 'occupied', updated_at = ${now} WHERE id = ${current.roomId} AND hotel_id = ${hotelId}`;
  }
  if (status === "checked-out") {
    await sql`UPDATE rooms SET status = 'dirty', updated_at = ${now} WHERE id = ${current.roomId} AND hotel_id = ${hotelId}`;
    await sql`
      INSERT INTO housekeeping_tasks (id, hotel_id, room_id, title, status, due_date, notes, created_at, updated_at)
      VALUES (${createId("hk")}, ${hotelId}, ${current.roomId}, 'Turn room after checkout', 'dirty', ${todayString()}, '', ${now}, ${now})
    `;
  }
  await audit(hotelId, session, "reservation.status", "reservation", reservationId, { status: current.status }, { status });
}

export async function assignHousekeepingTask(hotelId: string, session: HostedSession, roomId: string, staffId: string) {
  if (isDemoMode()) return demoAssignHousekeepingTask(hotelId, session, roomId, staffId);
  const sql = getSql();
  const staffRows = await sql<{ fullName: string }[]>`
    SELECT full_name AS "fullName" FROM staff WHERE id = ${staffId} AND hotel_id = ${hotelId} AND role = 'housekeeping' AND active = true LIMIT 1
  `;
  if (!staffRows[0]) throw notFound("Housekeeper was not found for this hotel.");
  const roomRows = await sql<{ id: string; number: string; status: string }[]>`
    SELECT id, number, status FROM rooms WHERE id = ${roomId} AND hotel_id = ${hotelId} LIMIT 1
  `;
  const room = roomRows[0];
  if (!room) throw notFound("Room was not found for this hotel.");
  if (["occupied", "maintenance"].includes(room.status)) throw badRequest("Occupied or maintenance rooms cannot be assigned.");

  const now = new Date().toISOString();
  const existing = await sql<{ id: string }[]>`
    SELECT id FROM housekeeping_tasks WHERE hotel_id = ${hotelId} AND room_id = ${roomId} AND status NOT IN ('ready', 'blocked') ORDER BY created_at DESC LIMIT 1
  `;
  const taskId = existing[0]?.id ?? createId("hk");
  if (existing[0]) {
    await sql`UPDATE housekeeping_tasks SET assignee_staff_id = ${staffId}, status = 'dirty', updated_at = ${now} WHERE id = ${taskId} AND hotel_id = ${hotelId}`;
  } else {
    await sql`
      INSERT INTO housekeeping_tasks (id, hotel_id, room_id, assignee_staff_id, title, status, due_date, notes, created_at, updated_at)
      VALUES (${taskId}, ${hotelId}, ${roomId}, ${staffId}, ${`Clean room ${room.number}`}, 'dirty', ${todayString()}, '', ${now}, ${now})
    `;
  }
  await sql`UPDATE rooms SET status = 'dirty', updated_at = ${now} WHERE id = ${roomId} AND hotel_id = ${hotelId}`;
  await audit(hotelId, session, "housekeeping.assign", "housekeeping_task", taskId, null, { roomId, staffId });
  return { id: taskId };
}

function housekeepingStaffScope(session: HostedSession) {
  return session.role === "housekeeping" ? (session.previewStaffId ?? session.userId) : undefined;
}

async function housekeepingTaskForRoom(hotelId: string, roomId: string, staffScopeId?: string) {
  const sql = getSql();
  const staffFilter = staffScopeId ? "AND (s.clerk_user_id = $3 OR ht.assignee_staff_id = $3)" : "";
  const params = staffScopeId ? [hotelId, roomId, staffScopeId] : [hotelId, roomId];
  const rows = await sql.query(
    `
      SELECT ht.id, ht.status, ht.room_id AS "roomId", ht.assignee_staff_id AS "assigneeStaffId"
      FROM housekeeping_tasks ht
      LEFT JOIN staff s ON s.id = ht.assignee_staff_id AND s.hotel_id = ht.hotel_id
      WHERE ht.hotel_id = $1 AND ht.room_id = $2 AND ht.status NOT IN ('ready', 'blocked') ${staffFilter}
      ORDER BY ht.created_at DESC
      LIMIT 1
    `,
    params,
  );
  const task = rows[0] as { id: string; status: string; roomId: string; assigneeStaffId: string | null } | undefined;
  if (!task) throw notFound("Housekeeping task was not found.");
  return task;
}

export async function startHousekeepingRoom(hotelId: string, session: HostedSession, roomId: string) {
  if (isDemoMode()) return demoStartHousekeepingRoom(hotelId, session, roomId);
  const task = await housekeepingTaskForRoom(hotelId, roomId, housekeepingStaffScope(session));
  if (!isHousekeepingActionAllowed(task.status, "start")) {
    throw badRequest(`Cannot start housekeeping when task is "${task.status}".`);
  }
  const now = new Date().toISOString();
  const sql = getSql();
  await sql`UPDATE housekeeping_tasks SET status = 'cleaning', updated_at = ${now} WHERE id = ${task.id} AND hotel_id = ${hotelId}`;
  await sql`UPDATE rooms SET status = 'cleaning', updated_at = ${now} WHERE id = ${roomId} AND hotel_id = ${hotelId}`;
  await audit(hotelId, session, "housekeeping.start", "housekeeping_task", task.id, { status: task.status }, { status: "cleaning", roomId });
}

export async function finishHousekeepingRoom(hotelId: string, session: HostedSession, roomId: string) {
  if (isDemoMode()) return demoFinishHousekeepingRoom(hotelId, session, roomId);
  const task = await housekeepingTaskForRoom(hotelId, roomId, housekeepingStaffScope(session));
  if (!isHousekeepingActionAllowed(task.status, "finish")) {
    throw badRequest(`Cannot finish housekeeping when task is "${task.status}".`);
  }
  const now = new Date().toISOString();
  const sql = getSql();
  await sql`UPDATE housekeeping_tasks SET status = 'inspection', updated_at = ${now} WHERE id = ${task.id} AND hotel_id = ${hotelId}`;
  await audit(hotelId, session, "housekeeping.finish", "housekeeping_task", task.id, { status: task.status }, { status: "inspection", roomId });
}

export async function approveHousekeepingRoom(hotelId: string, session: HostedSession, roomId: string) {
  if (isDemoMode()) return demoApproveHousekeepingRoom(hotelId, session, roomId);
  const task = await housekeepingTaskForRoom(hotelId, roomId);
  if (!isHousekeepingActionAllowed(task.status, "approve")) {
    throw badRequest(`Cannot approve housekeeping when task is "${task.status}".`);
  }
  const now = new Date().toISOString();
  const sql = getSql();
  await sql`UPDATE housekeeping_tasks SET status = 'ready', notes = '', updated_at = ${now} WHERE id = ${task.id} AND hotel_id = ${hotelId}`;
  await sql`UPDATE rooms SET status = 'ready', updated_at = ${now} WHERE id = ${roomId} AND hotel_id = ${hotelId}`;
  await audit(hotelId, session, "housekeeping.approve", "housekeeping_task", task.id, { status: task.status }, { status: "ready", roomId });
}

export async function sendBackHousekeepingRoom(hotelId: string, session: HostedSession, roomId: string, reason: string) {
  if (isDemoMode()) return demoSendBackHousekeepingRoom(hotelId, session, roomId, reason);
  const task = await housekeepingTaskForRoom(hotelId, roomId);
  if (!isHousekeepingActionAllowed(task.status, "send-back")) {
    throw badRequest(`Cannot send back housekeeping when task is "${task.status}".`);
  }
  const now = new Date().toISOString();
  const sql = getSql();
  await sql`UPDATE housekeeping_tasks SET status = 'dirty', notes = ${reason}, updated_at = ${now} WHERE id = ${task.id} AND hotel_id = ${hotelId}`;
  await sql`UPDATE rooms SET status = 'dirty', updated_at = ${now} WHERE id = ${roomId} AND hotel_id = ${hotelId}`;
  await audit(hotelId, session, "housekeeping.send-back", "housekeeping_task", task.id, { status: task.status }, { status: "dirty", reason, roomId });
}

export async function createMaintenanceTicket(hotelId: string, session: HostedSession, input: MaintenanceInput) {
  if (isDemoMode()) return demoCreateMaintenanceTicket(hotelId, session, input);
  const sql = getSql();
  const roomRows = await sql<{ id: string }[]>`SELECT id FROM rooms WHERE id = ${input.roomId} AND hotel_id = ${hotelId} LIMIT 1`;
  if (!roomRows[0]) throw notFound("Room was not found for this hotel.");
  const now = new Date().toISOString();
  const id = input.id?.trim() || createId("mt");
  const existingRows = await sql<{ id: string }[]>`SELECT id FROM maintenance_tickets WHERE id = ${id} AND hotel_id = ${hotelId} LIMIT 1`;
  if (existingRows[0]) return updateMaintenanceTicket(hotelId, session, id, input);
  if (!isMaintenanceCreateStatusAllowed(input.status)) {
    throw badRequest("New maintenance tickets can only be created with status open, in-progress, or blocked.");
  }
  await sql`
    INSERT INTO maintenance_tickets (id, hotel_id, room_id, title, priority, status, due_date, created_at, updated_at)
    VALUES (${id}, ${hotelId}, ${input.roomId}, ${input.title}, ${input.priority}, ${input.status}, ${input.dueDate}, ${now}, ${now})
  `;
  if (!isInactiveMaintenanceStatus(input.status)) {
    await markRoomInMaintenance(hotelId, session, input.roomId, now);
  }
  await audit(hotelId, session, "maintenance.create", "maintenance_ticket", id, null, input);
  return { id };
}

export async function updateMaintenanceTicket(hotelId: string, session: HostedSession, ticketId: string, input: MaintenanceInput) {
  if (isDemoMode()) return demoUpdateMaintenanceTicket(hotelId, session, ticketId, input);
  const sql = getSql();
  const ticketRows = await queryMaintenance(hotelId, "AND mt.id = $2", [ticketId]);
  const existing = ticketRows[0];
  if (!existing) throw notFound("Maintenance ticket was not found for this hotel.");
  if (existing.status === "pending-review") {
    throw badRequest("Pending issue reports must be approved or cancelled through the issue review workflow.");
  }
  if (!isMaintenanceTransitionAllowed(existing.status, input.status)) {
    throw badRequest(`Cannot change maintenance status from "${existing.status}" to "${input.status}".`);
  }

  const roomRows = await sql<{ id: string }[]>`SELECT id FROM rooms WHERE id = ${input.roomId} AND hotel_id = ${hotelId} LIMIT 1`;
  if (!roomRows[0]) throw notFound("Room was not found for this hotel.");
  if ((existing.status === "resolved" || existing.status === "cancelled") && input.status === existing.status && existing.roomId !== input.roomId) {
    throw badRequest("Closed maintenance tickets cannot be moved to another room.");
  }

  const now = new Date().toISOString();
  await sql`
    UPDATE maintenance_tickets
    SET room_id = ${input.roomId}, title = ${input.title}, priority = ${input.priority}, status = ${input.status}, due_date = ${input.dueDate}, updated_at = ${now}
    WHERE id = ${ticketId} AND hotel_id = ${hotelId}
  `;

  if (existing.roomId !== input.roomId) {
    await releaseRoomFromMaintenanceIfClear(hotelId, session, existing.roomId, now);
  }
  await reconcileMaintenanceRoomState(hotelId, session, input.roomId, input.status, now);

  const action =
    input.status === "resolved" && existing.status !== "resolved"
      ? "maintenance.resolve"
      : input.status === "cancelled" && existing.status !== "cancelled"
        ? "maintenance.cancel"
        : "maintenance.update";
  await audit(hotelId, session, action, "maintenance_ticket", ticketId, existing, input);
  return (await queryMaintenance(hotelId, "AND mt.id = $2", [ticketId]))[0];
}

export async function reportRoomIssue(hotelId: string, session: HostedSession, input: ReportRoomIssueInput) {
  if (isDemoMode()) return demoReportRoomIssue(hotelId, session, input);
  const sql = getSql();
  const roomRows = await sql<{ id: string; number: string }[]>`SELECT id, number FROM rooms WHERE id = ${input.roomId} AND hotel_id = ${hotelId} LIMIT 1`;
  const room = roomRows[0];
  if (!room) throw notFound("Room was not found for this hotel.");
  const now = new Date().toISOString();
  const id = createId("mt");
  await sql`
    INSERT INTO maintenance_tickets (id, hotel_id, room_id, title, priority, status, due_date, created_at, updated_at)
    VALUES (${id}, ${hotelId}, ${input.roomId}, ${input.title}, 'medium', 'pending-review', ${todayString()}, ${now}, ${now})
  `;
  const taskRows = await sql<{ id: string }[]>`
    SELECT id FROM housekeeping_tasks WHERE hotel_id = ${hotelId} AND room_id = ${input.roomId} AND status NOT IN ('ready', 'blocked') ORDER BY created_at DESC LIMIT 1
  `;
  const task = taskRows[0];
  if (task) {
    await sql`UPDATE housekeeping_tasks SET status = 'blocked', notes = ${input.title}, updated_at = ${now} WHERE id = ${task.id} AND hotel_id = ${hotelId}`;
    await audit(hotelId, session, "housekeeping.issue-hold", "housekeeping_task", task.id, null, { ticketId: id });
  }
  await audit(hotelId, session, "maintenance.report", "maintenance_ticket", id, null, input);
  return {
    id,
    roomId: room.id,
    roomNumber: room.number,
    title: input.title,
    priority: "medium" as const,
    status: "pending-review" as const,
    dueDate: todayString(),
  };
}

export async function approveRoomIssueReport(hotelId: string, session: HostedSession, input: ReviewRoomIssueInput) {
  if (isDemoMode()) return demoApproveRoomIssueReport(hotelId, session, input);
  const sql = getSql();
  const rows = await sql<{ id: string; roomId: string; status: string }[]>`
    SELECT id, room_id AS "roomId", status FROM maintenance_tickets WHERE id = ${input.ticketId} AND hotel_id = ${hotelId} LIMIT 1
  `;
  const ticket = rows[0];
  if (!ticket) throw notFound("Room issue report was not found.");
  if (ticket.status !== "pending-review") throw badRequest("Only pending issue reports can be approved.");
  const now = new Date().toISOString();
  await sql`
    UPDATE maintenance_tickets SET title = ${input.title}, priority = ${input.priority}, status = 'open', updated_at = ${now}
    WHERE id = ${input.ticketId} AND hotel_id = ${hotelId}
  `;
  await sql`UPDATE rooms SET status = 'maintenance', updated_at = ${now} WHERE id = ${ticket.roomId} AND hotel_id = ${hotelId}`;
  await audit(hotelId, session, "maintenance.approve-report", "maintenance_ticket", input.ticketId, null, input);
  await audit(hotelId, session, "room.status.auto", "room", ticket.roomId, null, { status: "maintenance" });
  return (await queryMaintenance(hotelId, "AND mt.id = $2", [input.ticketId]))[0];
}

export async function cancelRoomIssueReport(hotelId: string, session: HostedSession, ticketId: string) {
  if (isDemoMode()) return demoCancelRoomIssueReport(hotelId, session, ticketId);
  const sql = getSql();
  const rows = await sql<{ id: string; roomId: string; status: string }[]>`
    SELECT id, room_id AS "roomId", status FROM maintenance_tickets WHERE id = ${ticketId} AND hotel_id = ${hotelId} LIMIT 1
  `;
  const ticket = rows[0];
  if (!ticket) throw notFound("Room issue report was not found.");
  if (ticket.status !== "pending-review") throw badRequest("Only pending issue reports can be cancelled.");
  const now = new Date().toISOString();
  await sql`UPDATE maintenance_tickets SET status = 'cancelled', updated_at = ${now} WHERE id = ${ticketId} AND hotel_id = ${hotelId}`;
  const taskRows = await sql<{ id: string }[]>`
    SELECT id FROM housekeeping_tasks WHERE hotel_id = ${hotelId} AND room_id = ${ticket.roomId} AND status = 'blocked' ORDER BY created_at DESC LIMIT 1
  `;
  const task = taskRows[0];
  if (task) {
    await sql`UPDATE housekeeping_tasks SET status = 'dirty', updated_at = ${now} WHERE id = ${task.id} AND hotel_id = ${hotelId}`;
    await audit(hotelId, session, "housekeeping.issue-release", "housekeeping_task", task.id, null, { ticketId });
  }
  await audit(hotelId, session, "maintenance.cancel-report", "maintenance_ticket", ticketId, null, { status: "cancelled" });
  return { ...ticket, status: "cancelled" };
}

export async function loadHousekeepingWork(hotelId: string, session: HostedSession) {
  if (isDemoMode()) return demoLoadHousekeepingWork(hotelId, session);
  const today = todayString();
  const staffScopeId = session.previewStaffId ?? session.userId;
  const tasks = await queryHousekeeping(
    hotelId,
    "AND ht.status NOT IN ('ready', 'blocked') AND (s.clerk_user_id = $2 OR ht.assignee_staff_id = $2)",
    [staffScopeId],
  );
  const [rooms, arrivals, departures] = await Promise.all([
    queryRooms(hotelId),
    queryReservations(hotelId, "AND r.check_in = $2 AND r.status IN ('pending', 'confirmed')", [today]),
    queryReservations(hotelId, "AND r.check_out = $2 AND r.status = 'checked-in'", [today]),
  ]);
  const assignedRoomIds = new Set(tasks.map((task) => task.roomId));
  return {
    today,
    rooms: rooms.filter((room) => assignedRoomIds.has(room.id)),
    arrivals: arrivals.filter((reservation) => assignedRoomIds.has(reservation.roomId)).map(maskReservationForHousekeeping),
    departures: departures.filter((reservation) => assignedRoomIds.has(reservation.roomId)).map(maskReservationForHousekeeping),
    housekeepingTasks: tasks,
  };
}

export async function loadHousekeepingSupervisor(hotelId: string) {
  if (isDemoMode()) return demoLoadHousekeepingSupervisor(hotelId);
  const today = todayString();
  const [rooms, arrivals, departures, housekeepingTasks, maintenanceTickets, housekeepers, recentAudit] = await Promise.all([
    queryRooms(hotelId),
    queryReservations(hotelId, "AND r.check_in = $2 AND r.status IN ('pending', 'confirmed')", [today]),
    queryReservations(hotelId, "AND r.check_out = $2 AND r.status = 'checked-in'", [today]),
    queryHousekeeping(hotelId),
    queryMaintenance(hotelId),
    queryStaff(hotelId),
    queryAudit(hotelId),
  ]);
  return { today, rooms, arrivals, departures, housekeepingTasks, maintenanceTickets, housekeepers, recentAudit };
}

export async function exportCsvReport(hotelId: string, report: string) {
  if (isDemoMode()) return demoExportCsvReport(hotelId, report);
  if (!["rooms", "reservations", "maintenance"].includes(report)) throw badRequest("Unknown report type.");
  const sql = getSql();
  if (report === "rooms") {
    const rows = await sql<{ number: string; roomType: string; floor: number; capacity: number; nightlyRateCents: number; status: string }[]>`
      SELECT number, room_type AS "roomType", floor, capacity, nightly_rate_cents AS "nightlyRateCents", status FROM rooms WHERE hotel_id = ${hotelId} ORDER BY number
    `;
    return toCsv(["number", "roomType", "floor", "capacity", "nightlyRateCents", "status"], rows);
  }
  if (report === "maintenance") {
    const rows = await queryMaintenance(hotelId, "");
    return toCsv(["id", "roomNumber", "title", "priority", "status", "dueDate"], rows);
  }
  const rows = await queryReservations(hotelId, "");
  return toCsv(["id", "guestName", "roomNumber", "checkIn", "checkOut", "status", "totalCents", "source"], rows);
}

export async function createBackup(hotelId: string) {
  if (isDemoMode()) return demoCreateBackup(hotelId);
  const [hotel, rooms, guests, reservations, bookingRequests, housekeepingTasks, maintenanceTickets, recentAudit] = await Promise.all([
    getHotel(hotelId),
    queryRooms(hotelId),
    queryGuests(hotelId),
    queryReservations(hotelId, ""),
    queryBookingRequests(hotelId),
    queryHousekeeping(hotelId, ""),
    queryMaintenance(hotelId, ""),
    queryAudit(hotelId, 100),
  ]);
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      hotel,
      rooms,
      guests,
      reservations,
      bookingRequests,
      housekeepingTasks,
      maintenanceTickets,
      auditLogs: recentAudit,
    },
    null,
    2,
  );
}

function toCsv(headers: string[], rows: object[]) {
  const escape = (value: unknown) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape((row as Record<string, unknown>)[header])).join(","))].join("\n");
}

export { allHotelRoles };
