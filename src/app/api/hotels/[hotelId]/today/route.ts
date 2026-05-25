import { apiError } from "@/lib/api";
import { requireHotelSession } from "@/lib/authz";
import { loadTodayDesk } from "@/lib/hotel-service";

export async function GET(_request: Request, { params }: { params: Promise<{ hotelId: string }> }) {
  try {
    const { hotelId } = await params;
    await requireHotelSession(hotelId, ["owner", "manager", "front-desk", "housekeeping", "housekeeping-supervisor", "maintenance"]);
    return Response.json(await loadTodayDesk(hotelId));
  } catch (error) {
    return apiError(error);
  }
}