import { cookies } from "next/headers";
import { apiError, parseJson } from "@/lib/api";
import { demoSessionCookie, isDemoMode, listMembershipsForUser, requireIdentity } from "@/lib/authz";
import { demoUserForCredential } from "@/lib/demo-users";
import { demoLoginSchema } from "@/lib/validation";

export async function GET() {
  try {
    const identity = await requireIdentity();
    const memberships = await listMembershipsForUser(identity.userId);
    return Response.json({ identity, memberships });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!isDemoMode()) {
      return Response.json({ error: "Demo login is disabled when Clerk and Neon are configured." }, { status: 400 });
    }
    const input = await parseJson(request, demoLoginSchema);
    const user = demoUserForCredential(input.code);
    if (!user) return Response.json({ error: "Invalid demo access code or fake user ID." }, { status: 401 });
    (await cookies()).set(demoSessionCookie, user.userId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    const memberships = await listMembershipsForUser(user.userId);
    return Response.json({
      identity: {
        userId: user.userId,
        clerkOrganizationId: "demo-clerk-org",
        displayName: user.displayName,
        email: user.email,
      },
      memberships,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE() {
  try {
    (await cookies()).delete(demoSessionCookie);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
