import { beforeEach, describe, expect, mock, test } from "bun:test";

type MockSql = {
  <T = unknown[]>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  query<T = unknown[]>(queryText: string, params?: unknown[]): Promise<T>;
};

let mockSql: MockSql;

function normalizeQuery(raw: string) {
  return raw.replace(/\s+/g, " ").trim();
}

mock.module("@/lib/authz", () => ({
  isDemoMode: () => false,
}));

mock.module("@/lib/db", () => ({
  getSql: () => mockSql,
}));

mock.module("server-only", () => ({}));

const { loadTodayDesk } = await import("@/lib/hotel-service");

describe("packet 12 SQL date normalization", () => {
  beforeEach(() => {
    const sql = (async function <T>(strings: TemplateStringsArray): Promise<T> {
      const query = normalizeQuery(strings.join(""));

      if (query.includes("FROM rooms")) {
        return [
          {
            id: "room-1",
            number: "101",
            roomType: "King",
            floor: 1,
            capacity: 2,
            nightlyRateCents: 12900,
            status: "ready",
          },
        ] as T;
      }

      if (query.includes("FROM booking_requests")) {
        return [
          {
            id: "request-1",
            fullName: "Booking Guest",
            phone: "555-0100",
            email: "guest@example.com",
            checkIn: new Date("2026-06-06T00:00:00.000Z"),
            checkOut: new Date("2026-06-07T00:00:00.000Z"),
            requestedRoomType: "King",
            status: "new",
            message: "Quiet room",
          },
        ] as T;
      }

      return [] as T;
    }) as MockSql;

    sql.query = async function <T>(queryText: string): Promise<T> {
      const query = normalizeQuery(queryText);

      if (query.includes("COALESCE(SUM")) {
        return [{ total: "0" }] as T;
      }

      if (query.includes("COUNT(*) AS count")) {
        return [{ count: "0" }] as T;
      }

      if (query.includes("FROM reservations r")) {
        return [
          {
            id: "reservation-1",
            guestId: "guest-1",
            guestName: "Reservation Guest",
            guestPhone: "555-0101",
            roomId: "room-1",
            roomNumber: "101",
            roomType: "King",
            checkIn: new Date("2026-06-03T00:00:00.000Z"),
            checkOut: new Date("2026-06-04T00:00:00.000Z"),
            adults: 2,
            children: 0,
            nightlyRateCents: 12900,
            totalCents: 12900,
            source: "walk-in",
            status: "confirmed",
            notes: "",
          },
        ] as T;
      }

      if (query.includes("FROM housekeeping_tasks ht")) {
        return [
          {
            id: "task-1",
            roomId: "room-1",
            roomNumber: "101",
            title: "Clean room",
            status: "dirty",
            dueDate: new Date("2026-06-04T00:00:00.000Z"),
            notes: "",
            assigneeStaffId: null,
            assigneeName: null,
            updatedAt: new Date("2026-06-05T12:30:00.000Z"),
          },
        ] as T;
      }

      if (query.includes("FROM maintenance_tickets mt")) {
        return [
          {
            id: "ticket-1",
            roomId: "room-1",
            roomNumber: "101",
            title: "HVAC",
            priority: "medium",
            status: "open",
            dueDate: new Date("2026-06-08T00:00:00.000Z"),
          },
        ] as T;
      }

      return [] as T;
    };

    mockSql = sql;
  });

  test("normalizes Date rows before returning the hotel dashboard payload", async () => {
    const today = await loadTodayDesk("hotel-1");

    expect(today.arrivals[0].checkIn).toBe("2026-06-03");
    expect(today.arrivals[0].checkOut).toBe("2026-06-04");
    expect(today.departures[0].checkIn).toBe("2026-06-03");
    expect(today.inHouse[0].checkOut).toBe("2026-06-04");
    expect(today.bookingRequests[0].checkIn).toBe("2026-06-06");
    expect(today.housekeepingTasks[0].dueDate).toBe("2026-06-04");
    expect(today.housekeepingTasks[0].updatedAt).toBe("2026-06-05T12:30:00.000Z");
    expect(today.maintenanceTickets[0].dueDate).toBe("2026-06-08");
  });
});
