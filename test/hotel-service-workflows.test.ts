import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { HostedSession, MaintenanceInput, ReservationStatus, ReviewRoomIssueInput } from "@/lib/types";

type MockRoom = {
  id: string;
  number: string;
  status: string;
};

type MockReservation = {
  id: string;
  roomId: string;
  status: ReservationStatus;
};

type MockStaff = {
  id: string;
  fullName: string;
  role: string;
  active: boolean;
  clerkUserId?: string;
};

type MockHousekeepingTask = {
  id: string;
  roomId: string;
  roomNumber: string;
  title: string;
  status: string;
  dueDate: string;
  notes: string;
  assigneeStaffId?: string | null;
};

type MockMaintenanceTicket = {
  id: string;
  roomId: string;
  roomNumber: string;
  title: string;
  priority: string;
  status: string;
  dueDate: string;
};

type MockSql = {
  <T = unknown[]>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  query<T = unknown[]>(queryText: string, params?: unknown[]): Promise<T>;
};

type MockDatabase = {
  sql: MockSql;
  seedRoom: (hotelId: string, room: MockRoom) => void;
  seedReservation: (hotelId: string, reservation: MockReservation) => void;
  seedStaff: (hotelId: string, staff: MockStaff) => void;
  seedHousekeepingTask: (hotelId: string, task: MockHousekeepingTask) => void;
  seedMaintenanceTicket: (hotelId: string, ticket: MockMaintenanceTicket) => void;
  room: (hotelId: string, roomId: string) => MockRoom | undefined;
  reservation: (hotelId: string, reservationId: string) => MockReservation | undefined;
  housekeepingTasks: (hotelId: string) => MockHousekeepingTask[];
  maintenanceTicket: (hotelId: string, ticketId: string) => MockMaintenanceTicket | undefined;
  maintenanceTickets: (hotelId: string) => MockMaintenanceTicket[];
};

function normalizeQuery(raw: string) {
  return raw.replace(/\s+/g, " ").trim();
}

