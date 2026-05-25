import { apiError } from "@/lib/api";
import { requireHotelSession } from "@/lib/authz";
import { exportCsvReport } from "@/lib/hotel-service";

export async function GET(_request: Request, { params }: { params: Promise<{ hotelId: string; report: string }> }) {
  try {
    const { hotelId, report } = await params;
    await requireHotelSession(hotelId, ["owner", "manager"]);
    const csv = await exportCsvReport(hotelId, report);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${report}.csv"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}