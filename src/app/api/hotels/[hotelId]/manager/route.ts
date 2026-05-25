import { apiError } from "@/lib/api";
import { requireHotelSession } from "@/lib/authz";
import { loadManagerDashboard } from "@/lib/hotel-service";

export async function GET(_request: Request, { params }: { params: Promise<{ hotelId: string }> }) {
  try {
    const { hotelId } = await params;
    await requireHotelSession(hotelId, ["owner", "manager"]);
    return Response.json(await loadManagerDashboard(hotelId));
  } catch (error) {
    return apiError(error);
  }
}