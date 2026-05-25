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
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const dayAfterTomorrow = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

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
    [`${hotelId}_103`, `${roomPrefix}103`, 'Double Queen', 1, 4, 17900, 'cleaning'],
    [`${hotelId}_104`, `${roomPrefix}104`, 'King', 1, 2, 15900, 'cleaning'],
    [`${hotelId}_105`, `${roomPrefix}105`, 'Accessible King', 1, 2, 16900, 'dirty'],
    [`${hotelId}_106`, `${roomPrefix}106`, 'King', 1, 2, 15900, 'available'],
    [`${hotelId}_107`, `${roomPrefix}107`, 'Double Queen', 1, 4, 17900, 'dirty'],
    [`${hotelId}_201`, `${roomPrefix}201`, 'Suite', 2, 4, 24900, 'occupied'],
    [`${hotelId}_202`, `${roomPrefix}202`, 'King', 2, 2, 15900, 'maintenance'],
    [`${hotelId}_203`, `${roomPrefix}203`, 'Double Queen', 2, 4, 17900, 'maintenance'],
    [`${hotelId}_204`, `${roomPrefix}204`, 'Suite', 2, 4, 25900, 'maintenance'],
    [`${hotelId}_301`, `${roomPrefix}301`, 'Suite', 3, 4, 25900, 'occupied'],
    [`${hotelId}_302`, `${roomPrefix}302`, 'King', 3, 2, 16900, 'available'],
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
    [`staff_hk_mia_${hotelId}`, 'Mia Nguyen', 'housekeeping'],
    [`staff_hk_noah_${hotelId}`, 'Noah Williams', 'housekeeping'],
    [`staff_maint_${hotelId}`, 'Demo Maintenance', 'maintenance'],
  ] as const;
  for (const staff of staffRows) {
    await sql`
      INSERT INTO staff (id, hotel_id, full_name, role, active, created_at, updated_at)
      VALUES (${staff[0]}, ${hotelId}, ${staff[1]}, ${staff[2]}, true, ${now}, ${now})
      ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, active = true, updated_at = EXCLUDED.updated_at
    `;
  }

  const guestRows = [
    [`guest_${hotelId}`, 'Jamie Morgan', 'jamie@example.com', '555-0101', ''],
    [`guest_${hotelId}_2`, 'Taylor Brooks', 'taylor@example.com', '555-0119', 'Late arrival'],
    [`guest_${hotelId}_3`, 'Priya Shah', 'priya@example.com', '555-0144', 'Prefers high floor'],
    [`guest_${hotelId}_4`, 'Luis Hernandez', 'luis@example.com', '555-0172', 'Needs invoice copy'],
    [`guest_${hotelId}_5`, 'Morgan Lee', 'morgan@example.com', '555-0188', 'Company rate'],
    [`guest_${hotelId}_6`, 'Chen Wu', 'chen@example.com', '555-0166', ''],
  ] as const;
  for (const guest of guestRows) {
    await sql`
      INSERT INTO guests (id, hotel_id, full_name, email, phone, notes, created_at, updated_at)
      VALUES (${guest[0]}, ${hotelId}, ${guest[1]}, ${guest[2]}, ${guest[3]}, ${guest[4]}, ${now}, ${now})
      ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, phone = EXCLUDED.phone, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at
    `;
  }

  const reservationRows = [
    [`res_${hotelId}`, `guest_${hotelId}`, `${hotelId}_201`, yesterday, today, 2, 0, 24900, 24900, 'direct', 'checked-in', ''],
    [`res_${hotelId}_2`, `guest_${hotelId}_2`, `${hotelId}_101`, today, tomorrow, 1, 0, 15900, 15900, 'phone', 'confirmed', 'Late arrival'],
    [`res_${hotelId}_3`, `guest_${hotelId}_3`, `${hotelId}_106`, today, tomorrow, 2, 1, 15900, 15900, 'web', 'pending', 'Verify card at arrival'],
    [`res_${hotelId}_4`, `guest_${hotelId}_4`, `${hotelId}_301`, today, dayAfterTomorrow, 2, 2, 25900, 51800, 'ota', 'checked-in', 'Family stay'],
    [`res_${hotelId}_5`, `guest_${hotelId}_5`, `${hotelId}_302`, tomorrow, dayAfterTomorrow, 1, 0, 16900, 16900, 'corporate', 'confirmed', 'Company rate'],
    [`res_${hotelId}_6`, `guest_${hotelId}_6`, `${hotelId}_102`, yesterday, today, 2, 0, 17900, 17900, 'phone', 'checked-out', 'Room ready for turn'],
  ] as const;
  for (const reservation of reservationRows) {
    await sql`
      INSERT INTO reservations (id, hotel_id, guest_id, room_id, check_in, check_out, adults, children, nightly_rate_cents, total_cents, source, status, notes, created_at, updated_at)
      VALUES (${reservation[0]}, ${hotelId}, ${reservation[1]}, ${reservation[2]}, ${reservation[3]}, ${reservation[4]}, ${reservation[5]}, ${reservation[6]}, ${reservation[7]}, ${reservation[8]}, ${reservation[9]}, ${reservation[10]}, ${reservation[11]}, ${now}, ${now})
      ON CONFLICT (id) DO UPDATE SET room_id = EXCLUDED.room_id, check_in = EXCLUDED.check_in, check_out = EXCLUDED.check_out, adults = EXCLUDED.adults, children = EXCLUDED.children, nightly_rate_cents = EXCLUDED.nightly_rate_cents, total_cents = EXCLUDED.total_cents, source = EXCLUDED.source, status = EXCLUDED.status, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at
    `;
  }

  const bookingRequestRows = [
    [`request_${hotelId}_1`, 'Alex Rivera', '555-0199', 'alex@example.com', tomorrow, tomorrow, 'King', 'new', 'Needs quiet room.'],
    [`request_${hotelId}_2`, 'Nia Coleman', '555-0135', 'nia@example.com', tomorrow, dayAfterTomorrow, 'Suite', 'contacted', 'Asked about early check-in.'],
    [`request_${hotelId}_3`, 'Owen Park', '555-0182', 'owen@example.com', today, tomorrow, 'Double Queen', 'declined', 'No matching rate.'],
  ] as const;
  for (const request of bookingRequestRows) {
    await sql`
      INSERT INTO booking_requests (id, hotel_id, full_name, phone, email, check_in, check_out, requested_room_type, status, message, created_at, updated_at)
      VALUES (${request[0]}, ${hotelId}, ${request[1]}, ${request[2]}, ${request[3]}, ${request[4]}, ${request[5]}, ${request[6]}, ${request[7]}, ${request[8]}, ${now}, ${now})
      ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, email = EXCLUDED.email, check_in = EXCLUDED.check_in, check_out = EXCLUDED.check_out, requested_room_type = EXCLUDED.requested_room_type, status = EXCLUDED.status, message = EXCLUDED.message, updated_at = EXCLUDED.updated_at
    `;
  }

  const housekeepingRows = [
    [`hk_${hotelId}`, `${hotelId}_102`, `staff_hk_ava_${hotelId}`, 'Turn room after checkout', 'dirty', ''],
    [`hk_${hotelId}_2`, `${hotelId}_103`, `staff_hk_ava_${hotelId}`, 'Finish stayover clean', 'cleaning', 'Supervisor send-back: mirror streaks'],
    [`hk_${hotelId}_3`, `${hotelId}_104`, `staff_hk_ava_${hotelId}`, 'Inspect checkout clean', 'inspection', ''],
    [`hk_${hotelId}_4`, `${hotelId}_105`, `staff_hk_mia_${hotelId}`, 'Hold for maintenance review', 'blocked', 'Loose towel bar reported by housekeeping'],
    [`hk_${hotelId}_5`, `${hotelId}_107`, `staff_hk_ben_${hotelId}`, 'Late checkout turn', 'dirty', ''],
  ] as const;
  for (const task of housekeepingRows) {
    await sql`
      INSERT INTO housekeeping_tasks (id, hotel_id, room_id, assignee_staff_id, title, status, due_date, notes, created_at, updated_at)
      VALUES (${task[0]}, ${hotelId}, ${task[1]}, ${task[2]}, ${task[3]}, ${task[4]}, ${today}, ${task[5]}, ${now}, ${now})
      ON CONFLICT (id) DO UPDATE SET room_id = EXCLUDED.room_id, assignee_staff_id = EXCLUDED.assignee_staff_id, title = EXCLUDED.title, status = EXCLUDED.status, due_date = EXCLUDED.due_date, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at
    `;
  }

  const maintenanceRows = [
    [`mt_${hotelId}`, `${hotelId}_202`, 'HVAC check', 'high', 'open', today],
    [`mt_${hotelId}_2`, `${hotelId}_203`, 'Bathroom sink leak', 'medium', 'in-progress', today],
    [`mt_${hotelId}_3`, `${hotelId}_204`, 'Door lock vendor hold', 'critical', 'blocked', tomorrow],
    [`mt_${hotelId}_4`, `${hotelId}_105`, 'Loose towel bar', 'medium', 'pending-review', today],
    [`mt_${hotelId}_5`, `${hotelId}_102`, 'Remote battery replaced', 'low', 'resolved', yesterday],
  ] as const;
  for (const ticket of maintenanceRows) {
    await sql`
      INSERT INTO maintenance_tickets (id, hotel_id, room_id, title, priority, status, due_date, created_at, updated_at)
      VALUES (${ticket[0]}, ${hotelId}, ${ticket[1]}, ${ticket[2]}, ${ticket[3]}, ${ticket[4]}, ${ticket[5]}, ${now}, ${now})
      ON CONFLICT (id) DO UPDATE SET room_id = EXCLUDED.room_id, title = EXCLUDED.title, priority = EXCLUDED.priority, status = EXCLUDED.status, due_date = EXCLUDED.due_date, updated_at = EXCLUDED.updated_at
    `;
  }
  await sql`
    INSERT INTO audit_logs (id, hotel_id, actor_clerk_user_id, actor_role, action, entity_type, entity_id, before_values, after_values, created_at)
    VALUES (${createId("audit")}, ${hotelId}, ${ownerUserId}, 'owner', 'demo.seed', 'hotel', ${hotelId}, null, '{}', ${now})
  `;
  const auditRows = [
    ['front-desk', 'reservation.status', 'reservation', `res_${hotelId}_6`],
    ['housekeeping-supervisor', 'housekeeping.assign', 'housekeeping_task', `hk_${hotelId}`],
    ['housekeeping', 'maintenance.report', 'maintenance_ticket', `mt_${hotelId}_4`],
    ['maintenance', 'maintenance.update', 'maintenance_ticket', `mt_${hotelId}_2`],
  ] as const;
  for (const entry of auditRows) {
    await sql`
      INSERT INTO audit_logs (id, hotel_id, actor_clerk_user_id, actor_role, action, entity_type, entity_id, before_values, after_values, created_at)
      VALUES (${createId("audit")}, ${hotelId}, null, ${entry[0]}, ${entry[1]}, ${entry[2]}, ${entry[3]}, null, '{}', ${now})
    `;
  }
}

await sql`
  INSERT INTO organizations (id, clerk_organization_id, name, created_at, updated_at)
  VALUES (${orgId}, ${clerkOrgId}, 'Demo Hotel Group', ${now}, ${now})
  ON CONFLICT (id) DO UPDATE SET clerk_organization_id = EXCLUDED.clerk_organization_id, name = EXCLUDED.name, updated_at = EXCLUDED.updated_at
`;

await seedHotel(hotelA, 'Cove House Hotel', 'Galveston', 'TX', 'C');
await seedHotel(hotelB, 'River Gate Inn', 'San Antonio', 'TX', 'R');

console.log('Seeded hosted hotel demo data for', ownerUserId);
