import { apiError, parseJson } from "@/lib/api";
import { requireHotelSession } from "@/lib/authz";
import { approveHousekeepingRoom } from "@/lib/hotel-service";
import { roomActionSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ hotelId: string }> }) {
  try {
    const { hotelId } = await params;
    const { session } = await requireHotelSession(hotelId, ["owner", "manager", "housekeeping-supervisor"]);
    const input = await parseJson(request, roomActionSchema);
    await approveHousekeepingRoom(hotelId, session, input.roomId);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}