function createMockDatabase(): MockDatabase {
  const roomsByHotel = new Map<string, Map<string, MockRoom>>();
  const reservationsByHotel = new Map<string, Map<string, MockReservation>>();
  const staffByHotel = new Map<string, Map<string, MockStaff>>();
  const housekeepingByHotel = new Map<string, Map<string, MockHousekeepingTask>>();
  const maintenanceByHotel = new Map<string, Map<string, MockMaintenanceTicket>>();

  const getOrCreate = <T>(bucket: Map<string, Map<string, T>>, hotelId: string) => {
    let rows = bucket.get(hotelId);
    if (!rows) {
      rows = new Map<string, T>();
      bucket.set(hotelId, rows);
    }
    return rows;
  };

  const roomRow = (hotelId: string, roomId: string) => getOrCreate(roomsByHotel, hotelId).get(roomId);
  const taskRows = (hotelId: string) => getOrCreate(housekeepingByHotel, hotelId);
  const ticketRows = (hotelId: string) => getOrCreate(maintenanceByHotel, hotelId);

  function maintenancePayload(hotelId: string, ticket: MockMaintenanceTicket) {
    const room = roomRow(hotelId, ticket.roomId);
    return {
      id: ticket.id,
      roomId: ticket.roomId,
      roomNumber: room?.number ?? ticket.roomNumber,
      title: ticket.title,
      priority: ticket.priority,
      status: ticket.status,
      dueDate: ticket.dueDate,
    };
  }

  const sql = (async function <T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T> {
    const query = normalizeQuery(strings.join(""));

    if (query.includes("INSERT INTO audit_logs")) return [] as T;

    if (query.includes('SELECT id, room_id AS "roomId", status FROM reservations')) {
      const [reservationId, hotelId] = values as [string, string];
      const reservation = getOrCreate(reservationsByHotel, hotelId).get(reservationId);
      if (!reservation) return [] as T;
      return [{ id: reservation.id, roomId: reservation.roomId, status: reservation.status }] as T;
    }

    if (query.includes("UPDATE reservations SET status")) {
      const [status, , reservationId, hotelId] = values as [ReservationStatus, string, string, string];
      const reservation = getOrCreate(reservationsByHotel, hotelId).get(reservationId);
      if (reservation) reservation.status = status;
      return [] as T;
    }

    if (query.includes('SELECT full_name AS "fullName" FROM staff')) {
      const [staffId, hotelId] = values as [string, string];
      const staff = getOrCreate(staffByHotel, hotelId).get(staffId);
      if (!staff || staff.role !== "housekeeping" || !staff.active) return [] as T;
      return [{ fullName: staff.fullName }] as T;
    }

    if (query.includes("SELECT id, number, status FROM rooms")) {
      const [roomId, hotelId] = values as [string, string];
      const room = roomRow(hotelId, roomId);
      if (!room) return [] as T;
      return [{ id: room.id, number: room.number, status: room.status }] as T;
    }

    if (query.includes("SELECT id, number FROM rooms")) {
      const [roomId, hotelId] = values as [string, string];
      const room = roomRow(hotelId, roomId);
      if (!room) return [] as T;
      return [{ id: room.id, number: room.number }] as T;
    }

    if (query.includes("SELECT id FROM rooms")) {
      const [roomId, hotelId] = values as [string, string];
      const room = roomRow(hotelId, roomId);
      return (room ? [{ id: room.id }] : []) as T;
    }

    if (query.includes("UPDATE rooms SET status")) {
      const literalStatus = query.includes("status = 'occupied'")
        ? "occupied"
        : query.includes("status = 'dirty'")
          ? "dirty"
          : query.includes("status = 'cleaning'")
            ? "cleaning"
            : query.includes("status = 'ready'")
              ? "ready"
              : query.includes("status = 'maintenance'")
                ? "maintenance"
                : null;
      const dynamicStatus = literalStatus ? null : (values[0] as string);
      const status = literalStatus ?? dynamicStatus;
      const roomId = (literalStatus ? values[1] : values[2]) as string;
      const hotelId = (literalStatus ? values[2] : values[3]) as string;
      const room = roomRow(hotelId, roomId);
      if (!room) return [] as T;
      if (!status) return [] as T;
      if (query.includes("status <> 'maintenance'") && room.status === "maintenance") return [] as T;
      if (query.includes("status = 'maintenance' RETURNING id") && room.status !== "maintenance") return [] as T;
      room.status = status;
      return (query.includes("RETURNING id") ? [{ id: room.id }] : []) as T;
    }

    if (query.includes("SELECT id FROM housekeeping_tasks") && query.includes("status = 'blocked'")) {
      const [hotelId, roomId] = values as [string, string];
      const task = [...taskRows(hotelId).values()].find((candidate) => candidate.roomId === roomId && candidate.status === "blocked");
      return (task ? [{ id: task.id }] : []) as T;
    }

    if (query.includes("SELECT id FROM housekeeping_tasks")) {
      const [hotelId, roomId] = values as [string, string];
      const task = [...taskRows(hotelId).values()].find((candidate) => candidate.roomId === roomId && !["ready", "blocked"].includes(candidate.status));
      return (task ? [{ id: task.id }] : []) as T;
    }

    if (query.includes("INSERT INTO housekeeping_tasks")) {
      const hasAssignee = query.includes("assignee_staff_id");
      if (hasAssignee) {
        const [id, hotelId, roomId, assigneeStaffId, title] = values as [string, string, string, string, string, string];
        const room = roomRow(hotelId, roomId);
        taskRows(hotelId).set(id, { id, roomId, roomNumber: room?.number ?? "", title, status: "dirty", dueDate: "2026-06-01", notes: "", assigneeStaffId });
      } else {
        const [id, hotelId, roomId, titleOrDueDate, statusOrDueDate] = values as [string, string, string, string, string];
        const room = roomRow(hotelId, roomId);
        const title = query.includes("'Turn room after checkout'") ? "Turn room after checkout" : titleOrDueDate;
        const status = query.includes("'dirty'") ? "dirty" : statusOrDueDate;
        taskRows(hotelId).set(id, { id, roomId, roomNumber: room?.number ?? "", title, status, dueDate: "2026-06-01", notes: "", assigneeStaffId: null });
      }
      return [] as T;
    }

    if (query.includes("UPDATE housekeeping_tasks SET assignee_staff_id")) {
      const [assigneeStaffId, , taskId, hotelId] = values as [string, string, string, string];
      const task = taskRows(hotelId).get(taskId);
      if (task) {
        task.assigneeStaffId = assigneeStaffId;
        task.status = "dirty";
      }
      return [] as T;
    }

    if (query.includes("UPDATE housekeeping_tasks SET status")) {
      const literalStatus = query.includes("status = 'cleaning'")
        ? "cleaning"
        : query.includes("status = 'inspection'")
          ? "inspection"
          : query.includes("status = 'ready'")
            ? "ready"
            : query.includes("status = 'blocked'")
              ? "blocked"
              : query.includes("status = 'dirty'")
                ? "dirty"
                : null;
      const hasDynamicNotes = query.includes("notes = ,");
      const notes = hasDynamicNotes ? (values[0] as string) : undefined;
      const taskId = (hasDynamicNotes ? values[2] : values[1]) as string;
      const hotelId = (hasDynamicNotes ? values[3] : values[2]) as string;
      const task = taskRows(hotelId).get(taskId);
      if (task && literalStatus) {
        task.status = literalStatus;
        if (notes !== undefined) task.notes = notes;
        if (literalStatus === "ready") task.notes = "";
      }
      return [] as T;
    }

    if (query.includes("SELECT id FROM maintenance_tickets WHERE id")) {
      const [ticketId, hotelId] = values as [string, string];
      const ticket = ticketRows(hotelId).get(ticketId);
      return (ticket ? [{ id: ticket.id }] : []) as T;
    }

    if (query.includes("INSERT INTO maintenance_tickets")) {
      const [id, hotelId, roomId, title, priorityOrDueDate, statusOrCreatedAt, dueDate] = values as [string, string, string, string, string, string, string];
      const room = roomRow(hotelId, roomId);
      const priority = query.includes("'medium'") ? "medium" : priorityOrDueDate;
      const status = query.includes("'pending-review'") ? "pending-review" : statusOrCreatedAt;
      ticketRows(hotelId).set(id, { id, roomId, roomNumber: room?.number ?? "", title, priority, status, dueDate: dueDate ?? "2026-06-01" });
      return [] as T;
    }

    if (query.includes("SELECT COUNT(*) AS count FROM maintenance_tickets")) {
      const [hotelId, roomId] = values as [string, string];
      const active = [...ticketRows(hotelId).values()].filter((ticket) => ticket.roomId === roomId && !["resolved", "cancelled"].includes(ticket.status));
      return [{ count: String(active.length) }] as T;
    }

    if (query.includes("UPDATE maintenance_tickets SET room_id")) {
      const [roomId, title, priority, status, dueDate, , ticketId, hotelId] = values as [string, string, string, string, string, string, string, string];
      const ticket = ticketRows(hotelId).get(ticketId);
      const room = roomRow(hotelId, roomId);
      if (ticket) {
        ticket.roomId = roomId;
        ticket.roomNumber = room?.number ?? ticket.roomNumber;
        ticket.title = title;
        ticket.priority = priority;
        ticket.status = status;
        ticket.dueDate = dueDate;
      }
      return [] as T;
    }

    if (query.includes('SELECT id, room_id AS "roomId", status FROM maintenance_tickets')) {
      const [ticketId, hotelId] = values as [string, string];
      const ticket = ticketRows(hotelId).get(ticketId);
      if (!ticket) return [] as T;
      return [{ id: ticket.id, roomId: ticket.roomId, status: ticket.status }] as T;
    }

    if (query.includes("UPDATE maintenance_tickets SET title")) {
      const [title, priority, , ticketId, hotelId] = values as [string, string, string, string, string];
      const ticket = ticketRows(hotelId).get(ticketId);
      if (ticket) {
        ticket.title = title;
        ticket.priority = priority;
        ticket.status = "open";
      }
      return [] as T;
    }

    if (query.includes("UPDATE maintenance_tickets SET status = 'cancelled'")) {
      const [, ticketId, hotelId] = values as [string, string, string];
      const ticket = ticketRows(hotelId).get(ticketId);
      if (ticket) ticket.status = "cancelled";
      return [] as T;
    }

    return [] as T;
  }) as MockSql;

  sql.query = async function <T>(queryText: string, params: unknown[] = []): Promise<T> {
    const query = normalizeQuery(queryText);
    if (query.includes("SELECT ht.id, ht.status")) {
      const [hotelId, roomId, staffUserId] = params as [string, string, string | undefined];
      const task = [...taskRows(hotelId).values()].find((candidate) => candidate.roomId === roomId && !["ready", "blocked"].includes(candidate.status));
      if (!task) return [] as T;
      if (staffUserId) {
        const staff = task.assigneeStaffId ? getOrCreate(staffByHotel, hotelId).get(task.assigneeStaffId) : null;
        if (task.assigneeStaffId !== staffUserId && staff?.clerkUserId !== staffUserId) return [] as T;
      }
      return [{ id: task.id, status: task.status, roomId: task.roomId, assigneeStaffId: task.assigneeStaffId ?? null }] as T;
    }

    if (query.includes("FROM maintenance_tickets mt")) {
      const [hotelId, ticketId] = params as [string, string | undefined];
      const tickets = [...ticketRows(hotelId).values()];
      const filtered = ticketId ? tickets.filter((ticket) => ticket.id === ticketId) : tickets;
      return filtered.map((ticket) => maintenancePayload(hotelId, ticket)) as T;
    }

    return [] as T;
  };

  return {
    sql,
    seedRoom: (hotelId, room) => getOrCreate(roomsByHotel, hotelId).set(room.id, room),
    seedReservation: (hotelId, reservation) => getOrCreate(reservationsByHotel, hotelId).set(reservation.id, reservation),
    seedStaff: (hotelId, staff) => getOrCreate(staffByHotel, hotelId).set(staff.id, staff),
    seedHousekeepingTask: (hotelId, task) => getOrCreate(housekeepingByHotel, hotelId).set(task.id, task),
    seedMaintenanceTicket: (hotelId, ticket) => getOrCreate(maintenanceByHotel, hotelId).set(ticket.id, ticket),
    room: (hotelId, roomId) => roomRow(hotelId, roomId),
    reservation: (hotelId, reservationId) => getOrCreate(reservationsByHotel, hotelId).get(reservationId),
    housekeepingTasks: (hotelId) => [...taskRows(hotelId).values()],
    maintenanceTicket: (hotelId, ticketId) => ticketRows(hotelId).get(ticketId),
    maintenanceTickets: (hotelId) => [...ticketRows(hotelId).values()],
  };
}

