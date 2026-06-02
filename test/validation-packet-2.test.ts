import { beforeEach, describe, expect, mock, test } from "bun:test";

import { housekeepingInputSchema, normalizeSearchLimit, rolePreviewInputSchema } from "@/lib/validation";

type MockSql = {
  query<T = unknown>(queryText: string, params?: unknown[]): Promise<T>;
};

let lastSqlLimits: number[] = [];
let mockDb: MockSql;

mock.module("@/lib/authz", () => ({
  isDemoMode: () => false,
  requireHotelSession: async () => {
    throw new Error("requireHotelSession is not used by this test file.");
  },
}));
mock.module("@/lib/db", () => ({
  getSql: () => mockDb,
}));
mock.module("server-only", () => ({}));

const { searchFrontDesk } = await import("@/lib/hotel-service");

const hotelId = "hotel-123";

beforeEach(() => {
  lastSqlLimits = [];
  mockDb = {
    query: async <T>(_query: string, params: unknown[] = []): Promise<T> => {
      const limit = params.at(-1);
      if (typeof limit === "number") {
        lastSqlLimits.push(limit);
      }
      return [] as T;
    },
  };
});

describe("normalizeSearchLimit", () => {
  const normalizeCases: Array<[string, unknown, number]> = [
    ["undefined", undefined, 25],
    ["null", null, 25],
    ["missing", undefined, 25],
    ["blank", "   ", 25],
    ["invalid", "not-a-number", 25],
    ["NaN", Number.NaN, 25],
    ["Infinity", Number.POSITIVE_INFINITY, 25],
    ["-Infinity", Number.NEGATIVE_INFINITY, 25],
    ["zero", 0, 1],
    ["negative", -7, 1],
    ["oversized", 60, 50],
    ["decimal-truncates-down", 19.9, 19],
  ];

  for (const [label, input, expected] of normalizeCases) {
    test(`normalizes ${label}`, () => {
      expect(normalizeSearchLimit(input)).toBe(expected);
    });
  }
});

describe("searchFrontDesk", () => {
  test("uses normalized limit for SQL parameters", async () => {
    await searchFrontDesk(hotelId, "guest", Number.NaN);
    expect(lastSqlLimits.every((limit) => limit === 25)).toBe(true);
    expect(lastSqlLimits.length).toBe(3);

    lastSqlLimits = [];
    await searchFrontDesk(hotelId, "guest", Number.POSITIVE_INFINITY);
    expect(lastSqlLimits.every((limit) => limit === 25)).toBe(true);
    expect(lastSqlLimits.length).toBe(3);

    lastSqlLimits = [];
    await searchFrontDesk(hotelId, "guest", -9);
    expect(lastSqlLimits.every((limit) => limit === 1)).toBe(true);
    expect(lastSqlLimits.length).toBe(3);

    lastSqlLimits = [];
    await searchFrontDesk(hotelId, "guest", 77);
    expect(lastSqlLimits.every((limit) => limit === 50)).toBe(true);
    expect(lastSqlLimits.length).toBe(3);

    lastSqlLimits = [];
    await searchFrontDesk(hotelId, "guest", 7.9);
    expect(lastSqlLimits.every((limit) => limit === 7)).toBe(true);
    expect(lastSqlLimits.length).toBe(3);
  });

  test("ranks matching guests, rooms, and reservations from returned candidates", async () => {
    mockDb = {
      query: async <T>(query: string, params: unknown[] = []): Promise<T> => {
        const limit = params.at(-1);
        if (typeof limit === "number") {
          lastSqlLimits.push(limit);
        }
        if (query.includes("FROM guests")) {
          return [
            { id: "guest-taylor", fullName: "Taylor Brooks", email: "taylor@example.com", phone: "555-0119", notes: "", createdAt: "2026-06-01" },
            { id: "guest-jamie", fullName: "Jamie Morgan", email: "jamie@example.com", phone: "555-0101", notes: "", createdAt: "2026-06-01" },
          ] as T;
        }
        if (query.includes("FROM rooms")) {
          return [
            { id: "room-210", number: "210", roomType: "Double Queen", floor: 2, capacity: 4, nightlyRateCents: 17900, status: "ready" },
            { id: "room-101", number: "101", roomType: "King", floor: 1, capacity: 2, nightlyRateCents: 15900, status: "occupied" },
          ] as T;
        }
        return [
          {
            id: "res-taylor",
            guestId: "guest-taylor",
            guestName: "Taylor Brooks",
            guestPhone: "555-0119",
            roomId: "room-210",
            roomNumber: "210",
            roomType: "Double Queen",
            checkIn: "2026-06-02",
            checkOut: "2026-06-03",
            adults: 2,
            children: 0,
            nightlyRateCents: 17900,
            totalCents: 17900,
            source: "phone",
            status: "confirmed",
            notes: "",
          },
          {
            id: "res-jamie",
            guestId: "guest-jamie",
            guestName: "Jamie Morgan",
            guestPhone: "555-0101",
            roomId: "room-101",
            roomNumber: "101",
            roomType: "King",
            checkIn: "2026-06-01",
            checkOut: "2026-06-03",
            adults: 1,
            children: 0,
            nightlyRateCents: 15900,
            totalCents: 31800,
            source: "direct",
            status: "checked-in",
            notes: "",
          },
        ] as T;
      },
    };

    const results = await searchFrontDesk(hotelId, "Jamie King", 25);

    expect(results.guests.map((guest) => guest.fullName)).toEqual([]);
    expect(results.rooms.map((room) => room.number)).toEqual([]);
    expect(results.reservations.map((reservation) => reservation.id)).toEqual(["res-jamie"]);
    expect(lastSqlLimits.every((limit) => limit === 25)).toBe(true);
  });
});

describe("housekeepingInputSchema", () => {
  const baseInput = {
    roomId: "room-1",
    title: "Clean room",
    dueDate: "2026-06-01",
  };

  const validStatuses: string[] = ["dirty", "cleaning", "inspection", "blocked", "ready"];
  for (const status of validStatuses) {
    test(`allows status ${status}`, () => {
      const result = housekeepingInputSchema.safeParse({ ...baseInput, status });
      expect(result.success).toBe(true);
    });
  }

  const invalidStatuses: string[] = ["done", "foo", "available", ""];
  for (const status of invalidStatuses) {
    test(`rejects status ${status}`, () => {
      const result = housekeepingInputSchema.safeParse({ ...baseInput, status });
      expect(result.success).toBe(false);
    });
  }
});

describe("rolePreviewInputSchema", () => {
  test("allows known preview roles", () => {
    expect(rolePreviewInputSchema.safeParse({ role: "front-desk" }).success).toBe(true);
    expect(rolePreviewInputSchema.safeParse({ role: "maintenance" }).success).toBe(true);
  });

  test("requires staff id for housekeeper preview", () => {
    expect(rolePreviewInputSchema.safeParse({ role: "housekeeping" }).success).toBe(false);
    expect(rolePreviewInputSchema.safeParse({ role: "housekeeping", staffId: "staff-hk" }).success).toBe(true);
  });

  test("rejects unknown preview roles", () => {
    expect(rolePreviewInputSchema.safeParse({ role: "super-admin" }).success).toBe(false);
  });
});
