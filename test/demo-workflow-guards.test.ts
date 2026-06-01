import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { HostedSession, MaintenanceInput } from "@/lib/types";

mock.module("server-only", () => ({}));

const {
  demoApproveHousekeepingRoom,
  demoCreateWalkInReservation,
  demoCreateMaintenanceTicket,
  demoFinishHousekeepingRoom,
  demoLoadTodayDesk,
  demoMembershipsForUser,
  demoReportRoomIssue,
  demoSearchFrontDesk,
  demoSendBackHousekeepingRoom,
  demoStartHousekeepingRoom,
  demoUpdateMaintenanceTicket,
  demoUpdateReservationStatus,
  resetDemoStore,
} = await import("@/lib/demo-store");

const managerSession: HostedSession = {
  userId: "demo-owner",
  displayName: "Demo Owner",
  organizationId: "demo-org",
  role: "manager",
};

function demoHotels() {
  return demoMembershipsForUser("demo-owner").map((membership) => membership.hotelId);
}

function maintenanceInput(overrides: Partial<MaintenanceInput> = {}): MaintenanceInput {
  return {
    roomId: "",
    title: "Repair sink",
    priority: "medium",
    status: "open",
    dueDate: "2026-06-01",
    ...overrides,
  };
}

function walkInInput(roomId: string) {
  return {
    fullName: "Demo Walk In",
    email: "demo@example.com",
    phone: "555-0100",
    guestNotes: "",
    roomId,
    checkIn: "2026-06-01",
    checkOut: "2026-06-02",
    adults: 1,
    children: 0,
    nightlyRateCents: 10000,
    notes: "",
  };
}

beforeEach(() => {
  resetDemoStore();
});

