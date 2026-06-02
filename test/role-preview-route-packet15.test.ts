import { beforeEach, describe, expect, mock, test } from "bun:test";

import { forbidden, notFound } from "@/lib/errors";
import type { AppRole } from "@/lib/types";

type RolePreviewPayload = {
  v: 1;
  hotelId: string;
  role: AppRole;
  staffId: string | null;
};

let adminAllowed = true;
let setPayload: RolePreviewPayload | null = null;
let clearCalls = 0;
let staffChecks: Array<{ hotelId: string; staffId: string }> = [];
let staffError: unknown = null;

mock.module("@/lib/authz", () => ({
  requireRolePreviewAdminSession: async () => {
    if (!adminAllowed) throw forbidden("Admin role preview is not enabled for this account.");
    return { session: { role: "owner" } };
  },
  setRolePreviewCookie: async (payload: RolePreviewPayload) => {
    setPayload = payload;
  },
  clearRolePreviewCookie: async () => {
    clearCalls += 1;
  },
}));

mock.module("@/lib/hotel-service", () => ({
  assertHousekeeperPreviewStaff: async (hotelId: string, staffId: string) => {
    staffChecks.push({ hotelId, staffId });
    if (staffError) throw staffError;
  },
}));

const rolePreviewRoute = await import("@/app/api/hotels/[hotelId]/role-preview/route");

function jsonRequest(body: unknown, method = "POST") {
  return new Request("http://localhost/test", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  adminAllowed = true;
  setPayload = null;
  clearCalls = 0;
  staffChecks = [];
  staffError = null;
});

describe("packet 15 role preview route", () => {
  test("non-allowed admin route request is denied before setting cookie", async () => {
    adminAllowed = false;

    const response = await rolePreviewRoute.POST(jsonRequest({ role: "front-desk" }), {
      params: Promise.resolve({ hotelId: "hotel-a" }),
    });

    expect(response.status).toBe(403);
    expect(setPayload).toBe(null);
    expect(clearCalls).toBe(0);
  });

  test("rejects unknown preview roles", async () => {
    const response = await rolePreviewRoute.POST(jsonRequest({ role: "super-admin" }), {
      params: Promise.resolve({ hotelId: "hotel-a" }),
    });

    expect(response.status).toBe(400);
    expect(setPayload).toBe(null);
  });

  test("requires selected staff for housekeeper preview", async () => {
    const response = await rolePreviewRoute.POST(jsonRequest({ role: "housekeeping" }), {
      params: Promise.resolve({ hotelId: "hotel-a" }),
    });

    expect(response.status).toBe(400);
    expect(setPayload).toBe(null);
    expect(staffChecks.length).toBe(0);
  });

  test("validates housekeeper staff before setting preview cookie", async () => {
    const response = await rolePreviewRoute.POST(jsonRequest({ role: "housekeeping", staffId: "staff-hk" }), {
      params: Promise.resolve({ hotelId: "hotel-a" }),
    });

    expect(response.status).toBe(200);
    expect(staffChecks).toEqual([{ hotelId: "hotel-a", staffId: "staff-hk" }]);
    expect(setPayload).toEqual({ v: 1, hotelId: "hotel-a", role: "housekeeping", staffId: "staff-hk" });
  });

  test("does not set preview cookie when selected housekeeper is not in the hotel", async () => {
    staffError = notFound("Housekeeper was not found for this hotel.");

    const response = await rolePreviewRoute.POST(jsonRequest({ role: "housekeeping", staffId: "staff-other" }), {
      params: Promise.resolve({ hotelId: "hotel-a" }),
    });

    expect(response.status).toBe(404);
    expect(setPayload).toBe(null);
  });

  test("delete clears preview after real admin check", async () => {
    const response = await rolePreviewRoute.DELETE(new Request("http://localhost/test", { method: "DELETE" }), {
      params: Promise.resolve({ hotelId: "hotel-a" }),
    });

    expect(response.status).toBe(200);
    expect(clearCalls).toBe(1);
  });
});
