import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { GuestInput, HostedSession, WalkInInput } from "@/lib/types";

type MockGuest = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  notes: string;
  createdAt: string;
};

type MockRoom = {
  id: string;
  status: string;
};

type MockReservation = {
  id: string;
  guestId: string;
  roomId: string;
};

type MockSql = {
  <T = unknown[]>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  query<T = unknown[]>(queryWithPlaceholders: string, params?: unknown[]): Promise<T>;
};

type MockDatabase = {
  sql: MockSql;
  seedRoom: (hotelId: string, roomId: string, status: string) => void;
  seedGuest: (
    hotelId: string,
    guestId: string,
    guest: Omit<MockGuest, "id" | "createdAt"> & { createdAt?: string },
  ) => void;
  guest: (hotelId: string, guestId: string) => MockGuest | undefined;
  guestCount: (hotelId: string) => number;
  reservation: (hotelId: string, reservationId: string) => MockReservation | undefined;
  reservationCount: (hotelId: string) => number;
};

function normalizeQuery(raw: string) {
  return raw.replace(/\s+/g, " ").trim();
}

function createMockDatabase() {
  const guestsByHotel = new Map<string, Map<string, MockGuest>>();
  const roomsByHotel = new Map<string, Map<string, MockRoom>>();
  const reservationsByHotel = new Map<string, Map<string, MockReservation>>();

  const getOrCreate = <T>(bucket: Map<string, Map<string, T>>, hotelId: string) => {
    let items = bucket.get(hotelId);
    if (!items) {
      items = new Map<string, T>();
      bucket.set(hotelId, items);
    }
    return items;
  };

  const now = "2026-06-01T00:00:00.000Z";

  const sql = (async function <T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T> {
    const query = normalizeQuery(strings.join(""));
    if (query.includes("UPDATE guests SET")) {
      const [fullName, email, phone, notes, _unusedUpdatedAt, id, hotelId] = values as [string, string, string, string, string, string, string];
      const guests = getOrCreate(guestsByHotel, hotelId);
      const guest = guests.get(id);
      if (!guest) return [] as T;
      guest.fullName = fullName;
      guest.email = email;
      guest.phone = phone;
      guest.notes = notes;
      void _unusedUpdatedAt;
      return [{ id: guest.id }] as T;
    }

    if (query.includes("INSERT INTO guests")) {
      const [id, hotelId, fullName, email, phone, notes] = values as [string, string, string, string, string, string];
      const guests = getOrCreate(guestsByHotel, hotelId);
      guests.set(id, { id, fullName, email, phone, notes, createdAt: now });
      return [] as T;
    }

    if (query.includes("INSERT INTO reservations")) {
      const [id, hotelId, guestId, roomId] = values as [string, string, string, string];
      const reservations = getOrCreate(reservationsByHotel, hotelId);
      reservations.set(id, { id, guestId, roomId });
      return [] as T;
    }

    if (query.includes("SELECT id, status FROM rooms")) {
      const [roomId, hotelId] = values as [string, string];
      const room = getOrCreate(roomsByHotel, hotelId).get(roomId);
      if (!room) return [] as T;
      return [{ id: room.id, status: room.status }] as T;
    }

    if (query.includes("UPDATE rooms SET status")) {
      const [status, roomId, hotelId] = values as [string, string, string];
      const rooms = getOrCreate(roomsByHotel, hotelId);
      const room = rooms.get(roomId);
      if (room) room.status = status;
      return [] as T;
    }

    return [] as T;
  }) as MockSql;

  sql.query = async function <T>(queryWithPlaceholders: string, params: unknown[] = []): Promise<T> {
    const query = normalizeQuery(queryWithPlaceholders);
    if (query.includes("SELECT id, full_name AS \"fullName\"")) {
      const [hotelId, guestId] = params as [string, string];
      const guest = getOrCreate(guestsByHotel, hotelId).get(guestId);
      if (!guest) return [] as T;
      return [
        {
          id: guest.id,
          fullName: guest.fullName,
          email: guest.email,
          phone: guest.phone,
          notes: guest.notes,
          createdAt: guest.createdAt,
        },
      ] as T;
    }

    return [] as T;
  };

  return {
    sql,
    seedRoom: (hotelId: string, roomId: string, status: string) => {
      const rooms = getOrCreate(roomsByHotel, hotelId);
      rooms.set(roomId, { id: roomId, status });
    },
    seedGuest: (
      hotelId: string,
      guestId: string,
      guest: Omit<MockGuest, "id" | "createdAt"> & { createdAt?: string },
    ) => {
      const guests = getOrCreate(guestsByHotel, hotelId);
      guests.set(guestId, { id: guestId, createdAt: guest.createdAt ?? now, ...guest });
    },
    guest: (hotelId: string, guestId: string) => getOrCreate(guestsByHotel, hotelId).get(guestId),
    guestCount: (hotelId: string) => getOrCreate(guestsByHotel, hotelId).size,
    reservation: (hotelId: string, reservationId: string) => getOrCreate(reservationsByHotel, hotelId).get(reservationId),
    reservationCount: (hotelId: string) => getOrCreate(reservationsByHotel, hotelId).size,
  };
}