const managerSession: HostedSession = {
  userId: "manager-user",
  displayName: "Manager",
  organizationId: "org",
  role: "manager",
};

const housekeeperSession: HostedSession = {
  userId: "hk-user",
  displayName: "Housekeeper",
  organizationId: "org",
  role: "housekeeping",
};

const adminHousekeeperPreviewSession: HostedSession = {
  userId: "admin-user",
  displayName: "Admin",
  organizationId: "org",
  role: "housekeeping",
  actualRole: "owner",
  previewRole: "housekeeping",
  previewStaffId: "staff-hk",
  rolePreviewEnabled: true,
};

let mockDb: MockDatabase;

mock.module("@/lib/authz", () => ({
  isDemoMode: () => false,
  requireHotelSession: async () => {
    throw new Error("requireHotelSession is not used by this test file.");
  },
}));
mock.module("@/lib/db", () => ({
  getSql: () => mockDb.sql,
}));
mock.module("server-only", () => ({}));

const {
  approveHousekeepingRoom,
  approveRoomIssueReport,
  assignHousekeepingTask,
  cancelRoomIssueReport,
  createMaintenanceTicket,
  finishHousekeepingRoom,
  reportRoomIssue,
  sendBackHousekeepingRoom,
  startHousekeepingRoom,
  updateMaintenanceTicket,
  updateReservationStatus,
} = await import("@/lib/hotel-service");

