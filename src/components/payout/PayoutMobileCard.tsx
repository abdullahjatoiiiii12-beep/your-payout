import { useState } from "react";
import { ChevronDown, ChevronUp, Calendar, Tag } from "lucide-react";
import type { PayoutRecord } from "@/lib/payout/types";

export function PayoutMobileCard({
  record,
  index,
  avgRate,
}: {
  record: PayoutRecord;
  index: number;
  avgRate: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const money = (v: number | null, cur: "£" | "$") =>
    v == null
      ? "—"
      : `${cur}${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const productDetails = record.productName || "No description provided";
  const isLongDescription = productDetails.length > 70;
  const dateDisplay = record.orderDate || record.payoutDate || "—";

  return (
    <article
      aria-label={`Payout Order ${record.orderNumber}`}
      className={`rounded-2xl border border-border bg-card p-4 shadow-soft transition-all duration-200 ${
        record.isDuplicate ? "border-border/80 bg-accent/20" : ""
      }`}
    >
      {/* Header: Order Number + Category / Duplicate Tag */}
      <div className="flex items-start justify-between gap-2 border-b border-border/70 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              #{index + 1}
            </span>
            {record.category && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/80 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                <Tag className="h-2.5 w-2.5" />
                {record.category}
              </span>
            )}
          </div>
          <h3 className="mt-0.5 truncate font-display text-base font-semibold text-foreground">
            Order #{record.orderNumber || "—"}
          </h3>
        </div>

        <div className="shrink-0 text-right">
          {record.isDuplicate ? (
            <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Duplicate
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {dateDisplay}
            </span>
          )}
        </div>
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
            GBP Amount
          </span>
          <span className="mt-0.5 block font-display text-base font-semibold tabular-nums text-foreground">
            {money(record.gbpAmount, "£")}
          </span>
        </div>

        <div className="rounded-xl border border-border/60 bg-surface/60 p-2.5">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            PCS (Quantity)
          </span>
          <span className="mt-0.5 block font-display text-base font-semibold tabular-nums text-foreground">
            {record.quantity ?? "—"}
          </span>
        </div>

        <div className="rounded-xl border border-border/60 bg-surface/60 p-2.5">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Balance
          </span>
          <span className="mt-0.5 block truncate font-display text-sm font-semibold tabular-nums text-foreground">
            {money(record.balance, "£")}
          </span>
        </div>

        <div className="rounded-xl border border-border/60 bg-surface/60 p-2.5">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Country
          </span>
          <span className="mt-0.5 block truncate font-medium text-foreground">
            {record.country || "—"}
          </span>
        </div>
      </div>

      {/* Additional Expanded Financial & Logistic Details */}
      {isExpanded && (
        <div className="mt-3 space-y-2 rounded-xl border border-border/70 bg-surface/80 p-3 text-xs animate-in fade-in-50 duration-200">
          <div className="grid grid-cols-2 gap-2 text-muted-foreground">
            <div>
              <span className="block text-[10px] font-semibold uppercase text-muted-foreground/90">
                Vendor Base Price
              </span>
              <span className="font-medium text-foreground">
                {money(record.vendorBasePrice, "£")}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-semibold uppercase text-muted-foreground/90">
                Discount
              </span>
              <span className="font-medium text-foreground">{money(record.discount, "£")}</span>
            </div>
            <div>
              <span className="block text-[10px] font-semibold uppercase text-muted-foreground/90">
                Total Base Price
              </span>
              <span className="font-medium text-foreground">
                {money(record.totalBasePrice, "£")}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-semibold uppercase text-muted-foreground/90">
                Fleek Commission
              </span>
              <span className="font-medium text-foreground">{money(record.commission, "£")}</span>
            </div>
            <div>
              <span className="block text-[10px] font-semibold uppercase text-muted-foreground/90">
                USD Est. (Rate {avgRate})
              </span>
              <span className="font-medium text-foreground">
                {record.gbpAmount == null
                  ? "—"
                  : money(+(record.gbpAmount * avgRate).toFixed(2), "$")}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-semibold uppercase text-muted-foreground/90">
                Weight / Packages
              </span>
              <span className="font-medium text-foreground">
                {record.weightKg ? `${record.weightKg} kg` : "—"}
                {record.packages ? ` (${record.packages} boxes)` : ""}
              </span>
            </div>
          </div>

          {(record.supplier || record.dimensions) && (
            <div className="flex flex-col gap-1 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
              {record.supplier && (
                <div>
                  <span className="font-semibold text-foreground">Supplier:</span> {record.supplier}
                </div>
              )}
              {record.dimensions && (
                <div>
                  <span className="font-semibold text-foreground">Dimensions:</span>{" "}
                  {record.dimensions}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
