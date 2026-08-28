import { useState } from "react";
import { ChevronDown, ChevronUp, Package, Calendar, Truck, User } from "lucide-react";
import type { ShipmentRecord, ShipmentStatus } from "@/lib/shipment/types";

export function ShipmentMobileCard({
  record,
  index,
  renderStatusBadge,
}: {
  record: ShipmentRecord;
  index: number;
  renderStatusBadge: (st: ShipmentStatus) => React.ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const destination =
    [record.destinationCity, record.destinationCountry].filter(Boolean).join(", ") ||
    record.destinationCountry ||
    "—";

  const productDetails = record.productName || "No description provided";
  const isLongDescription = productDetails.length > 70;

  return (
    <article
      aria-label={`Shipment Order ${record.orderNumber || record.trackingNumber}`}
      className={`rounded-2xl border border-border bg-card p-4 shadow-soft transition-all duration-200 ${
        record.isDuplicate ? "border-border/80 bg-accent/20" : ""
      }`}
    >
      {/* Card Header: Order No + Status Badge */}
      <div className="flex items-start justify-between gap-2 border-b border-border/70 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              #{index + 1}
            </span>
            {record.isDuplicate && (
              <span className="rounded-full border border-border bg-surface px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                Duplicate
              </span>
            )}
          </div>
          <h3 className="mt-0.5 truncate font-display text-base font-semibold text-foreground">
            Order #{record.orderNumber || record.trackingNumber || "—"}
          </h3>
          {record.trackingNumber && record.trackingNumber !== record.orderNumber && (
            <p className="truncate text-[11px] text-muted-foreground">
              Tracking: <span className="font-medium text-foreground">{record.trackingNumber}</span>
            </p>
          )}
        </div>

        <div className="shrink-0">{renderStatusBadge(record.status)}</div>
      </div>

      {/* Bundle / Order Details */}
      <div className="border-b border-border/60 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Bundle / Order Details
        </p>
        <p className="mt-1 text-sm font-medium leading-snug text-foreground">
          {isExpanded || !isLongDescription ? productDetails : `${productDetails.slice(0, 68)}…`}
        </p>

        {isLongDescription && (
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            {isExpanded ? (
              <>
                Show Less <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                View Details <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Primary Compact Information Grid */}
      <div className="grid grid-cols-2 gap-2.5 pt-3 text-xs">
        <div className="rounded-xl border border-border/60 bg-surface/60 p-2.5">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            PCS
          </span>
          <span className="mt-0.5 block font-display text-base font-semibold tabular-nums text-foreground">
            {record.quantity ?? "—"}
          </span>
        </div>

        <div className="rounded-xl border border-border/60 bg-surface/60 p-2.5">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Weight
          </span>
          <span className="mt-0.5 block font-display text-base font-semibold tabular-nums text-foreground">
            {record.weightKg != null ? `${record.weightKg.toFixed(2)} kg` : "—"}
          </span>
        </div>

        <div className="rounded-xl border border-border/60 bg-surface/60 p-2.5">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Dimensions
          </span>
          <span className="mt-0.5 block truncate font-medium text-foreground">
            {record.dimensions || "—"}
          </span>
        </div>

        <div className="rounded-xl border border-border/60 bg-surface/60 p-2.5">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Country
          </span>
          <span className="mt-0.5 block truncate font-medium text-foreground">{destination}</span>
        </div>
      </div>

      {/* Expanded Metadata */}
      {isExpanded && (
        <div className="mt-3 space-y-2 rounded-xl border border-border/70 bg-surface/80 p-3 text-xs animate-in fade-in-50 duration-200">
          <div className="grid grid-cols-2 gap-2 text-muted-foreground">
            {record.shipmentDate && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3 w-3 shrink-0 text-muted-foreground/80" />
                <span className="truncate">Date: {record.shipmentDate}</span>
              </div>
            )}
            {record.packages != null && (
              <div className="flex items-center gap-1.5">
                <Package className="h-3 w-3 shrink-0 text-muted-foreground/80" />
                <span>Boxes: {record.packages}</span>
              </div>
            )}
            {record.carrier && (
              <div className="flex items-center gap-1.5">
                <Truck className="h-3 w-3 shrink-0 text-muted-foreground/80" />
                <span className="truncate">Carrier: {record.carrier}</span>
              </div>
            )}
            {record.supplier && (
              <div className="flex items-center gap-1.5">
                <User className="h-3 w-3 shrink-0 text-muted-foreground/80" />
                <span className="truncate">Supplier: {record.supplier}</span>
              </div>
            )}
          </div>

          {record.notes && (
            <div className="border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">Notes:</span> {record.notes}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
