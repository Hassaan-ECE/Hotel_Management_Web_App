import { apiError } from "@/lib/api";
import { requireHotelSession } from "@/lib/authz";
import { hotelExportFilename } from "@/lib/downloads";
import { exportCsvReport, getHotel } from "@/lib/hotel-service";

export async function GET(_request: Request, { params }: { params: Promise<{ hotelId: string; report: string }> }) {
  try {
    const { hotelId, report } = await params;
    await requireHotelSession(hotelId, ["owner", "manager"]);
    const [hotel, csv] = await Promise.all([getHotel(hotelId), exportCsvReport(hotelId, report)]);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${hotelExportFilename(hotel.name, report)}"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
