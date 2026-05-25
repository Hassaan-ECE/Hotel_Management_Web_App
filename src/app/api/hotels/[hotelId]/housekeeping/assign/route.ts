import { apiError, parseJson } from "@/lib/api";
import { requireHotelSession } from "@/lib/authz";
import { assignHousekeepingTask } from "@/lib/hotel-service";
import { assignHousekeepingSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ hotelId: string }> }) {
  try {
    const { hotelId } = await params;
    const { session } = await requireHotelSession(hotelId, ["owner", "manager", "housekeeping-supervisor"]);
    const input = await parseJson(request, assignHousekeepingSchema);
    return Response.json(await assignHousekeepingTask(hotelId, session, input.roomId, input.staffId), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}