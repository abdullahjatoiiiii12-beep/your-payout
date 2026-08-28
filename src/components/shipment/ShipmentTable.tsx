import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Inbox,
  Search,
  CheckCircle2,
  Truck,
  Clock,
  AlertTriangle,
  SlidersHorizontal,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ShipmentRecord, ShipmentStatus } from "@/lib/shipment/types";
import { ShipmentMobileCard } from "./ShipmentMobileCard";

const ALL = "__all__";
const PAGE_SIZES = [25, 50, 100, 250];

type SortKey = "date" | "weight" | "cost" | "packages";
type DupFilter = "all" | "unique" | "duplicates";

export function ShipmentTable({
  records,
  avgRate,
}: {
  records: ShipmentRecord[];
  avgRate: number;
}) {
  const [query, setQuery] = useState("");
  const [carrier, setCarrier] = useState(ALL);
  const [supplier, setSupplier] = useState(ALL);
  const [country, setCountry] = useState(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [month, setMonth] = useState(ALL);
  const [dupFilter, setDupFilter] = useState<DupFilter>("all");
  const [pageSize, setPageSize] = useState(100);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [asc, setAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [activeRecord, setActiveRecord] = useState<ShipmentRecord | null>(null);

  const carriers = useMemo(
    () => [...new Set(records.map((r) => r.carrier).filter(Boolean))].sort(),
    [records],
  );
  const suppliers = useMemo(
    () => [...new Set(records.map((r) => r.supplier).filter(Boolean))].sort(),
    [records],
  );
  const countries = useMemo(
    () => [...new Set(records.map((r) => r.destinationCountry).filter(Boolean))].sort(),
    [records],
  );
  const months = useMemo(
    () =>
      [...new Set(records.map((r) => (r.shipmentDate || "").slice(0, 7)).filter(Boolean))]
        .sort()
        .reverse(),
    [records],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = records.filter((r) => {
      if (carrier !== ALL && r.carrier !== carrier) return false;
      if (supplier !== ALL && r.supplier !== supplier) return false;
      if (country !== ALL && r.destinationCountry !== country) return false;
      if (status !== ALL && r.status !== status) return false;
      if (month !== ALL && !(r.shipmentDate || "").startsWith(month)) return false;
      if (dupFilter === "unique" && r.isDuplicate) return false;
      if (dupFilter === "duplicates" && !r.isDuplicate) return false;
      if (!q) return true;
      return [
        r.trackingNumber,
        r.orderNumber,
        r.productName,
        r.supplier,
        r.recipientName,
        r.destinationCity,
        r.destinationCountry,
        r.carrier,
        r.sourceFile,
        r.notes,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    out.sort((a, b) => {
      let v = 0;
      if (sortKey === "date") {
        v = (a.shipmentDate || "").localeCompare(b.shipmentDate || "");
      } else if (sortKey === "weight") {
        v = (a.weightKg ?? 0) - (b.weightKg ?? 0);
      } else if (sortKey === "cost") {
        v = (a.shippingCost ?? 0) - (b.shippingCost ?? 0);
      } else if (sortKey === "packages") {
        v = (a.packages ?? 0) - (b.packages ?? 0);
      }
      return asc ? v : -v;
    });

    return out;
  }, [records, query, carrier, supplier, country, status, month, dupFilter, sortKey, asc]);

  const duplicateCount = useMemo(() => records.filter((r) => r.isDuplicate).length, [records]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * pageSize, current * pageSize);

  const money = (v: number | null, cur: "£" | "$") =>
    v == null
      ? ""
      : `${cur}${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const renderStatusBadge = (st: ShipmentStatus) => {
    switch (st) {
      case "Delivered":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            Delivered
          </span>
        );
      case "Received":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 shadow-xs">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            Payment Received
          </span>
        );
      case "In Transit":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
            <Truck className="h-3 w-3 text-muted-foreground" />
            In Transit
          </span>
        );
      case "Dispatched":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
            <Clock className="h-3 w-3" />
            Dispatched
          </span>
        );
      case "Exception":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-destructive/20 bg-destructive/10 px-2.5 py-0.5 text-[11px] font-semibold text-destructive">
            <AlertTriangle className="h-3 w-3" />
            Exception
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {st}
          </span>
        );
    }
  };

  return (
    <section className="mx-auto w-full max-w-[98%] 2xl:max-w-[1720px] px-2 sm:px-4 lg:px-6">
      <div className="rounded-3xl border border-border bg-card shadow-soft">
        {/* Controls */}
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:p-5 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search tracking #, order, cargo, carrier or country…"
              className="h-10 rounded-xl pl-9"
            />
          </div>

          {/* Filters Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <FilterSelect
              value={carrier}
              onChange={(v) => {
                setCarrier(v);
                setPage(1);
              }}
              label="Carrier"
              plural="All carriers"
              options={carriers}
            />
            <FilterSelect
              value={supplier}
              onChange={(v) => {
                setSupplier(v);
                setPage(1);
              }}
              label="Supplier"
              plural="All suppliers"
              options={suppliers}
            />
            <FilterSelect
              value={country}
              onChange={(v) => {
                setCountry(v);
                setPage(1);
              }}
              label="Country"
              plural="All countries"
              options={countries}
            />
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                <SelectItem value="Delivered">Delivered</SelectItem>
                <SelectItem value="Received">Payment Received</SelectItem>
                <SelectItem value="In Transit">In Transit</SelectItem>
                <SelectItem value="Dispatched">Dispatched</SelectItem>
                <SelectItem value="Out for Delivery">Out for Delivery</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Exception">Exception</SelectItem>
              </SelectContent>
            </Select>

            <FilterSelect
              value={month}
              onChange={(v) => {
                setMonth(v);
                setPage(1);
              }}
              label="Month"
              plural="All dates"
              options={months}
            />

            <Select
              value={dupFilter}
              onValueChange={(v) => {
                setDupFilter(v as DupFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder="Duplicates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All shipments ({records.length})</SelectItem>
                <SelectItem value="unique">
                  Unique only ({records.length - duplicateCount})
                </SelectItem>
                <SelectItem value="duplicates">Duplicates only ({duplicateCount})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Secondary Row for Sort & Page Size */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface/50 px-4 py-2.5 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Sort by:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["date", "Date"],
                  ["weight", "Weight"],
                  ["cost", "Freight Cost"],
                  ["packages", "Packages"],
                ] as const
              ).map(([key, label]) => (
                <Button
                  key={key}
                  variant={sortKey === key ? "default" : "outline"}
                  size="sm"
                  className="h-7 rounded-lg text-xs"
                  onClick={() => {
                    if (sortKey === key) {
                      setAsc((a) => !a);
                    } else {
                      setSortKey(key);
                      setAsc(false);
                    }
                  }}
                >
                  <ArrowUpDown className="mr-1 h-3 w-3" />
                  {label} {sortKey === key && (asc ? "↑" : "↓")}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Page size:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-7 w-24 rounded-lg text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-xs">
                    {n} rows
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface">
              <Inbox className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-4 font-display text-xl">
              {records.length === 0
                ? "No shipment records yet"
                : "No shipments match those filters"}
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {records.length === 0
                ? "Upload your shipment spreadsheets (.xlsx, .csv) above to extract and manage your logistics fleet."
                : "Try adjusting your search query or clearing active filters."}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile View: Clean Responsive Cards (< md) */}
            <div className="block md:hidden p-3 sm:p-4 space-y-3">
              {rows.map((r, i) => (
                <ShipmentMobileCard
                  key={r.id}
                  record={r}
                  index={(current - 1) * pageSize + i}
                  renderStatusBadge={renderStatusBadge}
                />
              ))}
            </div>

            {/* Desktop / Tablet View: Complete Data Table (>= md) */}
            <div className="hidden md:block max-h-[36rem] overflow-auto rounded-b-3xl">
              <table className="w-full min-w-[1000px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur">
                  <tr className="text-left">
                    {[
                      "S NO.",
                      "SHIP DATE",
                      "STATUS",
                      "ORDER NO.",
                      "PRODUCT / CARGO",
                      "QTY (PCS)",
                      "PACKAGES",
                      "WEIGHT (KGS)",
                      "DIMENSIONS",
                      "DESTINATION",
                    ].map((h) => (
                      <th
                        key={h}
                        className="whitespace-nowrap border-b border-border px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={r.id}
                      className={`border-b border-border/70 transition-colors hover:bg-accent/60 ${
                        r.isDuplicate ? "bg-accent/40" : ""
                      }`}
                    >
                      <Td>{(current - 1) * pageSize + i + 1}</Td>
                      <Td>{r.shipmentDate}</Td>
                      <Td>
                        <div className="flex items-center gap-1.5">
                          {renderStatusBadge(r.status)}
                          {r.isDuplicate && (
                            <span className="rounded-full border border-border bg-surface px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Dup
                            </span>
                          )}
                        </div>
                      </Td>
                      <Td className="font-medium">{r.orderNumber}</Td>
                      <Td className="max-w-[20rem] truncate">{r.productName}</Td>
                      <Td className="tabular-nums">{r.quantity ?? ""}</Td>
                      <Td className="tabular-nums font-medium">{r.packages ?? ""}</Td>
                      <Td className="tabular-nums">
                        {r.weightKg != null ? `${r.weightKg.toFixed(2)} kg` : ""}
                      </Td>
                      <Td className="text-xs text-muted-foreground">{r.dimensions || "—"}</Td>
                      <Td>
                        {[r.destinationCity, r.destinationCountry].filter(Boolean).join(", ") ||
                          "—"}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-border p-4">
            <p className="text-xs text-muted-foreground">
              Showing {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, filtered.length)}{" "}
              of {filtered.length}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                disabled={current === 1}
                onClick={() => setPage(current - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                disabled={current === pages}
                onClick={() => setPage(current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Record Inspector Dialog */}
      <Dialog open={!!activeRecord} onOpenChange={(open) => !open && setActiveRecord(null)}>
        <DialogContent className="max-w-xl rounded-3xl p-6 sm:p-8">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Shipment Record Details
              </span>
              {activeRecord && renderStatusBadge(activeRecord.status)}
            </div>
            <DialogTitle className="font-display text-2xl">
              {activeRecord?.trackingNumber}
            </DialogTitle>
            <DialogDescription>
              Order:{" "}
              <span className="font-semibold text-foreground">{activeRecord?.orderNumber}</span> •
              Source File:{" "}
              <span className="font-medium text-foreground">{activeRecord?.sourceFile}</span>
            </DialogDescription>
          </DialogHeader>

          {activeRecord && (
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <DetailBlock label="Ship Date" value={activeRecord.shipmentDate || "—"} />
              <DetailBlock label="Carrier" value={activeRecord.carrier} />
              <DetailBlock label="Supplier" value={activeRecord.supplier} />
              <DetailBlock label="Recipient" value={activeRecord.recipientName || "—"} />
              <DetailBlock
                label="Destination"
                value={[activeRecord.destinationCity, activeRecord.destinationCountry]
                  .filter(Boolean)
                  .join(", ")}
              />
              <DetailBlock label="Category" value={activeRecord.category || "—"} />
              <DetailBlock label="Quantity (Pcs)" value={activeRecord.quantity ?? "—"} />
              <DetailBlock label="Packages (Boxes)" value={activeRecord.packages ?? "—"} />
              <DetailBlock
                label="Weight"
                value={activeRecord.weightKg != null ? `${activeRecord.weightKg} kg` : "—"}
              />
              <DetailBlock label="Dimensions" value={activeRecord.dimensions || "—"} />
              <DetailBlock
                label="Shipping Cost (GBP)"
                value={money(activeRecord.shippingCost, "£")}
              />
              <DetailBlock
                label="USD Converted"
                value={
                  activeRecord.shippingCost != null
                    ? money(+(activeRecord.shippingCost * avgRate).toFixed(2), "$")
                    : "—"
                }
              />
              <DetailBlock label="Declared Value" value={money(activeRecord.declaredValue, "£")} />
              <DetailBlock label="Customs / Duty" value={money(activeRecord.customsFee, "£")} />
              <DetailBlock
                label="Imported At"
                value={new Date(activeRecord.importedAt).toLocaleString("en-GB")}
              />
              <div className="col-span-2 sm:col-span-3 rounded-xl border border-border bg-surface p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Product / Cargo Description
                </p>
                <p className="mt-1 text-sm font-medium">{activeRecord.productName}</p>
                {activeRecord.notes && (
                  <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Notes:</span> {activeRecord.notes}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function DetailBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate font-medium">{value}</p>
    </div>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-3 py-2.5 align-middle ${className}`}>{children}</td>;
}

function FilterSelect({
  value,
  onChange,
  label,
  plural,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  plural: string;
  options: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10 rounded-xl">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{plural}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