const testSession: HostedSession = {
  userId: "test-user",
  displayName: "Test Staff",
  organizationId: "test-org",
  role: "manager",
};

let mockDb: MockDatabase;

mock.module("@/lib/authz", () => ({
  isDemoMode: () => false,
  requireHotelSession: async () => {
    throw new Error("requireHotelSession is not used by this test file.");
  },
}));
mock.module("@/lib/db", () => ({
  getSql: () => mockDb.sql,
}));
mock.module("server-only", () => ({}));

const { createWalkInReservation, saveGuest } = await import("@/lib/hotel-service");
const {
  demoCreateWalkInReservation,
  demoLoadTodayDesk,
  demoMembershipsForUser,
  demoSearchFrontDesk,
  demoSaveGuest,
  resetDemoStore,
} = await import("@/lib/demo-store");

const hotelA = "hotel-a";
const hotelB = "hotel-b";
const roomA = "room-a";
const roomB = "room-b";

const walkInInput = (overrides: Partial<WalkInInput> = {}): WalkInInput => ({
  fullName: "Walk In Guest",
  email: "walkin@example.com",
  phone: "555-1000",
  guestNotes: "Guest notes",
  roomId: roomA,
  checkIn: "2026-06-01",
  checkOut: "2026-06-02",
  adults: 1,
  children: 0,
  nightlyRateCents: 13000,
  notes: "No special requests",
  ...overrides,
});

const guestInput = (overrides: Partial<GuestInput> = {}): GuestInput => ({
  fullName: "Guest Name",
  email: "guest@example.com",
  phone: "555-2000",
  notes: "Loyal guest",
  ...overrides,
});

describe("hotel-service tenant isolation", () => {
  beforeEach(() => {
    mockDb = createMockDatabase();
    mockDb.seedRoom(hotelA, roomA, "available");
    mockDb.seedRoom(hotelB, roomB, "available");
  });

  test("saveGuest rejects provided guest id not in active hotel", async () => {
    mockDb.seedGuest(hotelB, "guest-cross", {
      fullName: "Cross Hotel Guest",
      email: "cross@example.com",
      phone: "555-9000",
      notes: "Different hotel",
    });

    await expect(saveGuest(hotelA, testSession, guestInput({ id: "guest-cross", fullName: "Updated Name" }))).rejects.toThrow(
      "Guest was not found for this hotel.",
    );
  });

  test("saveGuest creates when no ID is supplied", async () => {
    const created = await saveGuest(hotelA, testSession, guestInput());
    expect(created.id).toStartWith("guest_");
    expect(mockDb.guestCount(hotelA)).toBe(1);
    expect(mockDb.guest(hotelA, created.id)?.fullName).toBe("Guest Name");
  });

  test("saveGuest updates existing same-hotel guest", async () => {
    mockDb.seedGuest(hotelA, "guest-existing", {
      fullName: "Before Update",
      email: "before@example.com",
      phone: "555-5555",
      notes: "No notes",
    });
    const updated = await saveGuest(
      hotelA,
      testSession,
      guestInput({ id: "guest-existing", fullName: "After Update", notes: "Updated notes" }),
    );
    expect(updated.id).toBe("guest-existing");
    expect(updated.fullName).toBe("After Update");
    expect(mockDb.guestCount(hotelA)).toBe(1);
  });

  test("createWalkInReservation rejects supplied cross-hotel/missing guestId", async () => {
    mockDb.seedGuest(hotelB, "guest-cross", {
      fullName: "Cross Hotel Guest",
      email: "cross@example.com",
      phone: "555-9000",
      notes: "Different hotel",
    });

    await expect(createWalkInReservation(hotelA, testSession, walkInInput({ guestId: "guest-cross" }))).rejects.toThrow(
      "Guest was not found for this hotel.",
    );
    await expect(createWalkInReservation(hotelA, testSession, walkInInput({ guestId: "guest-missing" }))).rejects.toThrow(
      "Guest was not found for this hotel.",
    );
    expect(mockDb.reservationCount(hotelA)).toBe(0);
  });

  test("createWalkInReservation updates same-hotel guest without duplicating it", async () => {
    mockDb.seedGuest(hotelA, "guest-existing", {
      fullName: "Before Walk-In",
      email: "before@example.com",
      phone: "555-1111",
      notes: "Old notes",
    });

    const createdReservation = await createWalkInReservation(
      hotelA,
      testSession,
      walkInInput({ guestId: "guest-existing", fullName: "After Walk-In", phone: "555-2222" }),
    );

    expect(mockDb.guestCount(hotelA)).toBe(1);
    expect(mockDb.guest(hotelA, "guest-existing")?.fullName).toBe("After Walk-In");
    expect(mockDb.guest(hotelA, "guest-existing")?.phone).toBe("555-2222");
    expect(mockDb.reservation(hotelA, createdReservation.id)?.guestId).toBe("guest-existing");
  });

  test("createWalkInReservation creates new guest when no guestId supplied", async () => {
    const createdReservation = await createWalkInReservation(hotelA, testSession, walkInInput());
    expect(createdReservation.id).toStartWith("res_");
    expect(mockDb.reservationCount(hotelA)).toBe(1);
    const reservation = mockDb.reservation(hotelA, createdReservation.id);
    if (!reservation) throw new Error("Expected newly created walk-in reservation to be present.");
    expect(reservation).toBeDefined();
    expect(mockDb.guest(hotelA, reservation.guestId)).toBeDefined();
  });
});

