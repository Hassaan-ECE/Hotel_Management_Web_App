import { apiError } from "@/lib/api";
import { requireAnyHotelSession } from "@/lib/authz";
import { loadPortfolio } from "@/lib/hotel-service";

export async function GET() {
  try {
    const { session } = await requireAnyHotelSession();
    return Response.json(await loadPortfolio(session));
  } catch (error) {
    return apiError(error);
  }
}