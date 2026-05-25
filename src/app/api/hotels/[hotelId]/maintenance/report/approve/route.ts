import { apiError, parseJson } from "@/lib/api";
import { requireHotelSession } from "@/lib/authz";
import { approveRoomIssueReport } from "@/lib/hotel-service";
import { reviewRoomIssueSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ hotelId: string }> }) {
  try {
    const { hotelId } = await params;
    const { session } = await requireHotelSession(hotelId, ["owner", "manager", "housekeeping-supervisor"]);
    const input = await parseJson(request, reviewRoomIssueSchema);
    return Response.json(await approveRoomIssueReport(hotelId, session, input));
  } catch (error) {
    return apiError(error);
  }
}
