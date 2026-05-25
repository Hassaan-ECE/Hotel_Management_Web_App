import { apiError } from "@/lib/api";
import { requireHotelSession } from "@/lib/authz";
import { loadHousekeepingWork } from "@/lib/hotel-service";

export async function GET(_request: Request, { params }: { params: Promise<{ hotelId: string }> }) {
  try {
    const { hotelId } = await params;
    const { session } = await requireHotelSession(hotelId, ["housekeeping"]);
    return Response.json(await loadHousekeepingWork(hotelId, session));
  } catch (error) {
    return apiError(error);
  }
}