import { Skeleton } from "@/components/ui/skeleton";
import { PayoutKpiCards } from "./PayoutKpiCards";
import type { PayoutKpiTotals } from "@/lib/payout/analytics";

export interface DashboardTotals extends PayoutKpiTotals {
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
      <PayoutKpiCards totals={totals} loading={loading} />
    </section>
  );
}
