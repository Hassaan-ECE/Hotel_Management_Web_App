import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { demoIdentityForUser, demoMembershipsForUser, demoRequireAnyHotelSession, demoRequireHotelSession } from "@/lib/demo-store";
import { getSql, isDatabaseConfigured } from "@/lib/db";
import { forbidden, unauthorized } from "@/lib/errors";
import { appRoles, roleAllowed } from "@/lib/roles";
import type { AppRole, HostedSession, HotelMembership } from "@/lib/types";

export const demoSessionCookie = "hotel_demo_user_id";
export const rolePreviewCookie = "hotel_role_preview";

const rolePreviewMaxAgeSeconds = 60 * 60 * 2;
const rolePreviewRoles = new Set<AppRole>(appRoles);

type RolePreviewCookiePayload = {
  v: 1;
  hotelId: string;
  role: AppRole;
  staffId?: string | null;
};

type RolePreviewState = {
  role: AppRole;
  staffId: string | null;
};

type HotelSessionOptions = {
  ignoreRolePreview?: boolean;
};

export function isClerkConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

export function isDemoMode() {
  return process.env.HOTEL_APP_DEMO_MODE !== "false" && (!isClerkConfigured() || !isDatabaseConfigured());
}

async function getDemoUserId() {
  return (await cookies()).get(demoSessionCookie)?.value ?? "";
}

export function isRolePreviewFeatureEnabled() {
  return process.env.HOTEL_APP_ROLE_PREVIEW_ENABLED === "true";
}

function rolePreviewUserIds() {
  return (process.env.HOTEL_APP_ROLE_PREVIEW_USER_IDS ?? "")
    .split(/[\s,]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isRolePreviewAllowedForUser(userId: string) {
  return isRolePreviewFeatureEnabled() && rolePreviewUserIds().includes(userId);
}

function parseRolePreviewCookie(raw: string | undefined): RolePreviewCookiePayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<RolePreviewCookiePayload>;
    if (parsed.v !== 1) return null;
    if (typeof parsed.hotelId !== "string" || typeof parsed.role !== "string") return null;
    if (!rolePreviewRoles.has(parsed.role as AppRole)) return null;
    if (parsed.staffId !== undefined && parsed.staffId !== null && typeof parsed.staffId !== "string") return null;
    return {
      v: 1,
      hotelId: parsed.hotelId,
      role: parsed.role as AppRole,
      staffId: parsed.staffId ?? null,
    };
  } catch {
    return null;
  }
}

async function readRolePreviewCookie() {
  return parseRolePreviewCookie((await cookies()).get(rolePreviewCookie)?.value);
}

function normalizeRolePreview(payload: RolePreviewCookiePayload | null, hotelId: string): RolePreviewState | null {
  if (!payload || payload.hotelId !== hotelId || payload.role === "owner") return null;
  if (payload.role === "housekeeping" && !payload.staffId) return null;
  return {
    role: payload.role,
    staffId: payload.role === "housekeeping" ? (payload.staffId ?? null) : null,
  };
}

export async function setRolePreviewCookie(payload: RolePreviewCookiePayload) {
  (await cookies()).set(rolePreviewCookie, encodeURIComponent(JSON.stringify(payload)), {
    httpOnly: true,
    maxAge: rolePreviewMaxAgeSeconds,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearRolePreviewCookie() {
  (await cookies()).set(rolePreviewCookie, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
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

export async function requireHotelSession(hotelId: string, allowed: readonly AppRole[], options: HotelSessionOptions = {}) {
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
  const rolePreviewEnabled = membership.role === "owner" && isRolePreviewAllowedForUser(identity.userId);
  const rolePreview = rolePreviewEnabled && !options.ignoreRolePreview ? normalizeRolePreview(await readRolePreviewCookie(), hotelId) : null;
  const effectiveRole = rolePreview?.role ?? membership.role;
  if (!roleAllowed(effectiveRole, allowed)) {
    throw forbidden("Your hotel role cannot perform that action.");
  }
  const session: HostedSession = {
    userId: identity.userId,
    displayName: membership.displayName || identity.displayName,
    organizationId: membership.organizationId,
    activeHotelId: hotelId,
    role: effectiveRole,
    actualRole: membership.role,
    previewRole: rolePreview?.role ?? null,
    previewStaffId: rolePreview?.staffId ?? null,
    rolePreviewEnabled,
  };
  return { identity, membership: mapMembership(membership), session };
}

export async function requireRolePreviewAdminSession(hotelId: string) {
  const result = await requireHotelSession(hotelId, ["owner"], { ignoreRolePreview: true });
  if (result.membership.role !== "owner") {
    throw forbidden("Admin role preview requires an Admin membership.");
  }
  if (!result.session.rolePreviewEnabled) {
    throw forbidden("Admin role preview is not enabled for this account.");
  }
  return result;
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
