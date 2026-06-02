import { describe, expect, mock, test } from "bun:test";

import { hotelBackupFilename, hotelExportFilename } from "@/lib/downloads";

mock.module("@/lib/authz", () => ({
  requireHotelSession: async () => ({ session: { role: "owner" } }),
}));

mock.module("@/lib/hotel-service", () => ({
  getHotel: async (hotelId: string) => ({
    id: hotelId,
    organizationId: "org-1",
    name: hotelId === "hotel-pecos" ? "Pecos Motor Inn" : "Roswell Lodge & Suites",
    city: "",
    state: "",
    timezone: "America/Chicago",
    active: true,
  }),
  exportCsvReport: async () => "id,name\n1,test\n",
  createBackup: async () => JSON.stringify({ ok: true }),
}));

const exportRoute = await import("@/app/api/hotels/[hotelId]/exports/[report]/route");
const backupRoute = await import("@/app/api/hotels/[hotelId]/backup/route");

describe("packet 14 hotel-specific download filenames", () => {
  test("sanitizes export and backup filenames", () => {
    expect(hotelExportFilename("Roswell Lodge & Suites", "reservations")).toBe("roswell-lodge-suites-reservations.csv");
    expect(hotelExportFilename("Pecos Motor Inn", "rooms")).toBe("pecos-motor-inn-rooms.csv");
    expect(hotelBackupFilename("Pecos Motor Inn")).toBe("pecos-motor-inn-backup.json");
  });

  test("sets hotel-specific CSV content-disposition filenames", async () => {
    const response = await exportRoute.GET(new Request("https://example.test"), {
      params: Promise.resolve({ hotelId: "hotel-pecos", report: "reservations" }),
    });

    expect(response.headers.get("content-disposition")).toBe('attachment; filename="pecos-motor-inn-reservations.csv"');
  });

  test("sets hotel-specific backup content-disposition filenames", async () => {
    const response = await backupRoute.GET(new Request("https://example.test"), {
      params: Promise.resolve({ hotelId: "hotel-roswell" }),
    });

    expect(response.headers.get("content-disposition")).toBe('attachment; filename="roswell-lodge-suites-backup.json"');
  });
});
