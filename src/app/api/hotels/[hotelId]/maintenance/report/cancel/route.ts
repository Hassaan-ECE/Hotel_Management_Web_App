import { apiError, parseJson } from "@/lib/api";
import { requireHotelSession } from "@/lib/authz";
import { cancelRoomIssueReport } from "@/lib/hotel-service";
import { cancelRoomIssueSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ hotelId: string }> }) {
  try {
    const { hotelId } = await params;
    const { session } = await requireHotelSession(hotelId, ["owner", "manager", "housekeeping-supervisor"]);
    const input = await parseJson(request, cancelRoomIssueSchema);
    return Response.json(await cancelRoomIssueReport(hotelId, session, input.ticketId));
  } catch (error) {
    return apiError(error);
  }
}
