import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { ManagerDashboardPayload, TodayDeskPayload } from "@/lib/types";

mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    refresh: () => {},
  }),
}));

const { HotelWorkspace } = await import("@/components/hotel-workspace");

const today: TodayDeskPayload = {
  today: "2026-06-01",
  stats: {
    arrivals: 1,
    departures: 1,
    inHouse: 2,
    pendingRequests: 0,
    openMaintenance: 1,
    roomsReady: 5,
    roomsDirty: 2,
  },
  rooms: [],
  arrivals: [],
  departures: [],
  inHouse: [],
  bookingRequests: [],
  housekeepingTasks: [],
  maintenanceTickets: [],
};

const manager: ManagerDashboardPayload = {
  today: "2026-06-01",
  stats: {
    occupancyPercent: 72,
    arrivalsToday: 1,
    departuresToday: 1,
    inHouse: 2,
    pendingRequests: 0,
    dirtyRooms: 2,
    openMaintenance: 1,
    revenueCents: 123400,
  },
  roomStatusCounts: [],
  demandByRoomType: [],
  bookingSourceMix: [],
  upcoming: [],
  maintenance: [],
  recentAudit: [],
};

describe("packet 13 hotel workspace layout", () => {
  test("moves manager exports out of the page title into a dedicated panel", () => {
    const html = renderToStaticMarkup(
      <HotelWorkspace
        hotel={{
          id: "hotel-1",
          organizationId: "org-1",
          name: "Packet Hotel",
          city: "Dallas",
          state: "TX",
          timezone: "America/Chicago",
          active: true,
        }}
        session={{
          userId: "owner-1",
          displayName: "Owner",
          organizationId: "org-1",
          role: "owner",
          activeHotelId: "hotel-1",
        }}
        today={today}
        manager={manager}
        housekeepers={[]}
      />,
    );

    const pageTitleStart = html.indexOf('class="page-title"');
    const metricsStart = html.indexOf('class="grid metric-grid"');
    const pageTitleHtml = html.slice(pageTitleStart, metricsStart);

    expect(html.includes("Data exports")).toBe(true);
    expect(html.includes("Reservation list")).toBe(true);
    expect(html.includes("Room inventory")).toBe(true);
    expect(html.includes("Full hotel backup")).toBe(true);
    expect(pageTitleHtml.includes("Reservation list")).toBe(false);
    expect(pageTitleHtml.includes("Full hotel backup")).toBe(false);
  });
});
