import { ArrowRight, BedDouble, Building2, Gauge, Hotel, Wrench } from "lucide-react";
import Link from "next/link";
import { Money } from "@/components/format";
import { roleLabels } from "@/lib/roles";
import type { PortfolioDashboardPayload } from "@/lib/types";

export function PortfolioDashboard({ payload }: { payload: PortfolioDashboardPayload }) {
  return (
    <main className="container stack">
      <div className="page-title">
        <div>
          <p className="eyebrow">Admin overview</p>
          <h1>All hotels</h1>
          <p className="muted">Signed in as {payload.session.displayName}. Each hotel keeps isolated operations data.</p>
        </div>
      </div>
      <section className="grid metric-grid">
        <Metric icon={<Building2 size={18} />} label="Hotels" value={String(payload.totals.hotels)} />
        <Metric icon={<BedDouble size={18} />} label="Rooms" value={String(payload.totals.rooms)} />
        <Metric icon={<Gauge size={18} />} label="In house" value={String(payload.totals.inHouse)} />
        <Metric icon={<ArrowRight size={18} />} label="Arrivals today" value={String(payload.totals.arrivalsToday)} />
        <Metric icon={<Wrench size={18} />} label="Open maintenance" value={String(payload.totals.openMaintenance)} />
        <Metric icon={<Hotel size={18} />} label="Revenue" value={<Money cents={payload.totals.revenueCents} />} />
      </section>
      <section className="grid hotel-grid">
        {payload.hotels.map((row) => (
          <Link className="card card-link stack" key={row.hotel.id} href={`/hotels/${row.hotel.id}`}>
            <div>
              <p className="eyebrow">{roleLabels[row.role]}</p>
              <h2>{row.hotel.name}</h2>
              <p className="muted">{[row.hotel.city, row.hotel.state].filter(Boolean).join(", ") || "Hotel workspace"}</p>
            </div>
            <div className="grid metric-grid">
              <Mini label="Occupancy" value={`${row.stats.occupancyPercent}%`} />
              <Mini label="In house" value={String(row.stats.inHouse)} />
              <Mini label="Arrivals" value={String(row.stats.arrivalsToday)} />
              <Mini label="Maintenance" value={String(row.stats.openMaintenance)} />
            </div>
          </Link>
        ))}
      </section>
      {payload.hotels.length === 0 ? <p className="notice">No hotel invitations are active for this account yet.</p> : null}
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return <article className="metric-card"><span>{icon} {label}</span><strong>{value}</strong></article>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}
