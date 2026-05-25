import { apiError, parseJson } from "@/lib/api";
import { requireHotelSession } from "@/lib/authz";
import { createMaintenanceTicket } from "@/lib/hotel-service";
import { maintenanceInputSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ hotelId: string }> }) {
  try {
    const { hotelId } = await params;
    const { session } = await requireHotelSession(hotelId, ["owner", "manager", "maintenance"]);
    const input = await parseJson(request, maintenanceInputSchema);
    return Response.json(await createMaintenanceTicket(hotelId, session, input), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}