describe("demo-store tenant isolation parity", () => {
  const demoHotels = () => {
    const memberships = demoMembershipsForUser("demo-owner");
    return memberships.map((membership) => membership.hotelId);
  };

  beforeEach(() => {
    resetDemoStore();
  });

  test("demoSaveGuest rejects provided id not in same hotel", () => {
    const [firstHotel, secondHotel] = demoHotels();
    const crossHotelGuest = demoSaveGuest(secondHotel, testSession, guestInput());
    expect(() =>
      demoSaveGuest(firstHotel, testSession, guestInput({ id: crossHotelGuest.id, fullName: "Should Fail" })),
    ).toThrow("Guest was not found for this demo hotel.");
  });

  test("demoSaveGuest updates existing same-hotel and creates when omitted", () => {
    const [firstHotel] = demoHotels();
    const created = demoSaveGuest(firstHotel, testSession, guestInput());
    const updated = demoSaveGuest(firstHotel, testSession, guestInput({ id: created.id, fullName: "Updated Demo Guest", phone: "555-7777" }));
    expect(updated.fullName).toBe("Updated Demo Guest");
    expect(updated.phone).toBe("555-7777");
    const createdAgain = demoSaveGuest(firstHotel, testSession, guestInput({ fullName: "Demo New Guest", email: "newdemo@example.com" }));
    expect(createdAgain.id).toStartWith("guest_");
  });

  test("demoCreateWalkInReservation rejects cross-hotel guestId and creates guest when omitted", () => {
    const [firstHotel, secondHotel] = demoHotels();
    const availableRoom = demoLoadTodayDesk(firstHotel).rooms.find((candidate) => !["occupied", "maintenance"].includes(candidate.status));
    if (!availableRoom) throw new Error("Expected an available room for demo test.");
    const crossHotelGuest = demoSaveGuest(secondHotel, testSession, guestInput());
    expect(() =>
      demoCreateWalkInReservation(firstHotel, testSession, walkInInput({ roomId: availableRoom.id, guestId: crossHotelGuest.id })),
    ).toThrow("Guest was not found for this demo hotel.");

    const uniqueGuestName = "Unique Walk-In Guest";
    const before = demoSearchFrontDesk(firstHotel, uniqueGuestName, 25);
    expect(before.guests.length).toBe(0);
    demoCreateWalkInReservation(firstHotel, testSession, walkInInput({ roomId: availableRoom.id, fullName: uniqueGuestName }));
    const after = demoSearchFrontDesk(firstHotel, uniqueGuestName, 25);
    expect(after.guests.length).toBe(1);
  });

  test("demoCreateWalkInReservation updates same-hotel guest without duplicating it", () => {
    const [firstHotel] = demoHotels();
    const availableRoom = demoLoadTodayDesk(firstHotel).rooms.find((candidate) => !["occupied", "maintenance"].includes(candidate.status));
    if (!availableRoom) throw new Error("Expected an available room for demo test.");

    const createdGuest = demoSaveGuest(firstHotel, testSession, guestInput({ fullName: "Reusable Demo Guest" }));
    demoCreateWalkInReservation(
      firstHotel,
      testSession,
      walkInInput({ roomId: availableRoom.id, guestId: createdGuest.id, fullName: "Updated Demo Walk-In", phone: "555-3333" }),
    );

    expect(demoSearchFrontDesk(firstHotel, "Reusable Demo Guest", 25).guests.length).toBe(0);
    const updated = demoSearchFrontDesk(firstHotel, "Updated Demo Walk-In", 25);
    expect(updated.guests.length).toBe(1);
    expect(updated.guests[0].id).toBe(createdGuest.id);
    expect(updated.guests[0].phone).toBe("555-3333");
  });
});
