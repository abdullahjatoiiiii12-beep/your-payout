import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Skeleton } from "@/components/ui/skeleton";
import type { PayoutKpiTotals } from "@/lib/payout/analytics";

function useCountUp(value: number, duration = 800) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    let start: number | null = null;
    const from = fromRef.current;
    const diff = value - from;
    if (diff === 0) return;
    let raf = 0;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + diff * eased;
      setDisplay(current);
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      } else {
        fromRef.current = value;
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
}

export function StatCard({
  label,
  value,
  prefix = "",
  decimals = 0,
  index,
}: {
  label: string;
  value: number;
  prefix?: string;
  decimals?: number;
  index: number;
}) {
  const animated = useCountUp(value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-[100px] sm:min-h-[108px] rounded-2xl border border-border/80 bg-card p-4 shadow-soft transition-transform duration-200 hover:-translate-y-0.5 sm:p-5 flex flex-col justify-between"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl leading-none tabular-nums sm:text-4xl text-foreground font-normal">
        {prefix}
        {animated.toLocaleString("en-GB", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}
      </p>
    </motion.div>
  );
}

export function FileNameCard({
  label = "Payout file",
  fileName,
  totalFilesCount = 0,
  index,
}: {
  label?: string;
  fileName?: string;
  totalFilesCount?: number;
  index: number;
}) {
  const cleanName = (fileName || "").trim();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-[100px] sm:min-h-[108px] rounded-2xl border border-border/80 bg-card p-4 shadow-soft transition-transform duration-200 hover:-translate-y-0.5 sm:p-5 flex flex-col justify-between"
    >
      <div className="flex items-center justify-between gap-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground truncate">
          {label}
        </p>
        {totalFilesCount > 1 && (
          <span className="rounded-full bg-secondary/80 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground shrink-0">
            +{totalFilesCount - 1} more
          </span>
        )}
      </div>

      {/* Centered file name as requested: "payout ke file pr jo name hoga bs wahi name ayi kip card ke center me" */}
      <div className="my-auto flex w-full items-center justify-center py-1">
        {cleanName ? (
          <p
            title={cleanName}
            className="text-center font-display text-base sm:text-lg font-medium text-foreground tracking-tight line-clamp-2 break-all"
          >
            {cleanName}
          </p>
        ) : (
          <p className="text-center text-sm font-medium text-muted-foreground tracking-normal">
            No file uploaded
          </p>
        )}
      </div>
    </motion.div>
  );
}

export interface PayoutKpiCardsProps {
  totals?: PayoutKpiTotals | null;
  loading?: boolean;
  className?: string;
}

export function PayoutKpiCards({ totals, loading = false, className = "" }: PayoutKpiCardsProps) {
  const safeTotals: PayoutKpiTotals = totals ?? {
    records: 0,
    gbp: 0,
    usd: 0,
    quantity: 0,
    packages: 0,
    fileName: "",
    fileNames: [],
    vendorBasePrice: 0,
    discount: 0,
    totalBasePrice: 0,
    commission: 0,
    balance: 0,
    pdfs: 0,
  };

  const primaryFileName =
    safeTotals.fileName ||
    (safeTotals.fileNames && safeTotals.fileNames.length > 0 ? safeTotals.fileNames[0] : "");

  return (
    <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 ${className}`}>
      {loading ? (
        Array.from({ length: 11 }).map((_, i) => (
          <div
            key={i}
            className="min-h-[100px] sm:min-h-[108px] rounded-2xl border border-border/80 bg-card p-4 shadow-soft sm:p-5 flex flex-col justify-between"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-8 w-24" />
          </div>
        ))
      ) : (
        <>
          {/* Row 1 (6 cards) matching upload design reference image */}
          <StatCard index={0} label="Total records" value={safeTotals.records} />
          <StatCard index={1} label="Total GBP" value={safeTotals.gbp} prefix="£" decimals={2} />
          <StatCard index={2} label="Total USD" value={safeTotals.usd} prefix="$" decimals={2} />
          <StatCard index={3} label="Total quantity" value={safeTotals.quantity} />
          <StatCard index={4} label="Total packages" value={safeTotals.packages} />
          <FileNameCard
            index={5}
            label="Payout file"
            fileName={primaryFileName}
            totalFilesCount={safeTotals.pdfs || safeTotals.fileNames?.length || 0}
          />

          {/* Row 2 (5 cards) matching upload design reference image */}
          <StatCard
            index={6}
            label="Vendor base price"
            value={safeTotals.vendorBasePrice}
            prefix="£"
            decimals={2}
          />
          <StatCard
            index={7}
            label="Discount"
            value={safeTotals.discount}
            prefix="£"
            decimals={2}
          />
          <StatCard
            index={8}
            label="Total base price"
            value={safeTotals.totalBasePrice}
            prefix="£"
            decimals={2}
          />
          <StatCard
            index={9}
            label="Fleek commission"
            value={safeTotals.commission}
            prefix="£"
            decimals={2}
          />
          <StatCard index={10} label="Balance" value={safeTotals.balance} prefix="£" decimals={2} />
        </>
      )}
    </div>
  );
}
