const reportNames: Record<string, string> = {
  reservations: "reservations",
  rooms: "rooms",
  maintenance: "maintenance",
};

export function fileSafeSegment(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "hotel"
  );
}

export function hotelExportFilename(hotelName: string, report: string) {
  return `${fileSafeSegment(hotelName)}-${reportNames[report] ?? fileSafeSegment(report)}.csv`;
}

export function hotelBackupFilename(hotelName: string) {
  return `${fileSafeSegment(hotelName)}-backup.json`;
}
