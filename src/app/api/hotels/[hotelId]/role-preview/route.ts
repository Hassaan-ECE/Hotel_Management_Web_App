import { apiError, parseJson } from "@/lib/api";
import { clearRolePreviewCookie, requireRolePreviewAdminSession, setRolePreviewCookie } from "@/lib/authz";
import { assertHousekeeperPreviewStaff } from "@/lib/hotel-service";
import { rolePreviewInputSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ hotelId: string }> }) {
  try {
    const { hotelId } = await params;
    await requireRolePreviewAdminSession(hotelId);
    const input = await parseJson(request, rolePreviewInputSchema);
    if (input.role === "owner") {
      await clearRolePreviewCookie();
      return Response.json({ role: "owner", preview: false });
    }

    let staffId: string | null = null;
    if (input.role === "housekeeping") {
      staffId = input.staffId ?? "";
      await assertHousekeeperPreviewStaff(hotelId, staffId);
    }
    await setRolePreviewCookie({ v: 1, hotelId, role: input.role, staffId });
    return Response.json({ role: input.role, staffId, preview: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ hotelId: string }> }) {
  try {
    const { hotelId } = await params;
    await requireRolePreviewAdminSession(hotelId);
    await clearRolePreviewCookie();
    return Response.json({ role: "owner", preview: false });
  } catch (error) {
    return apiError(error);
  }
}
