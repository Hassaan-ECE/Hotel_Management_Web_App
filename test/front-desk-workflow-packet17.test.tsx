import { beforeEach, describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { FrontDeskReservationsPayload, HostedSession, Hotel, Room, TodayDeskPayload } from "@/lib/types";

let redirectCalls: string[] = [];
let pushCalls: string[] = [];
let identity: { userId: string; clerkOrganizationId: string | null; displayName: string; email: string } | null = {
  userId: "user-front-desk",
  clerkOrganizationId: "org-1",
  displayName: "Front Desk",
  email: "front@example.com",
};
let requireHotelSessionCalls: Array<{ hotelId: string; allowed: string[] }> = [];
let loadFrontDeskReservationsCalls: Array<{ hotelId: string; rangeStart: string; rangeEnd: string }> = [];

const hotel: Hotel = {
  id: "hotel-1",
  organizationId: "org-1",
  name: "Packet Hotel",
  city: "Dallas",
  state: "TX",
  timezone: "America/Chicago",
  active: true,
};

const rooms: Room[] = [
  { id: "room-101", number: "101", roomType: "King", floor: 1, capacity: 2, nightlyRateCents: 15900, status: "ready" },
  { id: "room-102", number: "102", roomType: "Double Queen", floor: 1, capacity: 4, nightlyRateCents: 17900, status: "occupied" },
];

const todayPayload: TodayDeskPayload = {
  today: "2026-06-01",
  stats: {
    arrivals: 1,
    departures: 1,
    inHouse: 1,
    pendingRequests: 0,
    openMaintenance: 0,
    roomsReady: 1,
    roomsDirty: 0,
  },
  rooms,
  arrivals: [],
  departures: [],
  inHouse: [],
  bookingRequests: [],
  housekeepingTasks: [],
  maintenanceTickets: [],
};

const reservationsPayload: FrontDeskReservationsPayload = {
  today: "2026-06-01",
  rangeStart: "2026-06-01",
  rangeEnd: "2026-06-15",
  rooms,
  reservations: [
    {
      id: "res-2",
      guestId: "guest-2",
      guestName: "Taylor Brooks",
      guestPhone: "555-0119",
      roomId: "room-102",
      roomNumber: "102",
      roomType: "Double Queen",
      checkIn: "2026-06-02",
      checkOut: "2026-06-04",
      adults: 2,
      children: 0,
      nightlyRateCents: 17900,
      totalCents: 35800,
      source: "phone",
      status: "confirmed",
      notes: "",
    },
    {
      id: "res-1",
      guestId: "guest-1",
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
  ],
};

const routeSession: HostedSession = {
  userId: "user-front-desk",
  displayName: "Front Desk",
  organizationId: "org-1",
  role: "front-desk",
  activeHotelId: "hotel-1",
};

mock.module("next/navigation", () => ({
  redirect: (href: string) => {
    redirectCalls.push(href);
    throw new Error(`REDIRECT:${href}`);
  },
  useRouter: () => ({
    push: (href: string) => {
      pushCalls.push(href);
    },
    refresh: () => {
      return undefined;
    },
  }),
}));

mock.module("@/components/app-topbar", () => ({
  AppTopbar: () => <div>APP_TOPBAR</div>,
}));

mock.module("@/components/setup-panel", () => ({
  SetupPanel: () => <div>SETUP_PANEL</div>,
}));

mock.module("@/lib/authz", () => ({
  getIdentity: async () => identity,
  isClerkConfigured: () => true,
  isDemoMode: () => false,
  requireHotelSession: async (hotelId: string, allowed: string[]) => {
    requireHotelSessionCalls.push({ hotelId, allowed });
    return { session: routeSession };
  },
}));

mock.module("@/lib/db", () => ({
  isDatabaseConfigured: () => true,
}));

mock.module("@/lib/hotel-service", () => ({
  addDaysString: (date: string, days: number) => {
    const base = Date.parse(`${date}T00:00:00Z`);
    return new Date(base + days * 86400000).toISOString().slice(0, 10);
  },
  getHotel: async () => hotel,
  loadFrontDeskReservations: async (hotelId: string, rangeStart: string, rangeEnd: string) => {
    loadFrontDeskReservationsCalls.push({ hotelId, rangeStart, rangeEnd });
    return { ...reservationsPayload, rangeStart, rangeEnd };
  },
  loadHousekeepingSupervisor: async () => ({ housekeepers: [] }),
  loadTodayDesk: async () => todayPayload,
  todayString: () => "2026-06-01",
}));

const frontDeskComponents = await import("@/components/front-desk-workspace");
const FrontDeskPage = (await import("@/app/hotels/[hotelId]/front-desk/page")).default;
const WalkInPage = (await import("@/app/hotels/[hotelId]/front-desk/walk-in/page")).default;
const ReservationsPage = (await import("@/app/hotels/[hotelId]/front-desk/reservations/page")).default;

beforeEach(() => {
  redirectCalls = [];
  pushCalls = [];
  identity = {
    userId: "user-front-desk",
    clerkOrganizationId: "org-1",
    displayName: "Front Desk",
    email: "front@example.com",
  };
  requireHotelSessionCalls = [];
  loadFrontDeskReservationsCalls = [];
});

describe("packet 17 front-desk components", () => {
  test("renders compact hub actions without standalone guest record panel", () => {
    const html = renderToStaticMarkup(<frontDeskComponents.FrontDeskHub hotelId="hotel-1" hotelName="Packet Hotel" today={todayPayload} />);

    expect(html.includes("Guest, room, or reservation search")).toBe(true);
    expect(html.includes("Create walk-in")).toBe(true);
    expect(html.includes("Arrivals / in-house")).toBe(true);
    expect(html.includes("Room readiness")).toBe(true);
    expect(html.includes("Guest record")).toBe(false);
  });

  test("walk-in page form captures guest details without a separate guest record panel", () => {
    const html = renderToStaticMarkup(<frontDeskComponents.FrontDeskWalkInPage hotelId="hotel-1" hotelName="Packet Hotel" today="2026-06-01" rooms={rooms} />);

    expect(html.includes("Walk-in reservation")).toBe(true);
    expect(html.includes("Guest notes")).toBe(true);
    expect(html.includes("Reservation notes")).toBe(true);
    expect(html.includes("Guest record")).toBe(false);
  });

  test("reservation table helpers filter active rows and sort predictably", () => {
    const filtered = frontDeskComponents.filterReservationsForFrontDesk(reservationsPayload.reservations, "jamie", "checked-in");
    expect(filtered.map((row) => row.id)).toEqual(["res-1"]);

    const sorted = frontDeskComponents.sortReservationsForFrontDesk(reservationsPayload.reservations, "guest");
    expect(sorted.map((row) => row.guestName)).toEqual(["Jamie Morgan", "Taylor Brooks"]);
  });

  test("booking board date helper uses an exclusive range end", () => {
    expect(frontDeskComponents.buildBookingBoardDates("2026-06-01", "2026-06-04")).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
    ]);
  });

  test("reservations component renders table and booking-board toggle", () => {
    const html = renderToStaticMarkup(<frontDeskComponents.FrontDeskReservationsPage hotelId="hotel-1" hotelName="Packet Hotel" payload={reservationsPayload} />);

    expect(html.includes("Active reservations")).toBe(true);
    expect(html.includes("Booking board")).toBe(true);
    expect(html.includes("Jamie Morgan")).toBe(true);
    expect(html.includes("Taylor Brooks")).toBe(true);
  });
});

