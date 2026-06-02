"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowRight, CalendarDays, Plus, Save, Search } from "lucide-react";
import { Money, StatusPill } from "@/components/format";
import type { FrontDeskReservationsPayload, ReservationStatus, ReservationSummary, Room, SearchResults, TodayDeskPayload } from "@/lib/types";

const activeStatuses: ReservationStatus[] = ["pending", "confirmed", "checked-in"];

type SortKey = "guest" | "room" | "checkIn" | "checkOut" | "status";

export function FrontDeskHub({ hotelId, hotelName, today }: { hotelId: string; hotelName: string; today: TodayDeskPayload }) {
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
            <InstantFrontDeskSearch hotelId={hotelId} />
          </Panel>
          <div className="front-desk-actions">
            <Link className="front-desk-action-card" href={`/hotels/${hotelId}/front-desk/walk-in`}>
              <span className="icon-badge">
                <Plus size={18} />
              </span>
              <div>
                <h2>Create walk-in</h2>
                <p>New guest and reservation in one flow.</p>
              </div>
              <ArrowRight size={18} />
            </Link>
            <Link className="front-desk-action-card" href={`/hotels/${hotelId}/front-desk/reservations`}>
              <span className="icon-badge tone-green">
                <CalendarDays size={18} />
              </span>
              <div>
                <h2>Arrivals / in-house</h2>
                <p>Table and booking board for active stays.</p>
              </div>
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>
        <aside className="stack">
          <Panel title="Room readiness">
            <p className="muted">{hotelName}</p>
            <RoomList rows={today.rooms} compact />
          </Panel>
        </aside>
      </div>
    </>
  );
}

export function FrontDeskWalkInPage({
  hotelId,
  hotelName,
  today,
  rooms,
}: {
  hotelId: string;
  hotelName: string;
  today: string;
  rooms: Room[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const availableRooms = rooms.filter((room) => ["available", "ready", "dirty"].includes(room.status));

  function createWalkIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage("");
    startTransition(() => {
      void fetch(`/api/hotels/${hotelId}/walk-ins`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: String(form.get("fullName") ?? ""),
          email: String(form.get("email") ?? ""),
          phone: String(form.get("phone") ?? ""),
          guestNotes: String(form.get("guestNotes") ?? ""),
          roomId: String(form.get("roomId") ?? ""),
          checkIn: String(form.get("checkIn") ?? today),
          checkOut: String(form.get("checkOut") ?? today),
          adults: Number(form.get("adults") ?? 1),
          children: Number(form.get("children") ?? 0),
          nightlyRateCents: Number(form.get("nightlyRateCents") ?? 0),
          notes: String(form.get("notes") ?? ""),
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const data = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(data?.error ?? "Walk-in creation failed.");
          }
          router.push(`/hotels/${hotelId}/front-desk/reservations`);
          router.refresh();
        })
        .catch((error) => setMessage(error instanceof Error ? error.message : String(error)));
    });
  }

  return (
    <div className="workspace-grid">
      <section className="stack single-column">
        {message ? <p className="error-text">{message}</p> : null}
        <Panel title="Walk-in reservation">
          {availableRooms.length === 0 ? (
            <EmptyState message="No rooms are available for walk-ins." />
          ) : (
            <WalkInForm rooms={availableRooms} today={today} pending={pending} onSubmit={createWalkIn} />
          )}
        </Panel>
      </section>
      <aside className="stack">
        <Panel title="Available rooms">
          <p className="muted">{hotelName}</p>
          <RoomList rows={availableRooms} compact />
        </Panel>
      </aside>
    </div>
  );
}