describe("demo workflow guard parity", () => {
  test("invalid reservation transition rejects without mutation", () => {
    const [hotelId] = demoHotels();
    const room = demoLoadTodayDesk(hotelId).rooms.find((candidate) => !["occupied", "maintenance"].includes(candidate.status));
    if (!room) throw new Error("Expected room for demo reservation test.");
    const reservation = demoCreateWalkInReservation(hotelId, managerSession, walkInInput(room.id));

    demoUpdateReservationStatus(hotelId, managerSession, reservation.id, "checked-out");

    expect(() => demoUpdateReservationStatus(hotelId, managerSession, reservation.id, "checked-in")).toThrow('Cannot change reservation from "checked-out" to "checked-in".');

    expect(demoSearchFrontDesk(hotelId, reservation.id, 25).reservations[0].status).toBe("checked-out");
  });

  test("invalid demo housekeeping actions reject and send-back returns room to dirty", () => {
    const [hotelId] = demoHotels();
    const desk = demoLoadTodayDesk(hotelId);
    const dirtyTask = desk.housekeepingTasks.find((task) => task.status === "dirty");
    const inspectionTask = desk.housekeepingTasks.find((task) => task.status === "inspection");
    if (!dirtyTask || !inspectionTask) throw new Error("Expected dirty and inspection demo tasks.");

    expect(() => demoFinishHousekeepingRoom(hotelId, managerSession, dirtyTask.roomId)).toThrow('Cannot finish housekeeping when task is "dirty".');
    expect(() => demoStartHousekeepingRoom(hotelId, managerSession, inspectionTask.roomId)).toThrow('Cannot start housekeeping when task is "inspection".');

    demoSendBackHousekeepingRoom(hotelId, managerSession, inspectionTask.roomId, "Mirror streaks");
    const updated = demoLoadTodayDesk(hotelId);
    const sentBackTask = updated.housekeepingTasks.find((task) => task.id === inspectionTask.id);
    expect(sentBackTask?.status).toBe("dirty");
    expect(sentBackTask?.notes).toBe("Mirror streaks");
    expect(updated.rooms.find((room) => room.id === inspectionTask.roomId)?.status).toBe("dirty");
  });

  test("invalid demo maintenance transitions reject", () => {
    const [hotelId] = demoHotels();
    const room = demoLoadTodayDesk(hotelId).rooms.find((candidate) => !["occupied", "maintenance"].includes(candidate.status));
    if (!room) throw new Error("Expected room for demo maintenance test.");

    expect(() => demoCreateMaintenanceTicket(hotelId, managerSession, maintenanceInput({ roomId: room.id, status: "pending-review" }))).toThrow("New maintenance tickets can only be created with status open, in-progress, or blocked.");
    expect(() => demoCreateMaintenanceTicket(hotelId, managerSession, maintenanceInput({ roomId: room.id, status: "resolved" }))).toThrow("New maintenance tickets can only be created with status open, in-progress, or blocked.");
    expect(() => demoCreateMaintenanceTicket(hotelId, managerSession, maintenanceInput({ roomId: room.id, status: "cancelled" }))).toThrow("New maintenance tickets can only be created with status open, in-progress, or blocked.");

    const issue = demoReportRoomIssue(hotelId, managerSession, { roomId: room.id, title: "Loose towel bar" });
    expect(() => demoUpdateMaintenanceTicket(hotelId, managerSession, issue.id, maintenanceInput({ id: issue.id, roomId: room.id, status: "open" }))).toThrow("Pending issue reports must be approved or cancelled through the issue review workflow.");

    const active = demoCreateMaintenanceTicket(hotelId, managerSession, maintenanceInput({ roomId: room.id, status: "open" }));
    demoUpdateMaintenanceTicket(hotelId, managerSession, active.id, maintenanceInput({ id: active.id, roomId: room.id, status: "resolved" }));
    expect(() => demoUpdateMaintenanceTicket(hotelId, managerSession, active.id, maintenanceInput({ id: active.id, roomId: room.id, status: "open" }))).toThrow('Cannot change maintenance status from "resolved" to "open".');
  });

  test("cross-hotel demo housekeeping paths reject without mutation", () => {
    const [firstHotel, secondHotel] = demoHotels();
    const secondDesk = demoLoadTodayDesk(secondHotel);
    const secondTask = secondDesk.housekeepingTasks.find((task) => task.status === "dirty");
    const secondCleaningTask = secondDesk.housekeepingTasks.find((task) => task.status === "cleaning");
    const secondInspectionTask = secondDesk.housekeepingTasks.find((task) => task.status === "inspection");
    const secondRoom = secondDesk.rooms.find((room) => room.id === secondTask?.roomId);
    if (!secondTask || !secondCleaningTask || !secondInspectionTask || !secondRoom) throw new Error("Expected second hotel housekeeping tasks.");

    expect(() => demoStartHousekeepingRoom(firstHotel, managerSession, secondTask.roomId)).toThrow("Housekeeping task was not found for this demo hotel.");
    expect(() => demoFinishHousekeepingRoom(firstHotel, managerSession, secondCleaningTask.roomId)).toThrow("Housekeeping task was not found for this demo hotel.");
    expect(() => demoApproveHousekeepingRoom(firstHotel, managerSession, secondInspectionTask.roomId)).toThrow("Housekeeping task was not found for this demo hotel.");
    expect(() => demoSendBackHousekeepingRoom(firstHotel, managerSession, secondInspectionTask.roomId, "Needs work")).toThrow("Housekeeping task was not found for this demo hotel.");
    expect(demoLoadTodayDesk(secondHotel).housekeepingTasks.find((task) => task.id === secondTask.id)?.status).toBe("dirty");
    expect(demoLoadTodayDesk(secondHotel).housekeepingTasks.find((task) => task.id === secondCleaningTask.id)?.status).toBe("cleaning");
    expect(demoLoadTodayDesk(secondHotel).housekeepingTasks.find((task) => task.id === secondInspectionTask.id)?.status).toBe("inspection");

    const maintenanceCount = demoLoadTodayDesk(firstHotel).maintenanceTickets.length;
    expect(() => demoReportRoomIssue(firstHotel, managerSession, { roomId: secondRoom.id, title: "Cross hotel issue" })).toThrow("Room was not found for this demo hotel.");
    expect(demoLoadTodayDesk(firstHotel).maintenanceTickets.length).toBe(maintenanceCount);
  });
});
