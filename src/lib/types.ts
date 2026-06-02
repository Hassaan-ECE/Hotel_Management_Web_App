export type StaffRole = "manager" | "front-desk" | "housekeeping" | "housekeeping-supervisor" | "maintenance";
export type AppRole = "owner" | StaffRole;
export type ReservationStatus = "pending" | "confirmed" | "checked-in" | "checked-out" | "cancelled";
export type RoomStatus = "available" | "occupied" | "dirty" | "cleaning" | "maintenance" | "ready";
export type MaintenanceStatus = "pending-review" | "open" | "in-progress" | "blocked" | "resolved" | "cancelled";
export type MaintenancePriority = "low" | "medium" | "high" | "critical";
export type BookingRequestStatus = "new" | "contacted" | "accepted" | "declined";

export interface HostedSession {
  userId: string;
  displayName: string;
  organizationId: string;
  activeHotelId?: string;
  role: AppRole;
  actualRole?: AppRole;
  previewRole?: AppRole | null;
  previewStaffId?: string | null;
  rolePreviewEnabled?: boolean;
}

export interface Hotel {
  id: string;
  organizationId: string;
  name: string;
  city: string;
  state: string;
  timezone: string;
  active: boolean;
}

export interface HotelMembership {
  id: string;
  organizationId: string;
  hotelId: string;
  clerkUserId: string;
  displayName: string;
  email: string;
  role: AppRole;
  active: boolean;
}

export interface Room {
  id: string;
  number: string;
  roomType: string;
  floor: number;
  capacity: number;
  nightlyRateCents: number;
  status: RoomStatus;
}

export interface Guest {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  notes: string;
  createdAt: string;
}

export interface ReservationSummary {
  id: string;
  guestId: string;
  guestName: string;
  guestPhone: string;
  roomId: string;
  roomNumber: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  nightlyRateCents: number;
  totalCents: number;
  source: string;
  status: ReservationStatus;
  notes: string;
}

export interface BookingRequest {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  checkIn: string;
  checkOut: string;
  requestedRoomType: string;
  status: BookingRequestStatus;
  message: string;
}

export interface HousekeepingTask {
  id: string;
  roomId: string;
  roomNumber: string;
  title: string;
  status: string;
  dueDate: string;
  notes: string;
  assigneeStaffId?: string | null;
  assigneeName?: string | null;
  updatedAt: string;
}

export interface StaffMember {
  id: string;
  fullName: string;
  role: StaffRole;
  active: boolean;
}

export interface MaintenanceTicket {
  id: string;
  roomId: string;
  roomNumber: string;
  title: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  dueDate: string;
}

export interface TodayStats {
  arrivals: number;
  departures: number;
  inHouse: number;
  pendingRequests: number;
  openMaintenance: number;
  roomsReady: number;
  roomsDirty: number;
}

export interface TodayDeskPayload {
  today: string;
  stats: TodayStats;
  rooms: Room[];
  arrivals: ReservationSummary[];
  departures: ReservationSummary[];
  inHouse: ReservationSummary[];
  bookingRequests: BookingRequest[];
  housekeepingTasks: HousekeepingTask[];
  maintenanceTickets: MaintenanceTicket[];
}

export interface SearchResults {
  guests: Guest[];
  reservations: ReservationSummary[];
  rooms: Room[];
}

export interface CountRow {
  label: string;
  count: number;
}

export interface AuditLogEntry {
  id: string;
  actorRole: AppRole | null;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

export interface ManagerStats {
  occupancyPercent: number;
  arrivalsToday: number;
  departuresToday: number;
  inHouse: number;
  pendingRequests: number;
  dirtyRooms: number;
  openMaintenance: number;
  revenueCents: number;
}

export interface ManagerDashboardPayload {
  today: string;
  stats: ManagerStats;
  roomStatusCounts: CountRow[];
  demandByRoomType: CountRow[];
  bookingSourceMix: CountRow[];
  upcoming: ReservationSummary[];
  maintenance: MaintenanceTicket[];
  recentAudit: AuditLogEntry[];
}

export interface PortfolioHotelSummary {
  hotel: Hotel;
  role: AppRole;
  stats: ManagerStats;
  roomsTotal: number;
}

export interface PortfolioDashboardPayload {
  session: HostedSession;
  hotels: PortfolioHotelSummary[];
  totals: {
    hotels: number;
    rooms: number;
    inHouse: number;
    arrivalsToday: number;
    departuresToday: number;
    openMaintenance: number;
    revenueCents: number;
  };
}

export interface WalkInInput {
  guestId?: string | null;
  fullName: string;
  email: string;
  phone: string;
  guestNotes: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  nightlyRateCents: number;
  notes: string;
}

export interface GuestInput {
  id?: string | null;
  fullName: string;
  email: string;
  phone: string;
  notes: string;
}

export interface HousekeepingInput {
  roomId: string;
  title: string;
  status: string;
  dueDate: string;
}

export interface AssignHousekeepingInput {
  roomId: string;
  staffId: string;
}

export interface HousekeepingRoomActionInput {
  roomId: string;
}

export interface SendBackHousekeepingInput {
  roomId: string;
  reason: string;
}

export interface MaintenanceInput {
  id?: string | null;
  roomId: string;
  title: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  dueDate: string;
}

export interface ReportRoomIssueInput {
  roomId: string;
  title: string;
}

export interface ReviewRoomIssueInput {
  ticketId: string;
  title: string;
  priority: MaintenancePriority;
}

export interface CancelRoomIssueInput {
  ticketId: string;
}
