export function StatusPill({ value }: { value: string }) {
  return <span className={`status-pill status-${value}`}>{value.replace(/-/g, " ")}</span>;
}

export function Money({ cents }: { cents: number }) {
  return <>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100)}</>;
}