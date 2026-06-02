import { apiError } from "@/lib/api";
import { requireHotelSession } from "@/lib/authz";
import { hotelBackupFilename } from "@/lib/downloads";
import { createBackup, getHotel } from "@/lib/hotel-service";

export async function GET(_request: Request, { params }: { params: Promise<{ hotelId: string }> }) {
  try {
    const { hotelId } = await params;
    await requireHotelSession(hotelId, ["owner", "manager"]);
    const [hotel, body] = await Promise.all([getHotel(hotelId), createBackup(hotelId)]);
    return new Response(body, {
      headers: {
        "content-disposition": `attachment; filename="${hotelBackupFilename(hotel.name)}"`,
        "content-type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
