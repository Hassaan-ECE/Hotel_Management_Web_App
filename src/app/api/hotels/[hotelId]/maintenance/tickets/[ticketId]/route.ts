import { apiError, parseJson } from "@/lib/api";
import { requireHotelSession } from "@/lib/authz";
import { badRequest } from "@/lib/errors";
import { updateMaintenanceTicket } from "@/lib/hotel-service";
import { maintenanceInputSchema } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ hotelId: string; ticketId: string }> }) {
  try {
    const { hotelId, ticketId } = await params;
    const { session } = await requireHotelSession(hotelId, ["owner", "manager", "maintenance"]);
    const input = await parseJson(request, maintenanceInputSchema);
    if (input.id && input.id !== ticketId) throw badRequest("Maintenance ticket id does not match the route.");
    return Response.json(await updateMaintenanceTicket(hotelId, session, ticketId, input));
  } catch (error) {
    return apiError(error);
  }
}