const hotelA = "hotel-a";
const hotelB = "hotel-b";
const roomA = "room-a";
const roomB = "room-b";

const maintenanceInput = (overrides: Partial<MaintenanceInput> = {}): MaintenanceInput => ({
  roomId: roomA,
  title: "Repair sink",
  priority: "high",
  status: "open",
  dueDate: "2026-06-01",
  ...overrides,
});

const reviewIssueInput = (ticketId: string, overrides: Partial<ReviewRoomIssueInput> = {}): ReviewRoomIssueInput => ({
  ticketId,
  title: "Approved issue",
  priority: "medium",
  ...overrides,
});

beforeEach(() => {
  mockDb = createMockDatabase();
  mockDb.seedRoom(hotelA, { id: roomA, number: "101", status: "available" });
  mockDb.seedRoom(hotelB, { id: roomB, number: "201", status: "available" });
  mockDb.seedStaff(hotelA, { id: "staff-hk", fullName: "Ava Housekeeper", role: "housekeeping", active: true, clerkUserId: "hk-user" });
});

describe("reservation workflow coverage", () => {
  test("checked-in marks the active hotel room occupied", async () => {
    mockDb.seedReservation(hotelA, { id: "res-a", roomId: roomA, status: "confirmed" });

    await updateReservationStatus(hotelA, managerSession, "res-a", "checked-in");

    expect(mockDb.reservation(hotelA, "res-a")?.status).toBe("checked-in");
    expect(mockDb.room(hotelA, roomA)?.status).toBe("occupied");
  });

  test("checked-out marks room dirty and creates turnover housekeeping task", async () => {
    mockDb.seedReservation(hotelA, { id: "res-a", roomId: roomA, status: "checked-in" });

    await updateReservationStatus(hotelA, managerSession, "res-a", "checked-out");

    expect(mockDb.reservation(hotelA, "res-a")?.status).toBe("checked-out");
    expect(mockDb.room(hotelA, roomA)?.status).toBe("dirty");
    expect(mockDb.housekeepingTasks(hotelA).length).toBe(1);
    expect(mockDb.housekeepingTasks(hotelA)[0].title).toBe("Turn room after checkout");
  });

  test("missing or cross-hotel reservation does not mutate active hotel state", async () => {
    mockDb.seedReservation(hotelB, { id: "res-cross", roomId: roomB, status: "confirmed" });

    await expect(updateReservationStatus(hotelA, managerSession, "res-cross", "checked-in")).rejects.toThrow("Reservation was not found for this hotel.");

    expect(mockDb.room(hotelA, roomA)?.status).toBe("available");
    expect(mockDb.reservation(hotelB, "res-cross")?.status).toBe("confirmed");
  });

  test("invalid reservation status jumps reject without mutation", async () => {
    mockDb.seedReservation(hotelA, { id: "res-pending", roomId: roomA, status: "pending" });
    mockDb.seedReservation(hotelA, { id: "res-out", roomId: roomA, status: "checked-out" });
    mockDb.seedReservation(hotelA, { id: "res-cancelled", roomId: roomA, status: "cancelled" });

    await expect(updateReservationStatus(hotelA, managerSession, "res-pending", "checked-out")).rejects.toThrow('Cannot change reservation from "pending" to "checked-out".');
    await expect(updateReservationStatus(hotelA, managerSession, "res-out", "checked-in")).rejects.toThrow('Cannot change reservation from "checked-out" to "checked-in".');
    await expect(updateReservationStatus(hotelA, managerSession, "res-cancelled", "checked-in")).rejects.toThrow('Cannot change reservation from "cancelled" to "checked-in".');

    expect(mockDb.reservation(hotelA, "res-pending")?.status).toBe("pending");
    expect(mockDb.reservation(hotelA, "res-out")?.status).toBe("checked-out");
    expect(mockDb.reservation(hotelA, "res-cancelled")?.status).toBe("cancelled");
    expect(mockDb.room(hotelA, roomA)?.status).toBe("available");
    expect(mockDb.housekeepingTasks(hotelA).length).toBe(0);
  });

  test("same-status reservation update is idempotent", async () => {
    mockDb.seedRoom(hotelA, { id: roomA, number: "101", status: "dirty" });
    mockDb.seedReservation(hotelA, { id: "res-out", roomId: roomA, status: "checked-out" });

    await updateReservationStatus(hotelA, managerSession, "res-out", "checked-out");

    expect(mockDb.reservation(hotelA, "res-out")?.status).toBe("checked-out");
    expect(mockDb.room(hotelA, roomA)?.status).toBe("dirty");
    expect(mockDb.housekeepingTasks(hotelA).length).toBe(0);
  });
});

