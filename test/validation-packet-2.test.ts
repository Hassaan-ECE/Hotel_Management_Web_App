import { beforeEach, describe, expect, mock, test } from "bun:test";

import { housekeepingInputSchema, normalizeSearchLimit } from "@/lib/validation";

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
