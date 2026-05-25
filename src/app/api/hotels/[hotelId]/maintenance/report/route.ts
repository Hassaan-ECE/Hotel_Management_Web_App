import { apiError, parseJson } from "@/lib/api";
import { requireHotelSession } from "@/lib/authz";
import { reportRoomIssue } from "@/lib/hotel-service";
import { reportRoomIssueSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ hotelId: string }> }) {
  try {
    const { hotelId } = await params;
    const { session } = await requireHotelSession(hotelId, ["owner", "manager", "housekeeping", "housekeeping-supervisor", "maintenance"]);
    const input = await parseJson(request, reportRoomIssueSchema);
    return Response.json(await reportRoomIssue(hotelId, session, input), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
