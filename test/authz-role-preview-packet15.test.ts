import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { AppRole } from "@/lib/types";

type MockSql = {
  <T = unknown[]>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

let cookieValue: string | undefined;
let currentUserId = "user-admin";
let membershipRole: AppRole = "owner";
let membershipHotels = new Set(["hotel-a", "hotel-b"]);
let mockSql: MockSql;

mock.module("server-only", () => ({}));

mock.module("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "hotel_role_preview" && cookieValue ? { name, value: cookieValue } : undefined),
    set: () => {},
    delete: () => {},
  }),
}));

mock.module("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: currentUserId, orgId: null }),
  currentUser: async () => ({
    fullName: "Packet Admin",
    primaryEmailAddress: { emailAddress: "admin@example.test" },
  }),
}));

mock.module("@/lib/db", () => ({
  isDatabaseConfigured: () => true,
  getSql: () => mockSql,
}));

const { requireHotelSession, requireRolePreviewAdminSession } = await import("@/lib/authz");

function previewCookie(payload: unknown) {
  return encodeURIComponent(JSON.stringify(payload));
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_packet15";
  process.env.CLERK_SECRET_KEY = "sk_test_packet15";
  process.env.HOTEL_APP_DEMO_MODE = "false";
  process.env.HOTEL_APP_ROLE_PREVIEW_ENABLED = "true";
  process.env.HOTEL_APP_ROLE_PREVIEW_USER_IDS = "user-admin";
  cookieValue = undefined;
  currentUserId = "user-admin";
  membershipRole = "owner";
  membershipHotels = new Set(["hotel-a", "hotel-b"]);
  mockSql = (async function <T>(_strings: TemplateStringsArray, ...values: unknown[]): Promise<T> {
    const [clerkUserId, hotelId] = values as [string, string];
    if (clerkUserId !== currentUserId || !membershipHotels.has(hotelId)) return [] as T;
    return [
      {
        id: `membership-${hotelId}`,
        organizationId: "org-1",
        hotelId,
        clerkUserId,
        displayName: "Packet Admin",
        email: "admin@example.test",
        role: membershipRole,
        active: true,
      },
    ] as T;
  }) as MockSql;
});

describe("packet 15 role preview authz", () => {
  test("owner allow-list preview becomes the effective route role", async () => {
    cookieValue = previewCookie({ v: 1, hotelId: "hotel-a", role: "front-desk" });

    const { session, membership } = await requireHotelSession("hotel-a", ["front-desk"]);

    expect(membership.role).toBe("owner");
    expect(session.role).toBe("front-desk");
    expect(session.actualRole).toBe("owner");
    expect(session.previewRole).toBe("front-desk");
    expect(session.rolePreviewEnabled).toBe(true);
  });

  test("preview role is used for manager-route denial", async () => {
    cookieValue = previewCookie({ v: 1, hotelId: "hotel-a", role: "front-desk" });

    await expect(requireHotelSession("hotel-a", ["owner", "manager"])).rejects.toThrow("Your hotel role cannot perform that action.");
  });

  test("preview cookie is ignored for a different hotel", async () => {
    cookieValue = previewCookie({ v: 1, hotelId: "hotel-a", role: "maintenance" });

    const { session } = await requireHotelSession("hotel-b", ["owner"]);

    expect(session.role).toBe("owner");
    expect(session.previewRole).toBe(null);
    expect(session.rolePreviewEnabled).toBe(true);
  });

  test("preview cookie is ignored when user is not allow-listed", async () => {
    process.env.HOTEL_APP_ROLE_PREVIEW_USER_IDS = "someone-else";
    cookieValue = previewCookie({ v: 1, hotelId: "hotel-a", role: "maintenance" });

    const { session } = await requireHotelSession("hotel-a", ["owner"]);

    expect(session.role).toBe("owner");
    expect(session.previewRole).toBe(null);
    expect(session.rolePreviewEnabled).toBe(false);
  });

  test("role preview admin route requires real owner role and allow-list", async () => {
    membershipRole = "manager";
    await expect(requireRolePreviewAdminSession("hotel-a")).rejects.toThrow("Your hotel role cannot perform that action.");

    membershipRole = "owner";
    process.env.HOTEL_APP_ROLE_PREVIEW_USER_IDS = "someone-else";
    await expect(requireRolePreviewAdminSession("hotel-a")).rejects.toThrow("Admin role preview is not enabled for this account.");
  });
});
