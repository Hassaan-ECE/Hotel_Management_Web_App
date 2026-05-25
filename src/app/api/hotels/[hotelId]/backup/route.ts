import { apiError } from "@/lib/api";
import { requireHotelSession } from "@/lib/authz";
import { createBackup } from "@/lib/hotel-service";

export async function GET(_request: Request, { params }: { params: Promise<{ hotelId: string }> }) {
  try {
    const { hotelId } = await params;
    await requireHotelSession(hotelId, ["owner", "manager"]);
    const body = await createBackup(hotelId);
    return new Response(body, {
      headers: {
        "content-disposition": `attachment; filename="${hotelId}-backup.json"`,
        "content-type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
