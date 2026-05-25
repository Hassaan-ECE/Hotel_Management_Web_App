import { getSql } from "@/lib/db";
import { createId, todayString } from "@/lib/hotel-service";

const ownerUserId = process.env.SEED_CLERK_USER_ID;
const clerkOrgId = process.env.SEED_CLERK_ORGANIZATION_ID || null;

if (!ownerUserId) {
  throw new Error("Set SEED_CLERK_USER_ID in .env.local before running bun run db:seed.");
}

const sql = getSql();
const now = new Date().toISOString();
const orgId = "org_demo_portfolio";
const hotelA = "hotel_cove_house";
const hotelB = "hotel_river_gate";
const today = todayString();
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

async function seedHotel(hotelId: string, name: string, city: string, state: string, roomPrefix: string) {
  await sql`
    INSERT INTO hotels (id, organization_id, name, city, state, timezone, active, created_at, updated_at)
    VALUES (${hotelId}, ${orgId}, ${name}, ${city}, ${state}, 'America/Chicago', true, ${now}, ${now})
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, city = EXCLUDED.city, state = EXCLUDED.state, updated_at = EXCLUDED.updated_at
  `;
  await sql`
    INSERT INTO hotel_settings (id, hotel_id, hotel_name, check_in_time, check_out_time, created_at, updated_at)
    VALUES (${`settings_${hotelId}`}, ${hotelId}, ${name}, '15:00', '11:00', ${now}, ${now})
    ON CONFLICT (hotel_id) DO UPDATE SET hotel_name = EXCLUDED.hotel_name, updated_at = EXCLUDED.updated_at
  `;
  await sql`
    INSERT INTO hotel_memberships (id, organization_id, hotel_id, clerk_user_id, display_name, email, role, active, created_at, updated_at)
    VALUES (${`member_owner_${hotelId}`}, ${orgId}, ${hotelId}, ${ownerUserId}, 'Portfolio Owner', '', 'owner', true, ${now}, ${now})
    ON CONFLICT (clerk_user_id, hotel_id) DO UPDATE SET role = 'owner', active = true, updated_at = EXCLUDED.updated_at
  `;

  const rooms = [
    [`${hotelId}_101`, `${roomPrefix}101`, 'King', 1, 2, 15900, 'ready'],
    [`${hotelId}_102`, `${roomPrefix}102`, 'Double Queen', 1, 4, 17900, 'dirty'],
    [`${hotelId}_201`, `${roomPrefix}201`, 'Suite', 2, 4, 24900, 'occupied'],
    [`${hotelId}_202`, `${roomPrefix}202`, 'King', 2, 2, 15900, 'maintenance'],
  ] as const;
  for (const room of rooms) {
    await sql`
      INSERT INTO rooms (id, hotel_id, number, room_type, floor, capacity, nightly_rate_cents, status, created_at, updated_at)
      VALUES (${room[0]}, ${hotelId}, ${room[1]}, ${room[2]}, ${room[3]}, ${room[4]}, ${room[5]}, ${room[6]}, ${now}, ${now})
      ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at
    `;
  }

  const staffRows = [
    [`staff_manager_${hotelId}`, 'Demo Manager', 'manager'],
    [`staff_fd_${hotelId}`, 'Demo Front Desk', 'front-desk'],
    [`staff_hks_${hotelId}`, 'Demo Housekeeping Supervisor', 'housekeeping-supervisor'],
    [`staff_hk_ava_${hotelId}`, 'Ava Patel', 'housekeeping'],
    [`staff_hk_ben_${hotelId}`, 'Ben Carter', 'housekeeping'],
    [`staff_maint_${hotelId}`, 'Demo Maintenance', 'maintenance'],
  ] as const;
  for (const staff of staffRows) {
    await sql`
      INSERT INTO staff (id, hotel_id, full_name, role, active, created_at, updated_at)
      VALUES (${staff[0]}, ${hotelId}, ${staff[1]}, ${staff[2]}, true, ${now}, ${now})
      ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, active = true, updated_at = EXCLUDED.updated_at
    `;
  }

  const guestId = `guest_${hotelId}`;
  const reservationId = `res_${hotelId}`;
  await sql`
    INSERT INTO guests (id, hotel_id, full_name, email, phone, notes, created_at, updated_at)
    VALUES (${guestId}, ${hotelId}, 'Jamie Morgan', 'jamie@example.com', '555-0101', '', ${now}, ${now})
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, updated_at = EXCLUDED.updated_at
  `;
  await sql`
    INSERT INTO reservations (id, hotel_id, guest_id, room_id, check_in, check_out, adults, children, nightly_rate_cents, total_cents, source, status, notes, created_at, updated_at)
    VALUES (${reservationId}, ${hotelId}, ${guestId}, ${`${hotelId}_201`}, ${today}, ${tomorrow}, 2, 0, 24900, 24900, 'direct', 'checked-in', '', ${now}, ${now})
    ON CONFLICT (id) DO UPDATE SET status = 'checked-in', updated_at = EXCLUDED.updated_at
  `;
  await sql`
    INSERT INTO housekeeping_tasks (id, hotel_id, room_id, assignee_staff_id, title, status, due_date, notes, created_at, updated_at)
    VALUES (${`hk_${hotelId}`}, ${hotelId}, ${`${hotelId}_102`}, ${`staff_hk_ava_${hotelId}`}, 'Turn room after checkout', 'dirty', ${today}, '', ${now}, ${now})
    ON CONFLICT (id) DO UPDATE SET status = 'dirty', updated_at = EXCLUDED.updated_at
  `;
  await sql`
    INSERT INTO maintenance_tickets (id, hotel_id, room_id, title, priority, status, due_date, created_at, updated_at)
    VALUES (${`mt_${hotelId}`}, ${hotelId}, ${`${hotelId}_202`}, 'HVAC check', 'high', 'open', ${today}, ${now}, ${now})
    ON CONFLICT (id) DO UPDATE SET status = 'open', updated_at = EXCLUDED.updated_at
  `;
  await sql`
    INSERT INTO audit_logs (id, hotel_id, actor_clerk_user_id, actor_role, action, entity_type, entity_id, before_values, after_values, created_at)
    VALUES (${createId("audit")}, ${hotelId}, ${ownerUserId}, 'owner', 'demo.seed', 'hotel', ${hotelId}, null, '{}', ${now})
  `;
}

await sql`
  INSERT INTO organizations (id, clerk_organization_id, name, created_at, updated_at)
  VALUES (${orgId}, ${clerkOrgId}, 'Demo Hotel Group', ${now}, ${now})
  ON CONFLICT (id) DO UPDATE SET clerk_organization_id = EXCLUDED.clerk_organization_id, name = EXCLUDED.name, updated_at = EXCLUDED.updated_at
`;

await seedHotel(hotelA, 'Cove House Hotel', 'Galveston', 'TX', 'C');
await seedHotel(hotelB, 'River Gate Inn', 'San Antonio', 'TX', 'R');

console.log('Seeded hosted hotel demo data for', ownerUserId);