"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { ArrowRight, BedDouble, CheckCircle2, ClipboardCheck, Download, LogOut, Play, Plus, Save, Search, Wrench, XCircle } from "lucide-react";
import { Money, StatusPill } from "@/components/format";
import { hotelBackupFilename, hotelExportFilename } from "@/lib/downloads";
import { roleLabels } from "@/lib/roles";
import type {
  AuditLogEntry,
  CountRow,
  HostedSession,
  Hotel,
  HousekeepingTask,
  MaintenancePriority,
  MaintenanceStatus,
  MaintenanceTicket,
  ManagerDashboardPayload,
  ReservationStatus,
  ReservationSummary,
  Room,
  SearchResults,
  StaffMember,
  TodayDeskPayload,
} from "@/lib/types";

type MaintenanceUpdatePayload = {
  roomId: string;
  title: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  dueDate: string;
};

export function HotelWorkspace({
  hotel,
  session,
  today,
  manager,
  housekeepers,
  focusedHousekeepingMode = false,
}: {
  hotel: Hotel;
  session: HostedSession;
  today: TodayDeskPayload;
  manager: ManagerDashboardPayload | null;
  housekeepers: StaffMember[];
  focusedHousekeepingMode?: boolean;
}) {
  const router = useRouter();
  const role = session.role;
  const isManagerView = role === "owner" || role === "manager";
  const [message, setMessage] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [pending, startTransition] = useTransition();
  const availableRooms = useMemo(
    () => today.rooms.filter((room) => ["available", "ready", "dirty"].includes(room.status)),
    [today.rooms],
  );
  const pendingIssueReports = today.maintenanceTickets.filter((ticket) => ticket.status === "pending-review");

  async function request(path: string, init?: RequestInit) {
    setMessage("");
    const response = await fetch(path, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Request failed.");
    }
    return response;
  }

  function refreshWith(action: () => Promise<void>, success: string) {
    startTransition(() => {
      void action()
        .then(() => {
          setMessage(success);
          router.refresh();
        })
        .catch((error) => setMessage(error instanceof Error ? error.message : String(error)));
    });
  }

  function logoutDemoSession() {
    startTransition(() => {
      void fetch("/api/session", { method: "DELETE" }).finally(() => {
        router.push("/sign-in");
        router.refresh();
      });
    });
  }

  function searchFrontDesk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const query = String(form.get("query") ?? "");
    refreshWith(
      async () => {
        const response = await request(`/api/hotels/${hotel.id}/search?q=${encodeURIComponent(query)}`, {
          method: "GET",
          headers: {},
        });
        setSearchResults((await response.json()) as SearchResults);
      },
      "Search completed.",
    );
  }

  function createWalkIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    const form = new FormData(target);
    refreshWith(
      async () => {
        await request(`/api/hotels/${hotel.id}/walk-ins`, {
          method: "POST",
          body: JSON.stringify({
            fullName: String(form.get("fullName") ?? ""),
            email: String(form.get("email") ?? ""),
            phone: String(form.get("phone") ?? ""),
            guestNotes: String(form.get("guestNotes") ?? ""),
            roomId: String(form.get("roomId") ?? ""),
            checkIn: String(form.get("checkIn") ?? today.today),
            checkOut: String(form.get("checkOut") ?? today.today),
            adults: Number(form.get("adults") ?? 1),
            children: Number(form.get("children") ?? 0),
            nightlyRateCents: Number(form.get("nightlyRateCents") ?? 0),
            notes: String(form.get("notes") ?? ""),
          }),
        });
        target.reset();
      },
      "Walk-in reservation created.",
    );
  }

  function saveGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    const form = new FormData(target);
    refreshWith(
      async () => {
        await request(`/api/hotels/${hotel.id}/guests`, {
          method: "POST",
          body: JSON.stringify({
            fullName: String(form.get("fullName") ?? ""),
            email: String(form.get("email") ?? ""),
            phone: String(form.get("phone") ?? ""),
            notes: String(form.get("notes") ?? ""),
          }),
        });
        target.reset();
      },
      "Guest record saved.",
    );
  }

  function updateReservationStatus(id: string, status: ReservationStatus) {
    refreshWith(
      () =>
        request(`/api/hotels/${hotel.id}/reservations/${id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }).then(() => undefined),
      "Reservation status updated.",
    );
  }

  function assignHousekeeping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    refreshWith(
      () =>
        request(`/api/hotels/${hotel.id}/housekeeping/assign`, {
          method: "POST",
          body: JSON.stringify({
            roomId: String(form.get("roomId") ?? ""),
            staffId: String(form.get("staffId") ?? ""),
          }),
        }).then(() => undefined),
      "Housekeeping task assigned.",
    );
  }

  function roomAction(action: "start" | "finish" | "approve" | "send-back", roomId: string) {
    refreshWith(
      () =>
        request(`/api/hotels/${hotel.id}/housekeeping/${action}`, {
          method: "POST",
          body: JSON.stringify(action === "send-back" ? { roomId, reason: "Supervisor send-back" } : { roomId }),
        }).then(() => undefined),
      "Housekeeping updated.",
    );
  }

  function createMaintenance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    const form = new FormData(target);
    refreshWith(
      async () => {
        await request(`/api/hotels/${hotel.id}/maintenance/tickets`, {
          method: "POST",
          body: JSON.stringify({
            roomId: String(form.get("roomId") ?? ""),
            title: String(form.get("title") ?? ""),
            priority: String(form.get("priority") ?? "medium"),
            status: String(form.get("status") ?? "open"),
            dueDate: String(form.get("dueDate") ?? today.today),
          }),
        });
        target.reset();
      },
      "Maintenance ticket saved.",
    );
  }

  function updateMaintenanceTicket(ticketId: string, input: MaintenanceUpdatePayload, success = "Maintenance ticket updated.") {
    refreshWith(
      () =>
        request(`/api/hotels/${hotel.id}/maintenance/tickets/${ticketId}`, {
          method: "PATCH",
          body: JSON.stringify({ id: ticketId, ...input }),
        }).then(() => undefined),
      success,
    );
  }

  function reportRoomIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    const form = new FormData(target);
    refreshWith(
      async () => {
        await request(`/api/hotels/${hotel.id}/maintenance/report`, {
          method: "POST",
          body: JSON.stringify({
            roomId: String(form.get("roomId") ?? ""),
            title: String(form.get("title") ?? ""),
          }),
        });
        target.reset();
      },
      "Room issue sent for review.",
    );
  }

  function reviewIssue(ticketId: string, action: "approve" | "cancel", title?: string, priority?: MaintenancePriority) {
    refreshWith(
      () =>
        request(`/api/hotels/${hotel.id}/maintenance/report/${action}`, {
          method: "POST",
          body:
            action === "approve"
              ? JSON.stringify({ ticketId, title: title || "Approved maintenance issue", priority: priority ?? "medium" })
              : JSON.stringify({ ticketId }),
        }).then(() => undefined),
      action === "approve" ? "Issue approved for maintenance." : "Issue report cancelled.",
    );
  }

  if (role === "housekeeping") {
    return (
      <main className="housekeeping-main">
        <HousekeepingStaffWorkspace
          session={session}
          today={today}
          message={message}
          pending={pending}
          onLogout={focusedHousekeepingMode ? logoutDemoSession : undefined}
          onRoomAction={roomAction}
          onReportIssue={reportRoomIssue}
        />
      </main>
    );
  }

  return (
    <main className="container stack">
      <div className="page-title">
        <div>
          <p className="eyebrow">{roleLabels[role]} workspace</p>
          <h1>{hotel.name}</h1>
          <p className="muted">Data shown here is scoped to this hotel and filtered for this role.</p>
        </div>
      </div>

      {message ? <p className={message.includes("failed") || message.includes("cannot") ? "error-text" : "notice"}>{message}</p> : null}

      {isManagerView ? (
        <ManagerWorkspace
          hotelId={hotel.id}
          hotelName={hotel.name}
          today={today}
          manager={manager}
          pendingIssueReports={pendingIssueReports}
          pending={pending}
          onReviewIssue={reviewIssue}
        />
      ) : null}
      {role === "front-desk" ? (
        <FrontDeskWorkspace
          today={today}
          availableRooms={availableRooms}
          searchResults={searchResults}
          pending={pending}
          onSearch={searchFrontDesk}
          onWalkIn={createWalkIn}
          onSaveGuest={saveGuest}
          onStatus={updateReservationStatus}
        />
      ) : null}
      {role === "housekeeping-supervisor" ? (
        <HousekeepingSupervisorWorkspace
          today={today}
          housekeepers={housekeepers}
          pendingIssueReports={pendingIssueReports}
          pending={pending}
          onAssign={assignHousekeeping}
          onRoomAction={roomAction}
          onReviewIssue={reviewIssue}
        />
      ) : null}
      {role === "maintenance" ? (
        <MaintenanceWorkspace today={today} pending={pending} onCreateMaintenance={createMaintenance} onUpdateMaintenance={updateMaintenanceTicket} />
      ) : null}
    </main>
  );
}

function ManagerWorkspace({
  hotelId,
  hotelName,
  today,
  manager,
  pendingIssueReports,
  pending,
  onReviewIssue,
}: {
  hotelId: string;
  hotelName: string;
  today: TodayDeskPayload;
  manager: ManagerDashboardPayload | null;
  pendingIssueReports: MaintenanceTicket[];
  pending: boolean;
  onReviewIssue: (ticketId: string, action: "approve" | "cancel", title?: string, priority?: MaintenancePriority) => void;
}) {
  if (!manager) return <p className="notice">Manager data is not available for this role.</p>;

  return (
    <>
      <section className="grid metric-grid">
        <Metric label="Occupancy" value={`${manager.stats.occupancyPercent}%`} />
        <Metric label="Arrivals" value={String(manager.stats.arrivalsToday)} />
        <Metric label="Departures" value={String(manager.stats.departuresToday)} />
        <Metric label="In house" value={String(manager.stats.inHouse)} />
        <Metric label="Open maintenance" value={String(manager.stats.openMaintenance)} />
        <Metric label="Revenue" value={<Money cents={manager.stats.revenueCents} />} />
      </section>

      <div className="workspace-grid">
        <section className="stack">
          <Panel title="Operational queues">
            <ReservationTable rows={[...today.arrivals, ...today.inHouse]} pending={pending} />
          </Panel>
          <Panel title="Room status">
            <CountList rows={manager.roomStatusCounts} />
          </Panel>
          <Panel title="Open maintenance">
            <MaintenanceList rows={today.maintenanceTickets} />
          </Panel>
        </section>
        <aside className="stack">
          <PendingIssueReports rows={pendingIssueReports} pending={pending} onReviewIssue={onReviewIssue} />
          <Panel title="Demand by room type">
            <CountList rows={manager.demandByRoomType} />
          </Panel>
          <Panel title="Recent audit">
            <AuditList rows={manager.recentAudit} />
          </Panel>
          <ExportPanel hotelId={hotelId} hotelName={hotelName} />
        </aside>
      </div>
    </>
  );
}

function ExportPanel({ hotelId, hotelName }: { hotelId: string; hotelName: string }) {
  return (
    <Panel title="Data exports">
      <div className="export-actions">
        <a className="button" href={`/api/hotels/${hotelId}/exports/reservations`} download={hotelExportFilename(hotelName, "reservations")}>
          <Download size={16} /> Reservation list
        </a>
        <a className="button" href={`/api/hotels/${hotelId}/exports/rooms`} download={hotelExportFilename(hotelName, "rooms")}>
          <Download size={16} /> Room inventory
        </a>
        <a className="button" href={`/api/hotels/${hotelId}/backup`} download={hotelBackupFilename(hotelName)}>
          <Download size={16} /> Full hotel backup
        </a>
      </div>
    </Panel>
  );
}

function FrontDeskWorkspace({
  today,
  availableRooms,
  searchResults,
  pending,
  onSearch,
  onWalkIn,
  onSaveGuest,
  onStatus,
}: {
  today: TodayDeskPayload;
  availableRooms: Room[];
  searchResults: SearchResults | null;
  pending: boolean;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onWalkIn: (event: FormEvent<HTMLFormElement>) => void;
  onSaveGuest: (event: FormEvent<HTMLFormElement>) => void;
  onStatus: (id: string, status: ReservationStatus) => void;
}) {
  return (
    <>
      <section className="grid metric-grid">
        <Metric label="Arrivals" value={String(today.stats.arrivals)} />
        <Metric label="Departures" value={String(today.stats.departures)} />
        <Metric label="In house" value={String(today.stats.inHouse)} />
        <Metric label="Rooms ready" value={String(today.stats.roomsReady)} />
        <Metric label="Pending requests" value={String(today.stats.pendingRequests)} />
        <Metric label="Open maintenance" value={String(today.stats.openMaintenance)} />
      </section>

      <div className="workspace-grid">
        <section className="stack">
          <Panel title="Guest, room, or reservation search">
            <form className="form-grid" onSubmit={onSearch}>
              <label className="full-row">
                Search
                <input name="query" placeholder="Name, phone, email, room, reservation id, or date" required />
              </label>
              <button className="primary full-row" type="submit" disabled={pending}>
                <Search size={16} /> Search
              </button>
            </form>
            <SearchResultsView results={searchResults} />
          </Panel>
          <Panel title="Arrivals and in-house guests">
            <ReservationTable rows={[...today.arrivals, ...today.inHouse]} onStatus={onStatus} pending={pending} />
          </Panel>
        </section>
        <aside className="stack">
          <Panel title="Walk-in reservation">
            <WalkInForm rooms={availableRooms} today={today.today} pending={pending} onSubmit={onWalkIn} />
          </Panel>
          <Panel title="Guest record">
            <GuestForm pending={pending} onSubmit={onSaveGuest} />
          </Panel>
          <Panel title="Room readiness">
            <RoomList rows={today.rooms} compact />
          </Panel>
        </aside>
      </div>
    </>
  );
}

function HousekeepingSupervisorWorkspace({
  today,
  housekeepers,
  pendingIssueReports,
  pending,
  onAssign,
  onRoomAction,
  onReviewIssue,
}: {
  today: TodayDeskPayload;
  housekeepers: StaffMember[];
  pendingIssueReports: MaintenanceTicket[];
  pending: boolean;
  onAssign: (event: FormEvent<HTMLFormElement>) => void;
  onRoomAction: (action: "start" | "finish" | "approve" | "send-back", roomId: string) => void;
  onReviewIssue: (ticketId: string, action: "approve" | "cancel", title?: string, priority?: MaintenancePriority) => void;
}) {
  const assignableRooms = today.rooms.filter((room) => !["occupied", "maintenance"].includes(room.status));

  return (
    <>
      <section className="grid metric-grid">
        <Metric label="Active tasks" value={String(today.housekeepingTasks.length)} />
        <Metric label="Dirty rooms" value={String(today.stats.roomsDirty)} />
        <Metric label="Ready rooms" value={String(today.stats.roomsReady)} />
        <Metric label="Pending issues" value={String(pendingIssueReports.length)} />
        <Metric label="Housekeepers" value={String(housekeepers.length)} />
      </section>

      <div className="workspace-grid">
        <section className="stack">
          <Panel title="Assign room">
            <form className="form-grid" onSubmit={onAssign}>
              <label>
                Room
                <select name="roomId" required>
                  {assignableRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      Room {room.number} - {room.status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Housekeeper
                <select name="staffId" required>
                  {housekeepers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary full-row" type="submit" disabled={pending}>
                <Plus size={16} /> Assign room
              </button>
            </form>
          </Panel>
          <Panel title="Inspection and room flow">
            <HousekeepingTaskList rows={today.housekeepingTasks} pending={pending} supervisor onRoomAction={onRoomAction} />
          </Panel>
        </section>
        <aside className="stack">
          <PendingIssueReports rows={pendingIssueReports} pending={pending} onReviewIssue={onReviewIssue} />
          <Panel title="Team">
            <TeamList rows={housekeepers} tasks={today.housekeepingTasks} />
          </Panel>
          <Panel title="Maintenance context">
            <MaintenanceList rows={today.maintenanceTickets} />
          </Panel>
        </aside>
      </div>
    </>
  );
}

function HousekeepingStaffWorkspace({
  session,
  today,
  message,
  pending,
  onLogout,
  onRoomAction,
  onReportIssue,
}: {
  session: HostedSession;
  today: TodayDeskPayload;
  message: string;
  pending: boolean;
  onLogout?: () => void;
  onRoomAction: (action: "start" | "finish", roomId: string) => void;
  onReportIssue: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const dirty = today.housekeepingTasks.filter((task) => task.status === "dirty").length;
  const cleaning = today.housekeepingTasks.filter((task) => task.status === "cleaning").length;
  const inspection = today.housekeepingTasks.filter((task) => task.status === "inspection").length;
  const [reportingRoomId, setReportingRoomId] = useState("");
  const [nowMs] = useState(() => Date.now());
  const tasksByRoom = useMemo(() => new Map(today.housekeepingTasks.map((task) => [task.roomId, task])), [today.housekeepingTasks]);
  const assignedRooms = useMemo(() => {
    const arrivalRoomIds = new Set(today.arrivals.map((row) => row.roomId));
    const departureRoomIds = new Set(today.departures.map((row) => row.roomId));
    const rows = today.rooms
      .map((room) => {
        const task = tasksByRoom.get(room.id);
        if (!task) return null;
        const bucket = task.status === "dirty" ? "needs-cleaning" : "in-progress";
        const priority = roomPriority(room, bucket, arrivalRoomIds, departureRoomIds);
        if (task.status === "inspection") {
          priority.rank = 3;
          priority.badges = ["Needs inspection"];
        }
        return { ...priority, task };
      })
      .filter((row): row is PrioritizedHousekeepingRoom & { task: HousekeepingTask } => row !== null)
      .sort((a, b) => {
        const aSentBack = a.task.notes.trim().length > 0 ? 0 : 1;
        const bSentBack = b.task.notes.trim().length > 0 ? 0 : 1;
        return aSentBack - bSentBack || compareRoomsForHousekeeping(a, b);
      });
    const nextRoom = rows.find((row) => row.task.status !== "inspection");
    if (nextRoom) nextRoom.badges.unshift("Clean first");
    return rows;
  }, [today.arrivals, today.departures, today.rooms, tasksByRoom]);
  const currentRoom = assignedRooms.find((row) => row.task.status !== "inspection") ?? assignedRooms[0];
  const nextRooms = assignedRooms.filter((row) => row.room.id !== currentRoom?.room.id);
  const reportingRoom = assignedRooms.find((row) => row.room.id === reportingRoomId)?.room ?? null;

  function submitIssue(event: FormEvent<HTMLFormElement>) {
    onReportIssue(event);
    setReportingRoomId("");
  }

  return (
    <div className="content-stack">
      <section className="housekeeping-focus-strip" aria-label="Housekeeping shift progress">
        <div className="focus-primary">
          <strong>
            {dirty} needs cleaning · {cleaning} in progress · {inspection} waiting inspection
          </strong>
        </div>
        <div className="focus-account">
          <span className="status-pill">{session.displayName}</span>
          {onLogout ? (
            <button className="secondary-button compact-logout" type="button" disabled={pending} onClick={onLogout}>
              <LogOut size={15} />
              Log out
            </button>
          ) : null}
        </div>
      </section>

      <section className="panel stack assigned-work-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Your rooms</p>
            <h2>Assigned work</h2>
          </div>
          <span className="icon-badge tone-green"><BedDouble size={18} /></span>
        </div>
        {message ? <p className={`form-message ${message.includes("failed") || message.includes("cannot") ? "error-message" : ""}`}>{message}</p> : null}
        {reportingRoom ? (
          <form className="issue-report-panel" onSubmit={submitIssue}>
            <div>
              <span>Room</span>
              <strong>{reportingRoom.number}</strong>
            </div>
            <input type="hidden" name="roomId" value={reportingRoom.id} />
            <input autoFocus name="title" placeholder="What needs maintenance?" required />
            <button className="primary-button" type="submit" disabled={pending}>
              <Wrench size={17} />
              Submit
            </button>
            <button className="secondary-button" type="button" onClick={() => setReportingRoomId("")}>
              Cancel
            </button>
          </form>
        ) : null}
        {assignedRooms.length === 0 || !currentRoom ? (
          <EmptyState message="No rooms assigned right now." />
        ) : (
          <div className="assigned-room-flow">
            <HousekeepingRoomCard
              current
              row={currentRoom}
              nowMs={nowMs}
              pending={pending}
              onRoomAction={onRoomAction}
              onReportIssue={() => setReportingRoomId(currentRoom.room.id)}
            />
            {nextRooms.length > 0 ? (
              <div className="assigned-room-list next-room-list" aria-label="Next assigned rooms">
                {nextRooms.map((row) => (
                  <HousekeepingRoomCard key={row.room.id} row={row} nowMs={nowMs} pending={pending} />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

type HousekeepingBucketKey = "needs-cleaning" | "in-progress";
type HousekeepingPriorityBadge = "Clean first" | "Arrival today" | "Checkout turnover" | "Finish cleaning" | "Needs inspection";
type PrioritizedHousekeepingRoom = {
  room: Room;
  badges: HousekeepingPriorityBadge[];
  rank: number;
};

function HousekeepingRoomCard({
  row,
  current = false,
  nowMs,
  pending,
  onRoomAction,
  onReportIssue,
}: {
  row: PrioritizedHousekeepingRoom & { task: HousekeepingTask };
  current?: boolean;
  nowMs: number;
  pending: boolean;
  onRoomAction?: (action: "start" | "finish", roomId: string) => void;
  onReportIssue?: () => void;
}) {
  const { room, badges, task } = row;
  const waitingInspection = task.status === "inspection";
  const sentBack = task.notes.trim().length > 0;

  return (
    <article className={`room-action-card ${current ? "current-room-card" : ""} ${sentBack ? "sent-back-card" : ""}`}>
      <div className="room-tile-top">
        <span className="room-number">Room {room.number}</span>
        <span className={`status-pill status-${task.status}`}>{housekeepingTaskLabel(task.status)}</span>
      </div>
      <div className="priority-badges" aria-label={`Room ${room.number} priority`}>
        {badges.map((badge) => (
          <span className={`priority-badge ${priorityBadgeClass(badge)}`} key={badge}>
            {badge}
          </span>
        ))}
      </div>
      <p>{room.roomType}</p>
      <span>
        Floor {room.floor} - {waitingInspection ? "Waiting for supervisor" : roomReadinessLabel(room.status)}
      </span>
      {sentBack ? (
        <div className="send-back-alert">
          <strong>Sent back</strong>
          <span>{current ? "Fix this before marking finished" : "Fix"}: {sendBackNoteLabel(task.notes)}</span>
        </div>
      ) : null}
      <span className="progress-note">{housekeepingProgressLabel(task, nowMs)}</span>
      {current ? (
        <div className="room-actions current-actions">
          {task.status === "dirty" ? (
            <button className="primary-button" type="button" disabled={pending} onClick={() => onRoomAction?.("start", room.id)}>
              <ClipboardCheck size={16} />
              Start Cleaning
            </button>
          ) : null}
          {task.status === "cleaning" ? (
            <button className="primary-button" type="button" disabled={pending} onClick={() => onRoomAction?.("finish", room.id)}>
              <CheckCircle2 size={16} />
              Mark Finished
            </button>
          ) : null}
          {waitingInspection ? <span className="room-safe-note">Waiting for supervisor inspection</span> : null}
          {!waitingInspection ? (
            <button className="secondary-button" type="button" disabled={pending} onClick={onReportIssue}>
              <Wrench size={16} />
              Report Issue
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function roomReadinessLabel(status: string) {
  if (status === "dirty") return "Needs Cleaning";
  if (status === "cleaning") return "In Progress";
  if (status === "ready" || status === "available") return "Ready";
  return "Blocked";
}

function housekeepingTaskLabel(status: string) {
  if (status === "dirty") return "Needs Cleaning";
  if (status === "cleaning") return "In Progress";
  if (status === "inspection") return "Needs Inspection";
  if (status === "blocked") return "Blocked";
  if (status === "ready") return "Ready";
  return status.replace(/-/g, " ");
}

function housekeepingProgressLabel(task: HousekeepingTask, nowMs = Date.now()) {
  const elapsed = elapsedLabel(task.updatedAt, nowMs);
  if (task.status === "cleaning") return `Started ${elapsed}`;
  if (task.status === "inspection") return `Waiting inspection ${elapsed}`;
  if (task.status === "dirty") return `Assigned ${elapsed}`;
  if (task.status === "blocked") return `Blocked ${elapsed}`;
  if (task.status === "ready") return `Approved ${elapsed}`;
  return `Updated ${elapsed}`;
}

function sendBackNoteLabel(notes: string) {
  return notes.startsWith("Other: ") ? notes.slice("Other: ".length) : notes;
}

function priorityBadgeClass(badge: HousekeepingPriorityBadge) {
  if (badge === "Clean first") return "clean-first";
  if (badge === "Arrival today") return "arrival-today";
  if (badge === "Checkout turnover") return "checkout-turnover";
  if (badge === "Needs inspection") return "needs-inspection";
  return "finish-cleaning";
}

function compareRoomsForHousekeeping(a: PrioritizedHousekeepingRoom, b: PrioritizedHousekeepingRoom) {
  return a.rank - b.rank || a.room.floor - b.room.floor || a.room.number.localeCompare(b.room.number, undefined, { numeric: true });
}

function roomPriority(
  room: Room,
  bucket: HousekeepingBucketKey,
  arrivalRoomIds: Set<string>,
  departureRoomIds: Set<string>,
): PrioritizedHousekeepingRoom {
  const arrivalToday = arrivalRoomIds.has(room.id);
  const checkoutTurnover = departureRoomIds.has(room.id);
  const badges: HousekeepingPriorityBadge[] = [];
  let rank = 2;

  if (bucket === "needs-cleaning") {
    if (arrivalToday) rank = 0;
    else if (checkoutTurnover) rank = 1;
    if (arrivalToday) badges.push("Arrival today");
    if (checkoutTurnover) badges.push("Checkout turnover");
  } else {
    rank = arrivalToday ? 0 : 1;
    badges.push("Finish cleaning");
    if (arrivalToday) badges.push("Arrival today");
  }

  return { room, badges, rank };
}

function elapsedLabel(iso: string, nowMs = Date.now()) {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "just now";
  const minutes = Math.max(0, Math.floor((nowMs - then) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function MaintenanceWorkspace({
  today,
  pending,
  onCreateMaintenance,
  onUpdateMaintenance,
}: {
  today: TodayDeskPayload;
  pending: boolean;
  onCreateMaintenance: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateMaintenance: (ticketId: string, input: MaintenanceUpdatePayload, success?: string) => void;
}) {
  const highPriority = today.maintenanceTickets.filter((ticket) => ticket.priority === "high" || ticket.priority === "critical").length;
  const maintenanceRooms = today.rooms.filter((room) => room.status === "maintenance");
  const blockedTickets = today.maintenanceTickets.filter((ticket) => ticket.status === "blocked").length;

  return (
    <>
      <section className="grid metric-grid">
        <Metric label="Open tickets" value={String(today.maintenanceTickets.length)} />
        <Metric label="High priority" value={String(highPriority)} />
        <Metric label="Blocked tickets" value={String(blockedTickets)} />
        <Metric label="Rooms blocked" value={String(maintenanceRooms.length)} />
      </section>

      <div className="workspace-grid">
        <section className="stack">
          <Panel title="Maintenance queue">
            <MaintenanceQueue rows={today.maintenanceTickets} rooms={today.rooms} pending={pending} onUpdateMaintenance={onUpdateMaintenance} />
          </Panel>
        </section>
        <aside className="stack">
          <Panel title="New maintenance ticket">
            <MaintenanceForm rooms={today.rooms} today={today.today} pending={pending} onSubmit={onCreateMaintenance} />
          </Panel>
          <Panel title="Room maintenance context">
            <RoomList rows={maintenanceRooms.length > 0 ? maintenanceRooms : today.rooms} compact />
          </Panel>
        </aside>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel stack">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="empty-state">{message}</p>;
}

function WalkInForm({
  rooms,
  today,
  pending,
  onSubmit,
}: {
  rooms: Room[];
  today: string;
  pending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <label>
        Guest name
        <input name="fullName" required />
      </label>
      <label>
        Phone
        <input name="phone" />
      </label>
      <label>
        Email
        <input name="email" />
      </label>
      <label>
        Room
        <select name="roomId" required>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              Room {room.number} - {room.roomType}
            </option>
          ))}
        </select>
      </label>
      <label>
        Check in
        <input name="checkIn" type="date" defaultValue={today} required />
      </label>
      <label>
        Check out
        <input name="checkOut" type="date" required />
      </label>
      <label>
        Adults
        <input name="adults" type="number" min="1" defaultValue="1" />
      </label>
      <label>
        Children
        <input name="children" type="number" min="0" defaultValue="0" />
      </label>
      <label>
        Nightly rate cents
        <input name="nightlyRateCents" type="number" min="0" defaultValue={rooms[0]?.nightlyRateCents ?? 0} />
      </label>
      <label>
        Notes
        <input name="notes" />
      </label>
      <button className="primary full-row" type="submit" disabled={pending}>
        <Plus size={16} /> Create walk-in
      </button>
    </form>
  );
}

function GuestForm({ pending, onSubmit }: { pending: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <label>
        Guest name
        <input name="fullName" required />
      </label>
      <label>
        Phone
        <input name="phone" />
      </label>
      <label>
        Email
        <input name="email" />
      </label>
      <label className="full-row">
        Notes
        <input name="notes" />
      </label>
      <button className="primary full-row" type="submit" disabled={pending}>
        <Plus size={16} /> Save guest
      </button>
    </form>
  );
}

const maintenancePriorityOptions: MaintenancePriority[] = ["low", "medium", "high", "critical"];
const activeMaintenanceStatusOptions: MaintenanceStatus[] = ["open", "in-progress", "blocked"];
const editableMaintenanceStatusOptions: MaintenanceStatus[] = ["open", "in-progress", "blocked", "resolved", "cancelled"];

function MaintenanceForm({
  rooms,
  today,
  pending,
  onSubmit,
}: {
  rooms: Room[];
  today: string;
  pending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <label className="full-row">
        Room
        <select name="roomId" required>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              Room {room.number}
            </option>
          ))}
        </select>
      </label>
      <label className="full-row">
        Issue
        <input name="title" required />
      </label>
      <label>
        Priority
        <select name="priority" defaultValue="medium">
          {maintenancePriorityOptions.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select name="status" defaultValue="open">
          {activeMaintenanceStatusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label className="full-row">
        Due date
        <input name="dueDate" type="date" defaultValue={today} required />
      </label>
      <button className="primary full-row" type="submit" disabled={pending}>
        <Wrench size={16} /> Save ticket
      </button>
    </form>
  );
}

function MaintenanceQueue({
  rows,
  rooms,
  pending,
  onUpdateMaintenance,
}: {
  rows: MaintenanceTicket[];
  rooms: Room[];
  pending: boolean;
  onUpdateMaintenance: (ticketId: string, input: MaintenanceUpdatePayload, success?: string) => void;
}) {
  if (rows.length === 0) return <EmptyState message="No open maintenance." />;

  function payloadFor(ticket: MaintenanceTicket, status: MaintenanceStatus): MaintenanceUpdatePayload {
    return {
      roomId: ticket.roomId,
      title: ticket.title,
      priority: ticket.priority,
      status,
      dueDate: ticket.dueDate,
    };
  }

  function submitTicket(event: FormEvent<HTMLFormElement>, ticketId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onUpdateMaintenance(ticketId, {
      roomId: String(form.get("roomId") ?? ""),
      title: String(form.get("title") ?? ""),
      priority: String(form.get("priority") ?? "medium") as MaintenancePriority,
      status: String(form.get("status") ?? "open") as MaintenanceStatus,
      dueDate: String(form.get("dueDate") ?? ""),
    });
  }

  return (
    <div className="maintenance-queue">
      {rows.map((ticket) => {
        const terminal = ticket.status === "resolved" || ticket.status === "cancelled";
        return (
          <article className="card maintenance-ticket-card" key={ticket.id}>
            <div className="maintenance-ticket-heading">
              <div>
                <strong>Room {ticket.roomNumber}</strong>
                <p>{ticket.title}</p>
              </div>
              <div className="ticket-meta">
                <StatusPill value={ticket.priority} />
                <StatusPill value={ticket.status} />
                <span className="status-pill">Due {ticket.dueDate}</span>
              </div>
            </div>

            <form
              key={`${ticket.id}-${ticket.roomId}-${ticket.title}-${ticket.priority}-${ticket.status}-${ticket.dueDate}`}
              className="maintenance-ticket-form"
              onSubmit={(event) => submitTicket(event, ticket.id)}
            >
              <label>
                Room
                <select name="roomId" defaultValue={ticket.roomId} required>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      Room {room.number}
                    </option>
                  ))}
                </select>
              </label>
              <label className="issue-field">
                Issue
                <input name="title" defaultValue={ticket.title} required />
              </label>
              <label>
                Priority
                <select name="priority" defaultValue={ticket.priority}>
                  {maintenancePriorityOptions.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select name="status" defaultValue={ticket.status}>
                  {editableMaintenanceStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Due date
                <input name="dueDate" type="date" defaultValue={ticket.dueDate} required />
              </label>
              <button className="primary save-button" type="submit" disabled={pending}>
                <Save size={15} /> Save
              </button>
            </form>

            <div className="actions maintenance-actions">
              <button
                type="button"
                disabled={pending || terminal || ticket.status === "in-progress"}
                onClick={() => onUpdateMaintenance(ticket.id, payloadFor(ticket, "in-progress"), "Ticket moved to in progress.")}
              >
                <Play size={15} /> Start
              </button>
              <button
                type="button"
                disabled={pending || terminal || ticket.status === "blocked"}
                onClick={() => onUpdateMaintenance(ticket.id, payloadFor(ticket, "blocked"), "Ticket blocked.")}
              >
                <Wrench size={15} /> Block
              </button>
              <button
                className="primary"
                type="button"
                disabled={pending || ticket.status === "resolved"}
                onClick={() => onUpdateMaintenance(ticket.id, payloadFor(ticket, "resolved"), "Ticket resolved; room returned to housekeeping.")}
              >
                <CheckCircle2 size={15} /> Resolve
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={pending || ticket.status === "cancelled"}
                onClick={() => onUpdateMaintenance(ticket.id, payloadFor(ticket, "cancelled"), "Ticket cancelled.")}
              >
                <XCircle size={15} /> Cancel
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function SearchResultsView({ results }: { results: SearchResults | null }) {
  if (!results) return null;

  return (
    <div className="grid result-grid">
      <article className="card stack">
        <strong>Guests</strong>
        {results.guests.length === 0 ? <p className="muted">No guests found.</p> : null}
        {results.guests.map((guest) => (
          <p key={guest.id}>
            {guest.fullName}
            <br />
            <span className="muted">{[guest.phone, guest.email].filter(Boolean).join(" ")}</span>
          </p>
        ))}
      </article>
      <article className="card stack">
        <strong>Reservations</strong>
        {results.reservations.length === 0 ? <p className="muted">No reservations found.</p> : null}
        {results.reservations.map((reservation) => (
          <p key={reservation.id}>
            Room {reservation.roomNumber} - {reservation.guestName}
            <br />
            <StatusPill value={reservation.status} />
          </p>
        ))}
      </article>
      <article className="card stack">
        <strong>Rooms</strong>
        {results.rooms.length === 0 ? <p className="muted">No rooms found.</p> : null}
        {results.rooms.map((room) => (
          <p key={room.id}>
            Room {room.number}
            <br />
            <StatusPill value={room.status} />
          </p>
        ))}
      </article>
    </div>
  );
}

function PendingIssueReports({
  rows,
  pending,
  onReviewIssue,
}: {
  rows: MaintenanceTicket[];
  pending: boolean;
  onReviewIssue: (ticketId: string, action: "approve" | "cancel", title?: string, priority?: MaintenancePriority) => void;
}) {
  return (
    <Panel title="Pending issue reports">
      {rows.length === 0 ? <EmptyState message="No pending issue reports." /> : null}
      <div className="stack">
        {rows.map((ticket) => (
          <article className="card stack" key={ticket.id}>
            <div>
              <strong>Room {ticket.roomNumber}</strong>
              <p>{ticket.title}</p>
            </div>
            <StatusPill value={ticket.status} />
            <div className="actions">
              <button type="button" disabled={pending} onClick={() => onReviewIssue(ticket.id, "approve", ticket.title, ticket.priority)}>
                <CheckCircle2 size={15} /> Approve
              </button>
              <button type="button" disabled={pending} onClick={() => onReviewIssue(ticket.id, "cancel")}>
                Cancel
              </button>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function HousekeepingTaskList({
  rows,
  pending,
  supervisor,
  onRoomAction,
}: {
  rows: HousekeepingTask[];
  pending: boolean;
  supervisor?: boolean;
  onRoomAction: (action: "start" | "finish" | "approve" | "send-back", roomId: string) => void;
}) {
  if (rows.length === 0) return <EmptyState message="No active housekeeping tasks." />;

  return (
    <div className="grid hotel-grid">
      {rows.map((task) => (
        <article className="card stack" key={task.id}>
          <div>
            <strong>Room {task.roomNumber}</strong>
            <p className="muted">{task.title}</p>
            {task.assigneeName ? <p className="muted">Assigned to {task.assigneeName}</p> : null}
          </div>
          <StatusPill value={task.status} />
          {supervisor ? (
            <div className="actions">
              <button type="button" disabled={pending} onClick={() => onRoomAction("approve", task.roomId)}>
                <CheckCircle2 size={15} /> Approve
              </button>
              <button type="button" disabled={pending} onClick={() => onRoomAction("send-back", task.roomId)}>
                <ArrowRight size={15} /> Send back
              </button>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function ReservationTable({
  rows,
  onStatus,
  pending,
}: {
  rows: ReservationSummary[];
  onStatus?: (id: string, status: ReservationStatus) => void;
  pending: boolean;
}) {
  if (rows.length === 0) return <EmptyState message="No arrivals or in-house reservations." />;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Guest</th>
            <th>Room</th>
            <th>Dates</th>
            <th>Total</th>
            <th>Status</th>
            {onStatus ? <th>Action</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.guestName}</strong>
                <br />
                <span className="muted">{row.guestPhone}</span>
              </td>
              <td>
                Room {row.roomNumber}
                <br />
                <span className="muted">{row.roomType}</span>
              </td>
              <td>
                {row.checkIn}
                <br />
                <span className="muted">to {row.checkOut}</span>
              </td>
              <td>
                <Money cents={row.totalCents} />
              </td>
              <td>
                <StatusPill value={row.status} />
              </td>
              {onStatus ? (
                <td className="actions">
                  {row.status !== "checked-in" ? (
                    <button type="button" disabled={pending} onClick={() => onStatus(row.id, "checked-in")}>
                      Check in
                    </button>
                  ) : null}
                  {row.status === "checked-in" ? (
                    <button type="button" disabled={pending} onClick={() => onStatus(row.id, "checked-out")}>
                      Check out
                    </button>
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CountList({ rows }: { rows: CountRow[] }) {
  if (rows.length === 0) return <EmptyState message="No data to show." />;

  return (
    <div className="compact-list">
      {rows.map((row) => (
        <div key={row.label}>
          <span>{row.label.replace(/-/g, " ")}</span>
          <strong>{row.count}</strong>
        </div>
      ))}
    </div>
  );
}

function MaintenanceList({ rows }: { rows: MaintenanceTicket[] }) {
  if (rows.length === 0) return <EmptyState message="No open maintenance." />;

  return (
    <div className="stack">
      {rows.map((ticket) => (
        <article className="card compact-card" key={ticket.id}>
          <div>
            <strong>Room {ticket.roomNumber}</strong>
            <p>{ticket.title}</p>
          </div>
          <div className="status-row">
            <StatusPill value={ticket.priority} />
            <StatusPill value={ticket.status} />
          </div>
        </article>
      ))}
    </div>
  );
}

function RoomList({ rows, compact = false }: { rows: Room[]; compact?: boolean }) {
  if (rows.length === 0) return <EmptyState message="No rooms to show." />;

  return (
    <div className={compact ? "compact-list" : "grid hotel-grid"}>
      {rows.map((room) => (
        <article className={compact ? undefined : "card"} key={room.id}>
          <div>
            <strong>Room {room.number}</strong>
            <p className="muted">{room.roomType}</p>
          </div>
          <StatusPill value={room.status} />
        </article>
      ))}
    </div>
  );
}

function TeamList({ rows, tasks }: { rows: StaffMember[]; tasks: HousekeepingTask[] }) {
  if (rows.length === 0) return <EmptyState message="No active housekeepers." />;

  return (
    <div className="compact-list">
      {rows.map((member) => {
        const assigned = tasks.filter((task) => task.assigneeStaffId === member.id).length;
        return (
          <div key={member.id}>
            <span>{member.fullName}</span>
            <strong>{assigned}</strong>
          </div>
        );
      })}
    </div>
  );
}

function AuditList({ rows }: { rows: AuditLogEntry[] }) {
  if (rows.length === 0) return <EmptyState message="No recent audit activity." />;

  return (
    <div className="stack">
      {rows.slice(0, 6).map((entry) => (
        <article className="card compact-card" key={entry.id}>
          <div>
            <strong>{entry.action}</strong>
            <p className="muted">{entry.actorRole ?? "system"} - {entry.createdAt}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
