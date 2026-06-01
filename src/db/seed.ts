import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import { realisticHotelFixtures, type RealisticHotelFixture } from "@/db/realistic-hotel-fixtures";

const ownerUserId = process.env.SEED_CLERK_USER_ID;
const clerkOrgId = process.env.SEED_CLERK_ORGANIZATION_ID || null;

if (!ownerUserId) {
  throw new Error("Set SEED_CLERK_USER_ID in .env.local before running bun run db:seed.");
}

const now = new Date().toISOString();
const orgId = "org_demo_portfolio";
type SeedSql = ReturnType<typeof neon>;

let sqlClient: SeedSql | null = null;

function getSeedSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured.");
  }
  sqlClient ??= neon(url);
  return sqlClient;
}

function createSeedId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
}

function offsetDateString(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

function staffRowsForHotel(hotelId: string, hotelIndex: number) {
  const label = hotelIndex === 0 ? "Pecos" : "Roswell";
  return [
    [`staff_manager_${hotelId}`, `${label} Demo Manager`, "manager", null],
    [`staff_fd_${hotelId}`, `${label} Front Desk`, "front-desk", null],
    [`staff_hks_${hotelId}`, `${label} Housekeeping Supervisor`, "housekeeping-supervisor", null],
    [`staff_hk_ava_${hotelId}`, hotelIndex === 0 ? "Ava Patel" : "Roswell Ava Patel", "housekeeping", null],
    [`staff_hk_ben_${hotelId}`, hotelIndex === 0 ? "Ben Carter" : "Roswell Ben Carter", "housekeeping", null],
    [`staff_hk_mia_${hotelId}`, hotelIndex === 0 ? "Mia Nguyen" : "Roswell Mia Nguyen", "housekeeping", null],
    [`staff_hk_noah_${hotelId}`, hotelIndex === 0 ? "Noah Williams" : "Roswell Noah Williams", "housekeeping", null],
    [`staff_maint_${hotelId}`, `${label} Maintenance`, "maintenance", null],
  ] as const;
}

async function seedHotel(sql: SeedSql, fixture: RealisticHotelFixture, hotelIndex: number) {
  const hotelId = fixture.hotel.id;
  await sql`
    INSERT INTO hotels (id, organization_id, name, city, state, timezone, active, created_at, updated_at)
    VALUES (${hotelId}, ${orgId}, ${fixture.hotel.name}, ${fixture.hotel.city}, ${fixture.hotel.state}, ${fixture.hotel.timezone}, true, ${now}, ${now})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      timezone = EXCLUDED.timezone,
      active = true,
      updated_at = EXCLUDED.updated_at
  `;
  await sql`
    INSERT INTO hotel_settings (id, hotel_id, hotel_name, check_in_time, check_out_time, created_at, updated_at)
    VALUES (${`settings_${hotelId}`}, ${hotelId}, ${fixture.hotel.name}, ${fixture.hotel.checkInTime}, ${fixture.hotel.checkOutTime}, ${now}, ${now})
    ON CONFLICT (hotel_id) DO UPDATE SET
      hotel_name = EXCLUDED.hotel_name,
      check_in_time = EXCLUDED.check_in_time,
      check_out_time = EXCLUDED.check_out_time,
      updated_at = EXCLUDED.updated_at
  `;
  await sql`
    INSERT INTO hotel_memberships (id, organization_id, hotel_id, clerk_user_id, display_name, email, role, active, created_at, updated_at)
    VALUES (${`member_owner_${hotelId}`}, ${orgId}, ${hotelId}, ${ownerUserId}, 'Portfolio Owner', '', 'owner', true, ${now}, ${now})
    ON CONFLICT (clerk_user_id, hotel_id) DO UPDATE SET role = 'owner', active = true, updated_at = EXCLUDED.updated_at
  `;

  for (const room of fixture.rooms) {
    await sql`
      INSERT INTO rooms (id, hotel_id, number, room_type, floor, capacity, nightly_rate_cents, status, created_at, updated_at)
      VALUES (${room.id}, ${hotelId}, ${room.number}, ${room.roomType}, ${room.floor}, ${room.capacity}, ${room.nightlyRateCents}, ${room.currentAppStatus}, ${now}, ${now})
      ON CONFLICT (id) DO UPDATE SET
        number = EXCLUDED.number,
        room_type = EXCLUDED.room_type,
        floor = EXCLUDED.floor,
        capacity = EXCLUDED.capacity,
        nightly_rate_cents = EXCLUDED.nightly_rate_cents,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at
    `;
  }

  const staffRows = staffRowsForHotel(hotelId, hotelIndex);
  for (const staff of staffRows) {
    await sql`
      INSERT INTO staff (id, hotel_id, full_name, role, active, clerk_user_id, created_at, updated_at)
      VALUES (${staff[0]}, ${hotelId}, ${staff[1]}, ${staff[2]}, true, ${staff[3]}, ${now}, ${now})
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        active = true,
        clerk_user_id = EXCLUDED.clerk_user_id,
        updated_at = EXCLUDED.updated_at
    `;
  }

  for (const guest of fixture.guests) {
    await sql`
      INSERT INTO guests (id, hotel_id, full_name, email, phone, notes, created_at, updated_at)
      VALUES (${guest.id}, ${hotelId}, ${guest.fullName}, ${guest.email}, ${guest.phone}, ${guest.notes}, ${now}, ${now})
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        notes = EXCLUDED.notes,
        updated_at = EXCLUDED.updated_at
    `;
  }

  for (const reservation of fixture.reservations) {
    await sql`
      INSERT INTO reservations (id, hotel_id, guest_id, room_id, check_in, check_out, adults, children, nightly_rate_cents, total_cents, source, status, notes, created_at, updated_at)
      VALUES (
        ${reservation.id},
        ${hotelId},
        ${reservation.guestId},
        ${reservation.roomId},
        ${offsetDateString(reservation.checkInOffsetDays)},
        ${offsetDateString(reservation.checkOutOffsetDays)},
        ${reservation.adults},
        ${reservation.children},
        ${reservation.nightlyRateCents},
        ${reservation.totalCents},
        ${reservation.source},
        ${reservation.status},
        ${reservation.notes},
        ${now},
        ${now}
      )
      ON CONFLICT (id) DO UPDATE SET
        room_id = EXCLUDED.room_id,
        check_in = EXCLUDED.check_in,
        check_out = EXCLUDED.check_out,
        adults = EXCLUDED.adults,
        children = EXCLUDED.children,
        nightly_rate_cents = EXCLUDED.nightly_rate_cents,
        total_cents = EXCLUDED.total_cents,
        source = EXCLUDED.source,
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        updated_at = EXCLUDED.updated_at
    `;
  }

  const housekeepers = staffRows.filter((staff) => staff[2] === "housekeeping");
  for (const [index, task] of fixture.housekeepingTasks.entries()) {
    const assignee = housekeepers[index % housekeepers.length];
    await sql`
      INSERT INTO housekeeping_tasks (id, hotel_id, room_id, assignee_staff_id, title, status, due_date, notes, created_at, updated_at)
      VALUES (${task.id}, ${hotelId}, ${task.roomId}, ${assignee?.[0] ?? null}, ${task.title}, ${task.status}, ${offsetDateString(task.dueOffsetDays)}, ${task.notes}, ${now}, ${now})
      ON CONFLICT (id) DO UPDATE SET
        room_id = EXCLUDED.room_id,
        assignee_staff_id = EXCLUDED.assignee_staff_id,
        title = EXCLUDED.title,
        status = EXCLUDED.status,
        due_date = EXCLUDED.due_date,
        notes = EXCLUDED.notes,
        updated_at = EXCLUDED.updated_at
    `;
  }

  for (const ticket of fixture.maintenanceTickets) {
    await sql`
      INSERT INTO maintenance_tickets (id, hotel_id, room_id, title, priority, status, due_date, created_at, updated_at)
      VALUES (${ticket.id}, ${hotelId}, ${ticket.roomId}, ${ticket.title}, ${ticket.priority}, ${ticket.status}, ${offsetDateString(ticket.dueOffsetDays)}, ${now}, ${now})
      ON CONFLICT (id) DO UPDATE SET
        room_id = EXCLUDED.room_id,
        title = EXCLUDED.title,
        priority = EXCLUDED.priority,
        status = EXCLUDED.status,
        due_date = EXCLUDED.due_date,
        updated_at = EXCLUDED.updated_at
    `;
  }

  for (const request of fixture.bookingRequests) {
    await sql`
      INSERT INTO booking_requests (id, hotel_id, full_name, email, phone, check_in, check_out, requested_room_type, status, message, created_at, updated_at)
      VALUES (
        ${request.id},
        ${hotelId},
        ${request.fullName},
        ${request.email},
        ${request.phone},
        ${offsetDateString(request.checkInOffsetDays)},
        ${offsetDateString(request.checkOutOffsetDays)},
        ${request.requestedRoomType},
        ${request.status},
        ${request.message},
        ${now},
        ${now}
      )
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        check_in = EXCLUDED.check_in,
        check_out = EXCLUDED.check_out,
        requested_room_type = EXCLUDED.requested_room_type,
        status = EXCLUDED.status,
        message = EXCLUDED.message,
        updated_at = EXCLUDED.updated_at
    `;
  }

  await sql`
    INSERT INTO audit_logs (id, hotel_id, actor_clerk_user_id, actor_role, action, entity_type, entity_id, before_values, after_values, created_at)
    VALUES (${createSeedId("audit")}, ${hotelId}, ${ownerUserId}, 'owner', 'demo.seed.realistic', 'hotel', ${hotelId}, null, ${JSON.stringify({ rooms: fixture.rooms.length, reservations: fixture.reservations.length, maintenanceTickets: fixture.maintenanceTickets.length, bookingRequests: fixture.bookingRequests.length })}, ${now})
  `;
}

async function main() {
  const sql = getSeedSql();
  await sql`
    INSERT INTO organizations (id, clerk_organization_id, name, created_at, updated_at)
    VALUES (${orgId}, ${clerkOrgId}, 'Demo Hotel Group', ${now}, ${now})
    ON CONFLICT (id) DO UPDATE SET clerk_organization_id = EXCLUDED.clerk_organization_id, name = EXCLUDED.name, updated_at = EXCLUDED.updated_at
  `;

  for (const [index, fixture] of realisticHotelFixtures.entries()) {
    await seedHotel(sql, fixture, index);
  }

  console.log("Seeded realistic hosted hotel demo data for", ownerUserId);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
