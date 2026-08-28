import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Skeleton } from "@/components/ui/skeleton";

function useCountUp(value: number, duration = 700) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const initial = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(initial + (value - initial) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return display;
}

function Stat({
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
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-[96px] rounded-2xl border border-border bg-card p-4 shadow-soft transition-transform duration-200 hover:-translate-y-0.5 sm:p-5"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl leading-none tabular-nums sm:text-4xl">
        {prefix}
        {animated.toLocaleString("en-GB", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}
      </p>
    </motion.div>
  );
}

export interface DashboardTotals {
  records: number;
  gbp: number;
  usd: number;
  quantity: number;
  packages: number;
  vendorBasePrice: number;
  discount: number;
  totalBasePrice: number;
  commission: number;
  balance: number;
  pdfs: number;
  lastUpdated: string | null;
}

export function Dashboard({
  totals,
  loading = false,
}: {
  totals: DashboardTotals;
  loading?: boolean;
}) {
  return (
    <section aria-label="Summary" className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl">Master overview</h2>
        <div className="text-xs text-muted-foreground">
          {loading ? (
            <Skeleton className="h-4 w-36" />
          ) : (
            <>
              Last updated:{" "}
              <span className="font-medium text-foreground">
                {totals.lastUpdated
                  ? new Date(totals.lastUpdated).toLocaleString("en-GB")
                  : "No imports yet"}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {loading ? (
          Array.from({ length: 11 }).map((_, i) => (
            <div
              key={i}
              className="min-h-[96px] rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5"
            >
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-3 h-8 w-24" />
            </div>
          ))
        ) : (
          <>
            <Stat index={0} label="Total records" value={totals.records} />
            <Stat index={1} label="Total GBP" value={totals.gbp} prefix="£" decimals={2} />
            <Stat index={2} label="Total USD" value={totals.usd} prefix="$" decimals={2} />
            <Stat index={3} label="Total quantity" value={totals.quantity} />
            <Stat index={4} label="Total packages" value={totals.packages} />
            <Stat index={5} label="PDFs imported" value={totals.pdfs} />
            <Stat
              index={6}
              label="Vendor base price"
              value={totals.vendorBasePrice}
              prefix="£"
              decimals={2}
            />
            <Stat index={7} label="Discount" value={totals.discount} prefix="£" decimals={2} />
            <Stat
              index={8}
              label="Total base price"
              value={totals.totalBasePrice}
              prefix="£"
              decimals={2}
            />
            <Stat
              index={9}
              label="Fleek commission"
              value={totals.commission}
              prefix="£"
              decimals={2}
            />
            <Stat index={10} label="Balance" value={totals.balance} prefix="£" decimals={2} />
          </>
        )}
      </div>
    </section>
  );
}