describe("packet 17 front-desk pages", () => {
  test("front-desk hub page uses front-desk role gate", async () => {
    const rendered = await FrontDeskPage({ params: Promise.resolve({ hotelId: "hotel-1" }) });
    const html = renderToStaticMarkup(rendered);

    expect(html.includes("APP_TOPBAR")).toBe(true);
    expect(html.includes("Front desk")).toBe(true);
    expect(requireHotelSessionCalls[0]).toEqual({ hotelId: "hotel-1", allowed: ["owner", "manager", "front-desk"] });
  });

  test("walk-in page renders the separate walk-in route", async () => {
    const rendered = await WalkInPage({ params: Promise.resolve({ hotelId: "hotel-1" }) });
    const html = renderToStaticMarkup(rendered);

    expect(html.includes("Create walk-in")).toBe(true);
    expect(html.includes("Reservations")).toBe(true);
    expect(requireHotelSessionCalls[0]).toEqual({ hotelId: "hotel-1", allowed: ["owner", "manager", "front-desk"] });
  });

  test("reservations page defaults to a 14-day range and passes custom query ranges", async () => {
    await ReservationsPage({ params: Promise.resolve({ hotelId: "hotel-1" }), searchParams: Promise.resolve({}) });
    expect(loadFrontDeskReservationsCalls[0]).toEqual({ hotelId: "hotel-1", rangeStart: "2026-06-01", rangeEnd: "2026-06-15" });

    loadFrontDeskReservationsCalls = [];
    const rendered = await ReservationsPage({
      params: Promise.resolve({ hotelId: "hotel-1" }),
      searchParams: Promise.resolve({ start: "2026-07-01", end: "2026-07-20" }),
    });
    const html = renderToStaticMarkup(rendered);

    expect(html.includes("Arrivals / in-house")).toBe(true);
    expect(loadFrontDeskReservationsCalls[0]).toEqual({ hotelId: "hotel-1", rangeStart: "2026-07-01", rangeEnd: "2026-07-20" });
    expect(requireHotelSessionCalls.at(-1)).toEqual({ hotelId: "hotel-1", allowed: ["owner", "manager", "front-desk"] });
  });
});
