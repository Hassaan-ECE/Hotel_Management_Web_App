import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { demoIdentityForUser, demoMembershipsForUser, demoRequireAnyHotelSession, demoRequireHotelSession } from "@/lib/demo-store";
import { getSql, isDatabaseConfigured } from "@/lib/db";
import { forbidden, unauthorized } from "@/lib/errors";
import { roleAllowed } from "@/lib/roles";
import type { AppRole, HostedSession, HotelMembership } from "@/lib/types";

export const demoSessionCookie = "hotel_demo_user_id";

export function isClerkConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

export function isDemoMode() {
  return process.env.HOTEL_APP_DEMO_MODE !== "false" && (!isClerkConfigured() || !isDatabaseConfigured());
}

async function getDemoUserId() {
  return (await cookies()).get(demoSessionCookie)?.value ?? "";
}

export async function getIdentity() {
  if (isDemoMode()) {
    const userId = await getDemoUserId();
    return userId ? demoIdentityForUser(userId) : null;
  }
  try {
    const authState = await auth();
    if (!authState.userId) return null;
    const user = await currentUser();
    return {
      userId: authState.userId,
      clerkOrganizationId: authState.orgId ?? null,
      displayName: user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Signed-in user",
      email: user?.primaryEmailAddress?.emailAddress ?? "",
    };
  } catch {
    return null;
  }
}

export async function requireIdentity() {
  const identity = await getIdentity();
  if (!identity) throw unauthorized();
  return identity;
}

type MembershipRow = {
  id: string;
  organizationId: string;
  hotelId: string;
  clerkUserId: string;
  displayName: string;
  email: string;
  role: AppRole;
  active: boolean;
};

function mapMembership(row: MembershipRow): HotelMembership {
  return row;
}

export async function listMembershipsForUser(userId: string) {
  if (isDemoMode()) return demoMembershipsForUser(userId);
  const sql = getSql();
  const rows = await sql<MembershipRow[]>`
    SELECT
      id,
      organization_id AS "organizationId",
      hotel_id AS "hotelId",
      clerk_user_id AS "clerkUserId",
      display_name AS "displayName",
      email,
      role,
      active
    FROM hotel_memberships
    WHERE clerk_user_id = ${userId} AND active = true
    ORDER BY created_at ASC
  `;
  return rows.map(mapMembership);
}

export async function requireHotelSession(hotelId: string, allowed: readonly AppRole[]) {
  if (isDemoMode()) {
    const userId = await getDemoUserId();
    if (!userId) throw unauthorized("Sign in with a demo user first.");
    return demoRequireHotelSession(userId, hotelId, allowed);
  }
  const identity = await requireIdentity();
  const sql = getSql();
  const rows = await sql<MembershipRow[]>`
    SELECT
      id,
      organization_id AS "organizationId",
      hotel_id AS "hotelId",
      clerk_user_id AS "clerkUserId",
      display_name AS "displayName",
      email,
      role,
      active
    FROM hotel_memberships
    WHERE clerk_user_id = ${identity.userId} AND hotel_id = ${hotelId} AND active = true
    LIMIT 1
  `;
  const membership = rows[0];
  if (!membership) throw forbidden("You are not a member of this hotel.");
  if (!roleAllowed(membership.role, allowed)) {
    throw forbidden("Your hotel role cannot perform that action.");
  }
  const session: HostedSession = {
    userId: identity.userId,
    displayName: membership.displayName || identity.displayName,
    organizationId: membership.organizationId,
    activeHotelId: hotelId,
    role: membership.role,
  };
  return { identity, membership: mapMembership(membership), session };
}

export async function requireAnyHotelSession() {
  if (isDemoMode()) {
    const userId = await getDemoUserId();
    if (!userId) throw unauthorized("Sign in with a demo user first.");
    return demoRequireAnyHotelSession(userId);
  }
  const identity = await requireIdentity();
  const memberships = await listMembershipsForUser(identity.userId);
  if (memberships.length === 0) {
    throw forbidden("Your account has no hotel invitations yet.");
  }
  const primary = memberships[0];
  const session: HostedSession = {
    userId: identity.userId,
    displayName: primary.displayName || identity.displayName,
    organizationId: primary.organizationId,
    activeHotelId: primary.hotelId,
    role: primary.role,
  };
  return { identity, memberships, session };
}
