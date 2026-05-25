import { apiError, parseJson } from "@/lib/api";
import { requireHotelSession } from "@/lib/authz";
import { saveRoomStatus } from "@/lib/hotel-service";
import { roomStatusInputSchema } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ hotelId: string; roomId: string }> }) {
  try {
    const { hotelId, roomId } = await params;
    const { session } = await requireHotelSession(hotelId, ["owner", "manager", "housekeeping", "housekeeping-supervisor", "maintenance"]);
    const input = await parseJson(request, roomStatusInputSchema);
    await saveRoomStatus(hotelId, session, roomId, input.status);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
