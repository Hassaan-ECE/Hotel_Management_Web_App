import { apiError, parseJson } from "@/lib/api";
import { requireHotelSession } from "@/lib/authz";
import { sendBackHousekeepingRoom } from "@/lib/hotel-service";
import { sendBackSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ hotelId: string }> }) {
  try {
    const { hotelId } = await params;
    const { session } = await requireHotelSession(hotelId, ["owner", "manager", "housekeeping-supervisor"]);
    const input = await parseJson(request, sendBackSchema);
    await sendBackHousekeepingRoom(hotelId, session, input.roomId, input.reason);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}