describe("housekeeping workflow coverage", () => {
  test("assignment creates a task, assigns same-hotel staff, and marks room dirty", async () => {
    await assignHousekeepingTask(hotelA, managerSession, roomA, "staff-hk");

    const task = mockDb.housekeepingTasks(hotelA)[0];
    expect(task.roomId).toBe(roomA);
    expect(task.assigneeStaffId).toBe("staff-hk");
    expect(task.status).toBe("dirty");
    expect(mockDb.room(hotelA, roomA)?.status).toBe("dirty");
  });

  test("assignment rejects occupied and maintenance rooms", async () => {
    mockDb.seedRoom(hotelA, { id: "occupied-room", number: "102", status: "occupied" });
    mockDb.seedRoom(hotelA, { id: "maintenance-room", number: "103", status: "maintenance" });

    await expect(assignHousekeepingTask(hotelA, managerSession, "occupied-room", "staff-hk")).rejects.toThrow("Occupied or maintenance rooms cannot be assigned.");
    await expect(assignHousekeepingTask(hotelA, managerSession, "maintenance-room", "staff-hk")).rejects.toThrow("Occupied or maintenance rooms cannot be assigned.");
  });

  test("assigned housekeeper can start and finish room work", async () => {
    mockDb.seedHousekeepingTask(hotelA, { id: "task-a", roomId: roomA, roomNumber: "101", title: "Clean room", status: "dirty", dueDate: "2026-06-01", notes: "", assigneeStaffId: "staff-hk" });

    await startHousekeepingRoom(hotelA, housekeeperSession, roomA);
    expect(mockDb.housekeepingTasks(hotelA)[0].status).toBe("cleaning");
    expect(mockDb.room(hotelA, roomA)?.status).toBe("cleaning");

    await finishHousekeepingRoom(hotelA, housekeeperSession, roomA);
    expect(mockDb.housekeepingTasks(hotelA)[0].status).toBe("inspection");
  });

  test("admin housekeeper preview uses selected staff assignment", async () => {
    mockDb.seedHousekeepingTask(hotelA, { id: "task-a", roomId: roomA, roomNumber: "101", title: "Clean room", status: "dirty", dueDate: "2026-06-01", notes: "", assigneeStaffId: "staff-hk" });

    await startHousekeepingRoom(hotelA, adminHousekeeperPreviewSession, roomA);

    expect(mockDb.housekeepingTasks(hotelA)[0].status).toBe("cleaning");
    expect(mockDb.room(hotelA, roomA)?.status).toBe("cleaning");
  });

  test("unassigned housekeeper cannot access another room task", async () => {
    mockDb.seedHousekeepingTask(hotelA, { id: "task-a", roomId: roomA, roomNumber: "101", title: "Clean room", status: "dirty", dueDate: "2026-06-01", notes: "", assigneeStaffId: "other-staff" });

    await expect(startHousekeepingRoom(hotelA, housekeeperSession, roomA)).rejects.toThrow("Housekeeping task was not found.");
  });

  test("invalid housekeeping actions reject without mutation", async () => {
    const cases = [
      { roomId: "dirty-room", initial: "dirty", action: () => finishHousekeepingRoom(hotelA, managerSession, "dirty-room"), message: 'Cannot finish housekeeping when task is "dirty".' },
      { roomId: "inspection-room", initial: "inspection", action: () => startHousekeepingRoom(hotelA, managerSession, "inspection-room"), message: 'Cannot start housekeeping when task is "inspection".' },
      { roomId: "cleaning-room", initial: "cleaning", action: () => approveHousekeepingRoom(hotelA, managerSession, "cleaning-room"), message: 'Cannot approve housekeeping when task is "cleaning".' },
      { roomId: "sendback-dirty-room", initial: "dirty", action: () => sendBackHousekeepingRoom(hotelA, managerSession, "sendback-dirty-room", "Needs work"), message: 'Cannot send back housekeeping when task is "dirty".' },
      { roomId: "sendback-cleaning-room", initial: "cleaning", action: () => sendBackHousekeepingRoom(hotelA, managerSession, "sendback-cleaning-room", "Needs work"), message: 'Cannot send back housekeeping when task is "cleaning".' },
    ];

    for (const item of cases) {
      mockDb.seedRoom(hotelA, { id: item.roomId, number: item.roomId, status: item.initial });
      mockDb.seedHousekeepingTask(hotelA, { id: `task-${item.roomId}`, roomId: item.roomId, roomNumber: item.roomId, title: "Clean room", status: item.initial, dueDate: "2026-06-01", notes: "" });

      await expect(item.action()).rejects.toThrow(item.message);
      expect(mockDb.housekeepingTasks(hotelA).find((task) => task.roomId === item.roomId)?.status).toBe(item.initial);
      expect(mockDb.room(hotelA, item.roomId)?.status).toBe(item.initial);
    }
  });

  test("cross-hotel housekeeping actions reject without mutating other hotel state", async () => {
    mockDb.seedStaff(hotelB, { id: "staff-cross", fullName: "Cross Hotel Housekeeper", role: "housekeeping", active: true });
    mockDb.seedHousekeepingTask(hotelB, { id: "task-b-dirty", roomId: roomB, roomNumber: "201", title: "Clean room", status: "dirty", dueDate: "2026-06-01", notes: "" });

    await expect(assignHousekeepingTask(hotelA, managerSession, roomB, "staff-hk")).rejects.toThrow("Room was not found for this hotel.");
    await expect(assignHousekeepingTask(hotelA, managerSession, roomA, "staff-cross")).rejects.toThrow("Housekeeper was not found for this hotel.");
    await expect(startHousekeepingRoom(hotelA, managerSession, roomB)).rejects.toThrow("Housekeeping task was not found.");
    expect(mockDb.housekeepingTasks(hotelB).find((task) => task.id === "task-b-dirty")?.status).toBe("dirty");

    mockDb.seedHousekeepingTask(hotelB, { id: "task-b-cleaning", roomId: roomB, roomNumber: "201", title: "Clean room", status: "cleaning", dueDate: "2026-06-01", notes: "" });
    await expect(finishHousekeepingRoom(hotelA, managerSession, roomB)).rejects.toThrow("Housekeeping task was not found.");
    expect(mockDb.housekeepingTasks(hotelB).find((task) => task.id === "task-b-cleaning")?.status).toBe("cleaning");

    mockDb.seedHousekeepingTask(hotelB, { id: "task-b-inspection", roomId: roomB, roomNumber: "201", title: "Clean room", status: "inspection", dueDate: "2026-06-01", notes: "" });
    await expect(approveHousekeepingRoom(hotelA, managerSession, roomB)).rejects.toThrow("Housekeeping task was not found.");
    await expect(sendBackHousekeepingRoom(hotelA, managerSession, roomB, "Needs work")).rejects.toThrow("Housekeeping task was not found.");
    expect(mockDb.housekeepingTasks(hotelB).find((task) => task.id === "task-b-inspection")?.status).toBe("inspection");
  });

  test("supervisor approval and send-back update task and room states", async () => {
    mockDb.seedHousekeepingTask(hotelA, { id: "task-a", roomId: roomA, roomNumber: "101", title: "Clean room", status: "inspection", dueDate: "2026-06-01", notes: "", assigneeStaffId: "staff-hk" });

    await approveHousekeepingRoom(hotelA, managerSession, roomA);
    expect(mockDb.housekeepingTasks(hotelA)[0].status).toBe("ready");
    expect(mockDb.room(hotelA, roomA)?.status).toBe("ready");

    mockDb.seedHousekeepingTask(hotelA, { id: "task-b", roomId: roomA, roomNumber: "101", title: "Clean again", status: "inspection", dueDate: "2026-06-01", notes: "", assigneeStaffId: "staff-hk" });
    await sendBackHousekeepingRoom(hotelA, managerSession, roomA, "Mirror streaks");
    expect(mockDb.housekeepingTasks(hotelA).find((task) => task.id === "task-b")?.status).toBe("dirty");
    expect(mockDb.housekeepingTasks(hotelA).find((task) => task.id === "task-b")?.notes).toBe("Mirror streaks");
    expect(mockDb.room(hotelA, roomA)?.status).toBe("dirty");
  });
});