export function FrontDeskReservationsPage({
  hotelId,
  hotelName,
  payload,
}: {
  hotelId: string;
  hotelName: string;
  payload: FrontDeskReservationsPayload;
}) {
  const router = useRouter();
  const [view, setView] = useState<"table" | "board">("table");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ReservationStatus | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("checkIn");
  const [rangeStart, setRangeStart] = useState(payload.rangeStart);
  const [rangeEnd, setRangeEnd] = useState(payload.rangeEnd);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const rows = useMemo(
    () => sortReservationsForFrontDesk(filterReservationsForFrontDesk(payload.reservations, query, status), sortKey),
    [payload.reservations, query, status, sortKey],
  );

  function applyRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams({ start: rangeStart, end: rangeEnd });
    router.push(`/hotels/${hotelId}/front-desk/reservations?${params.toString()}`);
  }

  function updateStatus(id: string, nextStatus: ReservationStatus) {
    setMessage("");
    startTransition(() => {
      void fetch(`/api/hotels/${hotelId}/reservations/${id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const data = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(data?.error ?? "Reservation update failed.");
          }
          setMessage("Reservation status updated.");
          router.refresh();
        })
        .catch((error) => setMessage(error instanceof Error ? error.message : String(error)));
    });
  }

  return (
    <section className="stack">
      <div className="front-desk-toolbar">
        <div className="view-toggle" role="tablist" aria-label="Reservation view">
          <button type="button" className={view === "table" ? "primary-button" : "secondary-button"} onClick={() => setView("table")}>
            Table
          </button>
          <button type="button" className={view === "board" ? "primary-button" : "secondary-button"} onClick={() => setView("board")}>
            Booking board
          </button>
        </div>
        <form className="date-range-form" onSubmit={applyRange}>
          <label>
            Start
            <input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} required />
          </label>
          <label>
            End
            <input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} required />
          </label>
          <button className="secondary-button" type="submit">
            Apply dates
          </button>
        </form>
      </div>

      {message ? <p className={message.includes("failed") || message.includes("cannot") ? "error-text" : "notice"}>{message}</p> : null}

      <Panel title="Active reservations">
        <div className="reservation-controls">
          <label>
            Search
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Guest, phone, room, or reservation id" />
          </label>
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value as ReservationStatus | "all")}>
              <option value="all">All active</option>
              {activeStatuses.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sort
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
              <option value="checkIn">Check in</option>
              <option value="checkOut">Check out</option>
              <option value="guest">Guest</option>
              <option value="room">Room</option>
              <option value="status">Status</option>
            </select>
          </label>
        </div>
        {view === "table" ? (
          <ReservationTable rows={rows} pending={pending} onStatus={updateStatus} />
        ) : (
          <BookingBoard hotelName={hotelName} rooms={payload.rooms} reservations={rows} rangeStart={payload.rangeStart} rangeEnd={payload.rangeEnd} />
        )}
      </Panel>
    </section>
  );
}

function InstantFrontDeskSearch({ hotelId }: { hotelId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestNumber = useRef(0);

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    if (!nextQuery.trim()) {
      requestNumber.current += 1;
      setResults(null);
      setError("");
      setLoading(false);
    }
  }

  useEffect(() => {
    const trimmed = query.trim();
    requestNumber.current += 1;
    const currentRequest = requestNumber.current;

    if (!trimmed) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setLoading(true);
      setError("");
      void fetch(`/api/hotels/${hotelId}/search?q=${encodeURIComponent(trimmed)}&limit=25`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) {
            const data = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(data?.error ?? "Search failed.");
          }
          return response.json() as Promise<SearchResults>;
        })
        .then((nextResults) => {
          if (currentRequest === requestNumber.current) setResults(nextResults);
        })
        .catch((nextError) => {
          if (controller.signal.aborted) return;
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        })
        .finally(() => {
          if (currentRequest === requestNumber.current) setLoading(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [hotelId, query]);

  return (
    <div className="stack">
      <label className="instant-search-label">
        <span>Search</span>
        <span className="instant-search-box">
          <Search size={16} />
          <input value={query} onChange={(event) => updateQuery(event.target.value)} placeholder="Name, phone, email, room, reservation id, or date" />
        </span>
      </label>
      {loading ? <p className="muted">Searching...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <SearchResultsView results={results} />
    </div>
  );
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
    <form className="form-grid walk-in-form" onSubmit={onSubmit}>
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
        <input name="checkOut" type="date" defaultValue={today} required />
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
        Guest notes
        <input name="guestNotes" />
      </label>
      <label className="full-row">
        Reservation notes
        <input name="notes" />
      </label>
      <button className="primary-button full-row" type="submit" disabled={pending}>
        <Save size={16} /> Create walk-in
      </button>
    </form>
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

function ReservationTable({
  rows,
  onStatus,
  pending,
}: {
  rows: ReservationSummary[];
  onStatus: (id: string, status: ReservationStatus) => void;
  pending: boolean;
}) {
  if (rows.length === 0) return <EmptyState message="No active reservations in this range." />;

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
            <th>Action</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BookingBoard({
  hotelName,
  rooms,
  reservations,
  rangeStart,
  rangeEnd,
}: {
  hotelName: string;
  rooms: Room[];
  reservations: ReservationSummary[];
  rangeStart: string;
  rangeEnd: string;
}) {
  const dates = buildBookingBoardDates(rangeStart, rangeEnd);
  if (dates.length === 0) return <EmptyState message="Choose a valid date range." />;

  const gridTemplateColumns = `110px repeat(${dates.length}, minmax(88px, 1fr))`;

  return (
    <div className="booking-board" aria-label={`${hotelName} booking board`}>
      <div className="booking-board-header" style={{ gridTemplateColumns }}>
        <div className="booking-room-header">Room</div>
        {dates.map((date) => (
          <div className="booking-date-header" key={date}>
            {date.slice(5)}
          </div>
        ))}
      </div>
      {rooms.map((room) => {
        const roomReservations = reservations.filter((reservation) => reservation.roomId === room.id);
        return (
          <div className="booking-board-row" style={{ gridTemplateColumns }} key={room.id}>
            <div className="booking-room-cell">
              <strong>{room.number}</strong>
              <span>{room.roomType}</span>
            </div>
            {dates.map((date) => (
              <div className="booking-date-cell" key={`${room.id}-${date}`} />
            ))}
            {roomReservations.map((reservation) => {
              const startIndex = Math.max(0, daysBetween(rangeStart, reservation.checkIn));
              const endIndex = Math.min(dates.length, daysBetween(rangeStart, reservation.checkOut));
              if (endIndex <= startIndex) return null;
              return (
                <div
                  className={`booking-bar status-${reservation.status}`}
                  key={reservation.id}
                  style={{ gridColumn: `${startIndex + 2} / ${endIndex + 2}` }}
                  title={`${reservation.guestName}, room ${reservation.roomNumber}, ${reservation.checkIn} to ${reservation.checkOut}`}
                >
                  <strong>{reservation.guestName}</strong>
                  <span>{reservation.checkIn} - {reservation.checkOut}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
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

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="empty-state">{message}</p>;
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

export function filterReservationsForFrontDesk(rows: ReservationSummary[], query: string, status: ReservationStatus | "all") {
  const normalizedQuery = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (status !== "all" && row.status !== status) return false;
    if (!normalizedQuery) return true;
    return [row.id, row.guestName, row.guestPhone, row.roomNumber, row.roomType, row.checkIn, row.checkOut, row.status]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
}

export function sortReservationsForFrontDesk(rows: ReservationSummary[], sortKey: SortKey) {
  const sorted = [...rows];
  sorted.sort((left, right) => {
    if (sortKey === "guest") return left.guestName.localeCompare(right.guestName) || left.checkIn.localeCompare(right.checkIn);
    if (sortKey === "room") return left.roomNumber.localeCompare(right.roomNumber) || left.checkIn.localeCompare(right.checkIn);
    if (sortKey === "checkOut") return left.checkOut.localeCompare(right.checkOut) || left.roomNumber.localeCompare(right.roomNumber);
    if (sortKey === "status") return left.status.localeCompare(right.status) || left.checkIn.localeCompare(right.checkIn);
    return left.checkIn.localeCompare(right.checkIn) || left.roomNumber.localeCompare(right.roomNumber);
  });
  return sorted;
}

export function buildBookingBoardDates(rangeStart: string, rangeEnd: string) {
  const days = daysBetween(rangeStart, rangeEnd);
  if (days <= 0) return [];
  return Array.from({ length: days }, (_, index) => dateFromOffset(rangeStart, index));
}

function dateFromOffset(date: string, offset: number) {
  const base = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(base)) return date;
  return new Date(base + offset * 86400000).toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string) {
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return 0;
  return Math.round((endTime - startTime) / 86400000);
}
