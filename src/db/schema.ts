import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  clerkOrganizationId: text("clerk_organization_id").unique(),
  name: text("name").notNull(),
  ...timestamps,
});

export const hotels = pgTable(
  "hotels",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    city: text("city").notNull().default(""),
    state: text("state").notNull().default(""),
    timezone: text("timezone").notNull().default("America/Chicago"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [index("hotels_org_idx").on(table.organizationId)],
);

export const hotelMemberships = pgTable(
  "hotel_memberships",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    hotelId: text("hotel_id").notNull().references(() => hotels.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id").notNull(),
    displayName: text("display_name").notNull().default(""),
    email: text("email").notNull().default(""),
    role: text("role").notNull(),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("hotel_memberships_user_idx").on(table.clerkUserId),
    index("hotel_memberships_hotel_idx").on(table.hotelId),
    uniqueIndex("hotel_memberships_unique_user_hotel_idx").on(table.clerkUserId, table.hotelId),
  ],
);

export const rooms = pgTable(
  "rooms",
  {
    id: text("id").primaryKey(),
    hotelId: text("hotel_id").notNull().references(() => hotels.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    roomType: text("room_type").notNull(),
    floor: integer("floor").notNull(),
    capacity: integer("capacity").notNull(),
    nightlyRateCents: integer("nightly_rate_cents").notNull(),
    status: text("status").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("rooms_unique_hotel_number_idx").on(table.hotelId, table.number),
    index("rooms_hotel_status_idx").on(table.hotelId, table.status),
  ],
);

export const guests = pgTable(
  "guests",
  {
    id: text("id").primaryKey(),
    hotelId: text("hotel_id").notNull().references(() => hotels.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    notes: text("notes").notNull().default(""),
    ...timestamps,
  },
  (table) => [index("guests_hotel_name_idx").on(table.hotelId, table.fullName)],
);

export const reservations = pgTable(
  "reservations",
  {
    id: text("id").primaryKey(),
    hotelId: text("hotel_id").notNull().references(() => hotels.id, { onDelete: "cascade" }),
    guestId: text("guest_id").notNull().references(() => guests.id),
    roomId: text("room_id").notNull().references(() => rooms.id),
    checkIn: text("check_in").notNull(),
    checkOut: text("check_out").notNull(),
    adults: integer("adults").notNull(),
    children: integer("children").notNull(),
    nightlyRateCents: integer("nightly_rate_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    source: text("source").notNull(),
    status: text("status").notNull(),
    notes: text("notes").notNull().default(""),
    ...timestamps,
  },
  (table) => [
    index("reservations_hotel_date_idx").on(table.hotelId, table.checkIn, table.checkOut, table.status),
    index("reservations_hotel_guest_idx").on(table.hotelId, table.guestId),
    index("reservations_hotel_room_idx").on(table.hotelId, table.roomId),
  ],
);

export const staff = pgTable(
  "staff",
  {
    id: text("id").primaryKey(),
    hotelId: text("hotel_id").notNull().references(() => hotels.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    role: text("role").notNull(),
    active: boolean("active").notNull().default(true),
    clerkUserId: text("clerk_user_id"),
    ...timestamps,
  },
  (table) => [index("staff_hotel_role_idx").on(table.hotelId, table.role, table.active)],
);

export const housekeepingTasks = pgTable(
  "housekeeping_tasks",
  {
    id: text("id").primaryKey(),
    hotelId: text("hotel_id").notNull().references(() => hotels.id, { onDelete: "cascade" }),
    roomId: text("room_id").notNull().references(() => rooms.id),
    assigneeStaffId: text("assignee_staff_id").references(() => staff.id),
    title: text("title").notNull(),
    status: text("status").notNull(),
    dueDate: text("due_date").notNull(),
    notes: text("notes").notNull().default(""),
    ...timestamps,
  },
  (table) => [index("housekeeping_hotel_status_idx").on(table.hotelId, table.status)],
);

export const maintenanceTickets = pgTable(
  "maintenance_tickets",
  {
    id: text("id").primaryKey(),
    hotelId: text("hotel_id").notNull().references(() => hotels.id, { onDelete: "cascade" }),
    roomId: text("room_id").notNull().references(() => rooms.id),
    title: text("title").notNull(),
    priority: text("priority").notNull(),
    status: text("status").notNull(),
    dueDate: text("due_date").notNull(),
    ...timestamps,
  },
  (table) => [index("maintenance_hotel_status_idx").on(table.hotelId, table.status)],
);

export const bookingRequests = pgTable(
  "booking_requests",
  {
    id: text("id").primaryKey(),
    hotelId: text("hotel_id").notNull().references(() => hotels.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    checkIn: text("check_in").notNull(),
    checkOut: text("check_out").notNull(),
    requestedRoomType: text("requested_room_type").notNull(),
    status: text("status").notNull(),
    message: text("message").notNull().default(""),
    ...timestamps,
  },
  (table) => [index("booking_requests_hotel_status_idx").on(table.hotelId, table.status)],
);

export const hotelSettings = pgTable("hotel_settings", {
  id: text("id").primaryKey(),
  hotelId: text("hotel_id").notNull().references(() => hotels.id, { onDelete: "cascade" }).unique(),
  hotelName: text("hotel_name").notNull(),
  checkInTime: text("check_in_time").notNull(),
  checkOutTime: text("check_out_time").notNull(),
  ...timestamps,
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    hotelId: text("hotel_id").notNull().references(() => hotels.id, { onDelete: "cascade" }),
    actorClerkUserId: text("actor_clerk_user_id"),
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    beforeValues: jsonb("before_values"),
    afterValues: jsonb("after_values"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_logs_hotel_created_idx").on(table.hotelId, table.createdAt)],
);