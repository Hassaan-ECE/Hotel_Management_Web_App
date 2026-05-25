import { apiError, parseJson } from "@/lib/api";
import { requireHotelSession } from "@/lib/authz";
import { saveHousekeepingTask } from "@/lib/hotel-service";
import { housekeepingInputSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ hotelId: string }> }) {
  try {
    const { hotelId } = await params;
    const { session } = await requireHotelSession(hotelId, ["owner", "manager", "housekeeping-supervisor"]);
    const input = await parseJson(request, housekeepingInputSchema);
    return Response.json(await saveHousekeepingTask(hotelId, session, input), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
