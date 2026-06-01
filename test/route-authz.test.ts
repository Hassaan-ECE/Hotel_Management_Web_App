import { beforeEach, describe, expect, mock, test } from "bun:test";

import { forbidden } from "@/lib/errors";
import type { AppRole, HostedSession, MaintenanceInput, ReservationStatus } from "@/lib/types";

type AuthCall = {
  hotelId: string;
  allowed: readonly AppRole[];
};

type ReservationStatusCall = {
  hotelId: string;
  session: HostedSession;
  reservationId: string;
  status: ReservationStatus;
};

type HousekeepingApproveCall = {
  hotelId: string;
  session: HostedSession;
  roomId: string;
};

type MaintenanceCreateCall = {
  hotelId: string;
  session: HostedSession;
  input: MaintenanceInput;
};

const routeSession: HostedSession = {
  userId: "route-user",
  displayName: "Route User",
  organizationId: "org",
  role: "manager",
};

let authCalls: AuthCall[] = [];
let authError: unknown = null;
let reservationStatusCalls: ReservationStatusCall[] = [];
let housekeepingApproveCalls: HousekeepingApproveCall[] = [];
let maintenanceCreateCalls: MaintenanceCreateCall[] = [];

mock.module("@/lib/authz", () => ({
  requireHotelSession: async (hotelId: string, allowed: readonly AppRole[]) => {
    authCalls.push({ hotelId, allowed });
    if (authError) throw authError;
    return { session: routeSession };
  },
}));

mock.module("@/lib/hotel-service", () => ({
  approveHousekeepingRoom: async (hotelId: string, session: HostedSession, roomId: string) => {
    housekeepingApproveCalls.push({ hotelId, session, roomId });
  },
  createMaintenanceTicket: async (hotelId: string, session: HostedSession, input: MaintenanceInput) => {
    maintenanceCreateCalls.push({ hotelId, session, input });
    return { id: "ticket-created" };
  },
  updateReservationStatus: async (hotelId: string, session: HostedSession, reservationId: string, status: ReservationStatus) => {
    reservationStatusCalls.push({ hotelId, session, reservationId, status });
  },
}));

const reservationStatusRoute = await import("@/app/api/hotels/[hotelId]/reservations/[reservationId]/status/route");
const housekeepingApproveRoute = await import("@/app/api/hotels/[hotelId]/housekeeping/approve/route");
const maintenanceTicketsRoute = await import("@/app/api/hotels/[hotelId]/maintenance/tickets/route");

function jsonRequest(body: unknown, method = "POST") {
  return new Request("http://localhost/test", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  authCalls = [];
  authError = null;
  reservationStatusCalls = [];
  housekeepingApproveCalls = [];
  maintenanceCreateCalls = [];
});

describe("route authorization boundaries", () => {
  test("reservation status route surfaces role denial and does not call service", async () => {
    authError = forbidden("Your hotel role cannot perform that action.");

    const response = await reservationStatusRoute.PATCH(jsonRequest({ status: "checked-in" }, "PATCH"), {
      params: Promise.resolve({ hotelId: "hotel-a", reservationId: "res-a" }),
    });

    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("Your hotel role cannot perform that action.");
    expect(reservationStatusCalls.length).toBe(0);
    expect(authCalls[0]).toEqual({ hotelId: "hotel-a", allowed: ["owner", "manager", "front-desk"] });
  });

  test("reservation status route passes parsed body and route params to service after auth", async () => {
    const response = await reservationStatusRoute.PATCH(jsonRequest({ status: "checked-out" }, "PATCH"), {
      params: Promise.resolve({ hotelId: "hotel-a", reservationId: "res-a" }),
    });

    expect(response.status).toBe(200);
    expect(reservationStatusCalls[0]).toEqual({
      hotelId: "hotel-a",
      session: routeSession,
      reservationId: "res-a",
      status: "checked-out",
    });
  });

  test("housekeeping approve route rejects disallowed housekeeper role before service", async () => {
    authError = forbidden("Your hotel role cannot perform that action.");

    const response = await housekeepingApproveRoute.POST(jsonRequest({ roomId: "room-a" }), {
      params: Promise.resolve({ hotelId: "hotel-a" }),
    });

    expect(response.status).toBe(403);
    expect(housekeepingApproveCalls.length).toBe(0);
    expect(authCalls[0]).toEqual({ hotelId: "hotel-a", allowed: ["owner", "manager", "housekeeping-supervisor"] });
  });

  test("housekeeping approve route passes room action to service after auth", async () => {
    const response = await housekeepingApproveRoute.POST(jsonRequest({ roomId: "room-a" }), {
      params: Promise.resolve({ hotelId: "hotel-a" }),
    });

    expect(response.status).toBe(200);
    expect(housekeepingApproveCalls[0]).toEqual({ hotelId: "hotel-a", session: routeSession, roomId: "room-a" });
  });

  test("maintenance ticket route rejects disallowed role before service", async () => {
    authError = forbidden("Your hotel role cannot perform that action.");

    const response = await maintenanceTicketsRoute.POST(jsonRequest({ roomId: "room-a", title: "Repair sink", priority: "medium", status: "open", dueDate: "2026-06-01" }), {
      params: Promise.resolve({ hotelId: "hotel-a" }),
    });

    expect(response.status).toBe(403);
    expect(maintenanceCreateCalls.length).toBe(0);
    expect(authCalls[0]).toEqual({ hotelId: "hotel-a", allowed: ["owner", "manager", "maintenance"] });
  });

  test("maintenance ticket route passes parsed body to service after auth", async () => {
    const input: MaintenanceInput = { roomId: "room-a", title: "Repair sink", priority: "medium", status: "open", dueDate: "2026-06-01" };

    const response = await maintenanceTicketsRoute.POST(jsonRequest(input), {
      params: Promise.resolve({ hotelId: "hotel-a" }),
    });

    expect(response.status).toBe(201);
    expect((await response.json()).id).toBe("ticket-created");
    expect(maintenanceCreateCalls[0]).toEqual({ hotelId: "hotel-a", session: routeSession, input });
  });

  test("wrong-hotel auth denial surfaces 403 and prevents service calls", async () => {
    authError = forbidden("You are not a member of this hotel.");

    const response = await reservationStatusRoute.PATCH(jsonRequest({ status: "checked-in" }, "PATCH"), {
      params: Promise.resolve({ hotelId: "hotel-other", reservationId: "res-a" }),
    });

    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("You are not a member of this hotel.");
    expect(reservationStatusCalls.length).toBe(0);
  });
});
