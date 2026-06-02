"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, BedDouble, CalendarDays, ClipboardCheck, Clock, Plus, Save, Search, Wrench } from "lucide-react";
import { Money, StatusPill } from "@/components/format";
import type {
  FrontDeskReservationsPayload,
  ReservationStatus,
  ReservationSummary,
  Room,
  RoomTypeAvailability,
  SearchResults,
  TodayDeskPayload,
} from "@/lib/types";

const activeStatuses: ReservationStatus[] = ["pending", "confirmed", "checked-in"];

type SortKey = "guest" | "room" | "checkIn" | "checkOut" | "status";

export function FrontDeskHub({
  hotelId,
  hotelName,
  today,
  availability,
}: {
  hotelId: string;
  hotelName: string;
  today: TodayDeskPayload;
  availability?: FrontDeskReservationsPayload;
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
        <FrontDeskReadiness hotelName={hotelName} today={today} availability={availability} />
      </section>
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
  const [showAllRooms, setShowAllRooms] = useState(false);
  const [checkoutTarget, setCheckoutTarget] = useState<ReservationSummary | null>(null);
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
          setCheckoutTarget(null);
          router.refresh();
        })
        .catch((error) => setMessage(error instanceof Error ? error.message : String(error)));
    });
  }

  function requestStatus(row: ReservationSummary, nextStatus: ReservationStatus) {
    if (nextStatus === "checked-out") {
      setCheckoutTarget(row);
      return;
    }
    updateStatus(row.id, nextStatus);
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
          <label className="date-inline-label">
            <span>Start</span>
            <input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} required />
          </label>
          <label className="date-inline-label">
            <span>End</span>
            <input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} required />
          </label>
          <button className="secondary-button" type="submit">
            Apply dates
          </button>
        </form>
      </div>

      {message ? <p className={statusMessageClassName(message)}>{message}</p> : null}

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
          <ReservationTable hotelId={hotelId} rows={rows} pending={pending} onStatus={requestStatus} />
        ) : (
          <>
            <div className="board-options">
              <label>
                <input type="checkbox" checked={showAllRooms} onChange={(event) => setShowAllRooms(event.target.checked)} />
                Show empty rooms
              </label>
              <span className="muted">{showAllRooms ? "All rooms visible" : "Booked rooms only"}</span>
            </div>
            <BookingBoard
              hotelId={hotelId}
              hotelName={hotelName}
              rooms={payload.rooms}
              reservations={rows}
              rangeStart={payload.rangeStart}
              rangeEnd={payload.rangeEnd}
              showAllRooms={showAllRooms}
            />
          </>
        )}
      </Panel>
      <CheckoutConfirmDialog
        reservation={checkoutTarget}
        pending={pending}
        onCancel={() => setCheckoutTarget(null)}
        onConfirm={() => {
          if (checkoutTarget) updateStatus(checkoutTarget.id, "checked-out");
        }}
      />
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
  hotelId,
  rows,
  onStatus,
  pending,
}: {
  hotelId: string;
  rows: ReservationSummary[];
  onStatus: (row: ReservationSummary, status: ReservationStatus) => void;
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
            <tr className="clickable-reservation-row" key={row.id}>
              <td>
                <ReservationCellLink hotelId={hotelId} reservationId={row.id}>
                  <strong>{row.guestName}</strong>
                  <br />
                  <span className="muted">{row.guestPhone}</span>
                </ReservationCellLink>
              </td>
              <td>
                <ReservationCellLink hotelId={hotelId} reservationId={row.id}>
                  Room {row.roomNumber}
                  <br />
                  <span className="muted">{row.roomType}</span>
                </ReservationCellLink>
              </td>
              <td>
                <ReservationCellLink hotelId={hotelId} reservationId={row.id}>
                  {row.checkIn}
                  <br />
                  <span className="muted">to {row.checkOut}</span>
                </ReservationCellLink>
              </td>
              <td>
                <ReservationCellLink hotelId={hotelId} reservationId={row.id}>
                  <Money cents={row.totalCents} />
                </ReservationCellLink>
              </td>
              <td>
                <ReservationCellLink hotelId={hotelId} reservationId={row.id}>
                  <StatusPill value={row.status} />
                </ReservationCellLink>
              </td>
              <td className="actions">
                {row.status !== "checked-in" ? (
                  <button type="button" disabled={pending} onClick={() => onStatus(row, "checked-in")}>
                    Check in
                  </button>
                ) : null}
                {row.status === "checked-in" ? (
                  <button type="button" disabled={pending} onClick={() => onStatus(row, "checked-out")}>
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

function ReservationCellLink({ hotelId, reservationId, children }: { hotelId: string; reservationId: string; children: React.ReactNode }) {
  return (
    <Link className="reservation-cell-link" href={reservationHref(hotelId, reservationId)}>
      {children}
    </Link>
  );
}

export function BookingBoard({
  hotelId,
  hotelName,
  rooms,
  reservations,
  rangeStart,
  rangeEnd,
  showAllRooms = false,
}: {
  hotelId: string;
  hotelName: string;
  rooms: Room[];
  reservations: ReservationSummary[];
  rangeStart: string;
  rangeEnd: string;
  showAllRooms?: boolean;
}) {
  const dates = buildBookingBoardDates(rangeStart, rangeEnd);
  if (dates.length === 0) return <EmptyState message="Choose a valid date range." />;

  const visibleRooms = roomsForBookingBoard(rooms, reservations, showAllRooms);
  if (visibleRooms.length === 0) return <EmptyState message="No booked rooms in this range." />;

  const gridTemplateColumns = `minmax(82px, 104px) repeat(${dates.length}, minmax(0, 1fr))`;
  const labelStep = bookingDateLabelStep(dates.length);

  return (
    <div className="booking-board" aria-label={`${hotelName} booking board`}>
      <div className="booking-board-header" style={{ gridTemplateColumns }}>
        <div className="booking-room-header">Room</div>
        {dates.map((date, index) => (
          <div className="booking-date-header" key={date} title={date}>
            {index % labelStep === 0 || index === dates.length - 1 ? date.slice(5) : ""}
          </div>
        ))}
      </div>
      {visibleRooms.map((room) => {
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
                <Link
                  className={`booking-bar status-${reservation.status}`}
                  href={reservationHref(hotelId, reservation.id)}
                  key={reservation.id}
                  style={{ gridColumn: `${startIndex + 2} / ${endIndex + 2}`, gridRow: 1 }}
                  title={`${reservation.guestName}, room ${reservation.roomNumber}, ${reservation.checkIn} to ${reservation.checkOut}`}
                  aria-label={`Open reservation for ${reservation.guestName} in room ${reservation.roomNumber}`}
                >
                  <strong>{reservation.guestName}</strong>
                  <span>{reservation.checkIn} - {reservation.checkOut}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function ReservationDetailView({ hotelId, reservation }: { hotelId: string; reservation: ReservationSummary }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [checkoutTarget, setCheckoutTarget] = useState<ReservationSummary | null>(null);
  const [pending, startTransition] = useTransition();

  function updateStatus(nextStatus: ReservationStatus) {
    setMessage("");
    startTransition(() => {
      void fetch(`/api/hotels/${hotelId}/reservations/${reservation.id}/status`, {
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
          setCheckoutTarget(null);
          router.refresh();
        })
        .catch((error) => setMessage(error instanceof Error ? error.message : String(error)));
    });
  }

  const canCheckIn = reservation.status === "pending" || reservation.status === "confirmed";
  const canCheckOut = reservation.status === "checked-in";

  return (
    <section className="stack">
      {message ? <p className={statusMessageClassName(message)}>{message}</p> : null}
      <Panel title={`${reservation.guestName} - Room ${reservation.roomNumber}`}>
        <div className="reservation-detail-grid">
          <DetailItem label="Status" value={<StatusPill value={reservation.status} />} />
          <DetailItem label="Reservation ID" value={reservation.id} />
          <DetailItem label="Guest phone" value={reservation.guestPhone || "Not provided"} />
          <DetailItem label="Room type" value={reservation.roomType} />
          <DetailItem label="Check in" value={reservation.checkIn} />
          <DetailItem label="Check out" value={reservation.checkOut} />
          <DetailItem label="Guests" value={`${reservation.adults} adult${reservation.adults === 1 ? "" : "s"}, ${reservation.children} child${reservation.children === 1 ? "" : "ren"}`} />
          <DetailItem label="Source" value={reservation.source} />
          <DetailItem label="Nightly rate" value={<Money cents={reservation.nightlyRateCents} />} />
          <DetailItem label="Total" value={<Money cents={reservation.totalCents} />} />
        </div>
        {reservation.notes ? (
          <div className="reservation-notes">
            <strong>Notes</strong>
            <p>{reservation.notes}</p>
          </div>
        ) : null}
        <div className="actions reservation-detail-actions">
          {canCheckIn ? (
            <button type="button" className="primary-button" disabled={pending} onClick={() => updateStatus("checked-in")}>
              Check in
            </button>
          ) : null}
          {canCheckOut ? (
            <button type="button" className="danger-button" disabled={pending} onClick={() => setCheckoutTarget(reservation)}>
              Check out
            </button>
          ) : null}
          <Link className="button" href={`/hotels/${hotelId}/front-desk/reservations`}>
            Back to reservations
          </Link>
        </div>
      </Panel>
      <CheckoutConfirmDialog
        reservation={checkoutTarget}
        pending={pending}
        onCancel={() => setCheckoutTarget(null)}
        onConfirm={() => updateStatus("checked-out")}
      />
    </section>
  );
}

export function CheckoutConfirmDialog({
  reservation,
  pending,
  onCancel,
  onConfirm,
}: {
  reservation: ReservationSummary | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!reservation) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="checkout-confirm-title">
        <div className="stack">
          <div>
            <p className="eyebrow">Confirm checkout</p>
            <h2 id="checkout-confirm-title">Check out {reservation.guestName}?</h2>
            <p className="muted">
              Room {reservation.roomNumber} will move to dirty and a checkout turnover task will be created for housekeeping.
            </p>
          </div>
          <div className="actions">
            <button type="button" className="secondary-button" disabled={pending} onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="danger-button" disabled={pending} onClick={onConfirm}>
              Confirm checkout
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function FrontDeskReadiness({
  hotelName,
  today,
  availability,
}: {
  hotelName: string;
  today: TodayDeskPayload;
  availability?: FrontDeskReservationsPayload;
}) {
  const payload =
    availability ??
    ({
      today: today.today,
      rangeStart: today.today,
      rangeEnd: dateFromOffset(today.today, 2),
      rooms: today.rooms,
      reservations: [...today.arrivals, ...today.inHouse],
    } satisfies FrontDeskReservationsPayload);
  const roomTypeRows = summarizeRoomTypeAvailability(payload);
  const readyRooms = today.rooms.filter((room) => room.status === "ready" || room.status === "available");
  const housekeepingRooms = today.rooms.filter((room) => room.status === "dirty" || room.status === "cleaning");
  const blockedRooms = today.rooms.filter((room) => room.status === "maintenance");
  const pendingDepartures = today.departures.slice(0, 5);

  return (
    <Panel title="Room readiness and availability">
      <div className="readiness-heading">
        <div>
          <p className="muted">{hotelName}</p>
          <p>Fast answers for walk-ins, calls, and guests waiting at the desk.</p>
        </div>
      </div>
      <div className="readiness-snapshot">
        <ReadinessCard icon={<BedDouble size={18} />} label="Ready to sell" value={String(readyRooms.length)} tone="good" />
        <ReadinessCard icon={<ClipboardCheck size={18} />} label="Needs housekeeping" value={String(housekeepingRooms.length)} tone="warn" />
        <ReadinessCard icon={<Wrench size={18} />} label="Blocked / maintenance" value={String(blockedRooms.length)} tone="danger" />
        <ReadinessCard icon={<Clock size={18} />} label="Checking out soon" value={String(today.departures.length)} tone="neutral" />
      </div>

      <div className="availability-grid">
        <section className="availability-panel">
          <div className="section-heading">
            <h3>Sellable by room type</h3>
            <span className="muted">{payload.rangeStart} to {payload.rangeEnd}</span>
          </div>
          <div className="availability-table" role="table" aria-label="Room type availability">
            <div className="availability-row header" role="row">
              <span>Type</span>
              <span>Ready</span>
              <span>Tonight</span>
              <span>Longest open</span>
            </div>
            {roomTypeRows.map((row) => (
              <div className="availability-row" role="row" key={row.roomType}>
                <strong>{row.roomType}</strong>
                <span>{row.readyNow}</span>
                <span>{row.availableTonight}</span>
                <span>{row.longestOpenNights} night{row.longestOpenNights === 1 ? "" : "s"}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="availability-panel">
          <div className="section-heading">
            <h3>Operational focus</h3>
            <span className="muted">Today</span>
          </div>
          <div className="front-desk-focus-list">
            <FocusLine icon={<BedDouble size={16} />} label="Ready now" value={roomLabelList(readyRooms)} />
            <FocusLine icon={<ClipboardCheck size={16} />} label="Housekeeping" value={roomLabelList(housekeepingRooms)} />
            <FocusLine icon={<AlertTriangle size={16} />} label="Blocked" value={roomLabelList(blockedRooms)} />
            <FocusLine
              icon={<Clock size={16} />}
              label="Departures"
              value={pendingDepartures.length > 0 ? pendingDepartures.map((row) => `Room ${row.roomNumber}`).join(", ") : "No checked-in departures due today"}
            />
          </div>
        </section>
      </div>
    </Panel>
  );
}

function ReadinessCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "good" | "warn" | "danger" | "neutral" }) {
  return (
    <article className={`readiness-card tone-${tone}`}>
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <p>{label}</p>
      </div>
    </article>
  );
}

function FocusLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="focus-line">
      <span>{icon}</span>
      <strong>{label}</strong>
      <p>{value}</p>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
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

function reservationHref(hotelId: string, reservationId: string) {
  return `/hotels/${hotelId}/front-desk/reservations/${reservationId}`;
}

function statusMessageClassName(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("failed") || normalized.includes("cannot") ? "error-text" : "notice";
}

export function roomsForBookingBoard(rooms: Room[], reservations: ReservationSummary[], showAllRooms: boolean) {
  if (showAllRooms) return rooms;
  const bookedRoomIds = new Set(reservations.map((reservation) => reservation.roomId));
  return rooms.filter((room) => bookedRoomIds.has(room.id));
}

export function bookingDateLabelStep(dayCount: number) {
  if (dayCount <= 10) return 1;
  if (dayCount <= 21) return 2;
  if (dayCount <= 45) return 4;
  return 7;
}

export function summarizeRoomTypeAvailability(payload: FrontDeskReservationsPayload): RoomTypeAvailability[] {
  const dates = buildBookingBoardDates(payload.rangeStart, payload.rangeEnd);
  const tonightEnd = dateFromOffset(payload.rangeStart, 1);
  const roomsByType = new Map<string, Room[]>();
  payload.rooms.forEach((room) => {
    const rows = roomsByType.get(room.roomType) ?? [];
    rows.push(room);
    roomsByType.set(room.roomType, rows);
  });

  return [...roomsByType.entries()]
    .map(([roomType, rooms]) => {
      const sellableRooms = rooms.filter((room) => room.status === "ready" || room.status === "available");
      const reservationsForRooms = payload.reservations.filter((reservation) => rooms.some((room) => room.id === reservation.roomId));
      const availableTonight = sellableRooms.filter((room) =>
        reservationsForRooms.every((reservation) => reservation.roomId !== room.id || !reservationOverlaps(reservation, payload.rangeStart, tonightEnd)),
      ).length;
      const longestOpenNights = sellableRooms.reduce((longest, room) => {
        const roomReservations = reservationsForRooms
          .filter((reservation) => reservation.roomId === room.id && reservation.checkOut > payload.rangeStart)
          .sort((left, right) => left.checkIn.localeCompare(right.checkIn));
        const firstBlocking = roomReservations.find((reservation) => reservation.checkOut > payload.rangeStart);
        const openNights = firstBlocking
          ? Math.max(0, Math.min(dates.length, daysBetween(payload.rangeStart, firstBlocking.checkIn)))
          : dates.length;
        return Math.max(longest, openNights);
      }, 0);
      const nextBlockedDate =
        reservationsForRooms
          .filter((reservation) => reservation.checkIn >= payload.rangeStart)
          .sort((left, right) => left.checkIn.localeCompare(right.checkIn))[0]?.checkIn ?? null;

      return {
        roomType,
        totalRooms: rooms.length,
        readyNow: sellableRooms.length,
        availableTonight,
        longestOpenNights,
        nextBlockedDate,
      };
    })
    .sort((left, right) => right.availableTonight - left.availableTonight || right.readyNow - left.readyNow || left.roomType.localeCompare(right.roomType));
}

function reservationOverlaps(reservation: ReservationSummary, rangeStart: string, rangeEnd: string) {
  return reservation.checkIn < rangeEnd && reservation.checkOut > rangeStart;
}

function roomLabelList(rooms: Room[]) {
  if (rooms.length === 0) return "None";
  return rooms
    .slice(0, 8)
    .map((room) => `Room ${room.number}`)
    .join(", ");
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