describe("maintenance workflow coverage", () => {
  test("creating active ticket marks the same-hotel room maintenance", async () => {
    const created = await createMaintenanceTicket(hotelA, managerSession, maintenanceInput());

    expect(mockDb.maintenanceTicket(hotelA, created.id)?.status).toBe("open");
    expect(mockDb.room(hotelA, roomA)?.status).toBe("maintenance");
  });

  test("resolving the last active ticket releases a maintenance room to dirty", async () => {
    mockDb.seedRoom(hotelA, { id: roomA, number: "101", status: "maintenance" });
    mockDb.seedMaintenanceTicket(hotelA, { id: "ticket-a", roomId: roomA, roomNumber: "101", title: "Repair sink", priority: "high", status: "open", dueDate: "2026-06-01" });

    await updateMaintenanceTicket(hotelA, managerSession, "ticket-a", maintenanceInput({ id: "ticket-a", status: "resolved" }));

    expect(mockDb.maintenanceTicket(hotelA, "ticket-a")?.status).toBe("resolved");
    expect(mockDb.room(hotelA, roomA)?.status).toBe("dirty");
  });

  test("pending issue approval opens ticket and marks room maintenance", async () => {
    mockDb.seedMaintenanceTicket(hotelA, { id: "issue-a", roomId: roomA, roomNumber: "101", title: "Loose towel bar", priority: "medium", status: "pending-review", dueDate: "2026-06-01" });

    await approveRoomIssueReport(hotelA, managerSession, reviewIssueInput("issue-a"));

    expect(mockDb.maintenanceTicket(hotelA, "issue-a")?.status).toBe("open");
    expect(mockDb.room(hotelA, roomA)?.status).toBe("maintenance");
  });

  test("pending issue cancellation returns blocked housekeeping work to dirty", async () => {
    mockDb.seedMaintenanceTicket(hotelA, { id: "issue-a", roomId: roomA, roomNumber: "101", title: "Loose towel bar", priority: "medium", status: "pending-review", dueDate: "2026-06-01" });
    mockDb.seedHousekeepingTask(hotelA, { id: "task-a", roomId: roomA, roomNumber: "101", title: "Clean room", status: "blocked", dueDate: "2026-06-01", notes: "Issue" });

    await cancelRoomIssueReport(hotelA, managerSession, "issue-a");

    expect(mockDb.maintenanceTicket(hotelA, "issue-a")?.status).toBe("cancelled");
    expect(mockDb.housekeepingTasks(hotelA)[0].status).toBe("dirty");
  });

  test("cross-hotel room and ticket IDs are rejected without mutation", async () => {
    mockDb.seedMaintenanceTicket(hotelB, { id: "ticket-cross", roomId: roomB, roomNumber: "201", title: "Other hotel", priority: "low", status: "open", dueDate: "2026-06-01" });

    await expect(createMaintenanceTicket(hotelA, managerSession, maintenanceInput({ roomId: roomB }))).rejects.toThrow("Room was not found for this hotel.");
    await expect(updateMaintenanceTicket(hotelA, managerSession, "ticket-cross", maintenanceInput({ id: "ticket-cross" }))).rejects.toThrow("Maintenance ticket was not found for this hotel.");

    expect(mockDb.room(hotelA, roomA)?.status).toBe("available");
    expect(mockDb.maintenanceTicket(hotelB, "ticket-cross")?.status).toBe("open");
  });

  test("reported issue can block active housekeeping work", async () => {
    mockDb.seedHousekeepingTask(hotelA, { id: "task-a", roomId: roomA, roomNumber: "101", title: "Clean room", status: "dirty", dueDate: "2026-06-01", notes: "" });

    const ticket = await reportRoomIssue(hotelA, housekeeperSession, { roomId: roomA, title: "Broken lamp" });

    expect(ticket.status).toBe("pending-review");
    expect(mockDb.housekeepingTasks(hotelA)[0].status).toBe("blocked");
    expect(mockDb.housekeepingTasks(hotelA)[0].notes).toBe("Broken lamp");
  });

  test("cross-hotel room issue reporting rejects without creating tickets", async () => {
    await expect(reportRoomIssue(hotelA, housekeeperSession, { roomId: roomB, title: "Broken lamp" })).rejects.toThrow("Room was not found for this hotel.");

    expect(mockDb.maintenanceTickets(hotelA).length).toBe(0);
    expect(mockDb.maintenanceTickets(hotelB).length).toBe(0);
  });

  test("invalid maintenance creation statuses reject", async () => {
    for (const status of ["pending-review", "resolved", "cancelled"] as const) {
      await expect(createMaintenanceTicket(hotelA, managerSession, maintenanceInput({ status }))).rejects.toThrow("New maintenance tickets can only be created with status open, in-progress, or blocked.");
    }

    expect(mockDb.maintenanceTickets(hotelA).length).toBe(0);
    expect(mockDb.room(hotelA, roomA)?.status).toBe("available");
  });

  test("invalid maintenance update transitions reject without mutation", async () => {
    mockDb.seedMaintenanceTicket(hotelA, { id: "issue-a", roomId: roomA, roomNumber: "101", title: "Pending review", priority: "medium", status: "pending-review", dueDate: "2026-06-01" });
    mockDb.seedMaintenanceTicket(hotelA, { id: "ticket-a", roomId: roomA, roomNumber: "101", title: "Active", priority: "high", status: "open", dueDate: "2026-06-01" });
    mockDb.seedMaintenanceTicket(hotelA, { id: "resolved-a", roomId: roomA, roomNumber: "101", title: "Done", priority: "low", status: "resolved", dueDate: "2026-06-01" });
    mockDb.seedRoom(hotelA, { id: "room-other", number: "102", status: "available" });

    await expect(updateMaintenanceTicket(hotelA, managerSession, "issue-a", maintenanceInput({ id: "issue-a", status: "open" }))).rejects.toThrow("Pending issue reports must be approved or cancelled through the issue review workflow.");
    await expect(updateMaintenanceTicket(hotelA, managerSession, "ticket-a", maintenanceInput({ id: "ticket-a", status: "pending-review" }))).rejects.toThrow('Cannot change maintenance status from "open" to "pending-review".');
    await expect(updateMaintenanceTicket(hotelA, managerSession, "resolved-a", maintenanceInput({ id: "resolved-a", status: "open" }))).rejects.toThrow('Cannot change maintenance status from "resolved" to "open".');
    await expect(updateMaintenanceTicket(hotelA, managerSession, "resolved-a", maintenanceInput({ id: "resolved-a", roomId: "room-other", status: "resolved" }))).rejects.toThrow("Closed maintenance tickets cannot be moved to another room.");

    expect(mockDb.maintenanceTicket(hotelA, "issue-a")?.status).toBe("pending-review");
    expect(mockDb.maintenanceTicket(hotelA, "ticket-a")?.status).toBe("open");
    expect(mockDb.maintenanceTicket(hotelA, "resolved-a")?.roomId).toBe(roomA);
    expect(mockDb.maintenanceTicket(hotelA, "resolved-a")?.status).toBe("resolved");
  });

  test("valid maintenance active and terminal transitions pass", async () => {
    mockDb.seedRoom(hotelA, { id: roomA, number: "101", status: "maintenance" });
    mockDb.seedMaintenanceTicket(hotelA, { id: "ticket-a", roomId: roomA, roomNumber: "101", title: "Repair sink", priority: "high", status: "open", dueDate: "2026-06-01" });

    await updateMaintenanceTicket(hotelA, managerSession, "ticket-a", maintenanceInput({ id: "ticket-a", status: "in-progress" }));
    expect(mockDb.maintenanceTicket(hotelA, "ticket-a")?.status).toBe("in-progress");

    await updateMaintenanceTicket(hotelA, managerSession, "ticket-a", maintenanceInput({ id: "ticket-a", status: "blocked" }));
    expect(mockDb.maintenanceTicket(hotelA, "ticket-a")?.status).toBe("blocked");

    await updateMaintenanceTicket(hotelA, managerSession, "ticket-a", maintenanceInput({ id: "ticket-a", status: "cancelled" }));
    expect(mockDb.maintenanceTicket(hotelA, "ticket-a")?.status).toBe("cancelled");
    expect(mockDb.room(hotelA, roomA)?.status).toBe("dirty");
  });
});
