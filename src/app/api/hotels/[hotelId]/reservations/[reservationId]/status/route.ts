import { apiError, parseJson } from "@/lib/api";
import { requireHotelSession } from "@/lib/authz";
import { updateReservationStatus } from "@/lib/hotel-service";
import { reservationStatusInputSchema } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ hotelId: string; reservationId: string }> }) {
  try {
    const { hotelId, reservationId } = await params;
    const { session } = await requireHotelSession(hotelId, ["owner", "manager", "front-desk"]);
    const input = await parseJson(request, reservationStatusInputSchema);
    await updateReservationStatus(hotelId, session, reservationId, input.status);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}