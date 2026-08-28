import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  title?: string;
  columns?: string[];
  rowCount?: number;
}

export function TableSkeleton({
  title = "Master records",
  columns = [
    "S NO.",
    "DATE",
    "CATEGORY",
    "ORDER NO.",
    "STATUS",
    "PRODUCT / CARGO",
    "QTY (PCS)",
    "WEIGHT (KGS)",
    "BASE PRICE",
    "TOTAL",
  ],
  rowCount = 6,
}: TableSkeletonProps) {
  return (
    <section
      aria-label="Loading records"
      className="mx-auto w-full max-w-[98%] 2xl:max-w-[1720px] px-2 sm:px-4 lg:px-6 transition-opacity duration-300"
    >
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6 min-h-[480px]">
        {/* Top Control Bar Skeleton */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-border/70">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl">{title}</h2>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-10 w-48 sm:w-64 rounded-xl" />
            <Skeleton className="h-10 w-24 rounded-xl" />
            <Skeleton className="h-10 w-24 rounded-xl" />
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left">
                {columns.map((col, idx) => (
                  <th
                    key={idx}
                    className="px-3 py-3.5 text-xs font-semibold text-muted-foreground whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rowCount }).map((_, rIdx) => (
                <tr key={rIdx} className="border-b border-border/40">
                  {columns.map((_, cIdx) => (
                    <td key={cIdx} className="px-3 py-4">
                      <Skeleton
                        className={`h-4 rounded-md ${
                          cIdx === 0
                            ? "w-6"
                            : cIdx === 1 || cIdx === 3
                              ? "w-20"
                              : cIdx === 5
                                ? "w-44"
                                : "w-14"
                        }`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination Bar Skeleton */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-border/70 mt-4">
          <Skeleton className="h-4 w-36" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-20 rounded-xl" />
            <Skeleton className="h-9 w-20 rounded-xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
