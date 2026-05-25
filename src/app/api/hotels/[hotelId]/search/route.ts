import { apiError } from "@/lib/api";
import { requireHotelSession } from "@/lib/authz";
import { allHotelRoles, searchFrontDesk } from "@/lib/hotel-service";

export async function GET(request: Request, { params }: { params: Promise<{ hotelId: string }> }) {
  try {
    const { hotelId } = await params;
    await requireHotelSession(hotelId, allHotelRoles);
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    const limit = Number(url.searchParams.get("limit") ?? 25);
    return Response.json(await searchFrontDesk(hotelId, query, limit));
  } catch (error) {
    return apiError(error);
  }
}
