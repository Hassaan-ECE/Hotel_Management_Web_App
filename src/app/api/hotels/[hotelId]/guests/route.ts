import { apiError, parseJson } from "@/lib/api";
import { requireHotelSession } from "@/lib/authz";
import { saveGuest } from "@/lib/hotel-service";
import { guestInputSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ hotelId: string }> }) {
  try {
    const { hotelId } = await params;
    const { session } = await requireHotelSession(hotelId, ["owner", "manager", "front-desk"]);
    const input = await parseJson(request, guestInputSchema);
    return Response.json(await saveGuest(hotelId, session, input), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
