import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ShoppingBag,
  Calculator,
  ArrowRight,
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useDashboardPayouts } from "@/lib/payout/useDashboardPayouts";
import type { AnalyticsPeriod, CurrencyCode, ChartDataPoint } from "@/lib/payout/analytics";
import { Button } from "@/components/ui/button";

const PERIODS: { id: AnalyticsPeriod; label: string; sublabel: string }[] = [
  { id: "7d", label: "7D", sublabel: "last 7 days" },
  { id: "12d", label: "12D", sublabel: "last 12 days" },
  { id: "30d", label: "30D", sublabel: "last 30 days" },
];

function formatCurrency(val: number | null | undefined, currency: CurrencyCode): string {
  if (val == null || Number.isNaN(val)) return currency === "usd" ? "$0.00" : "£0.00";
  const sym = currency === "usd" ? "$" : "£";
  return `${sym}${val.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function CustomChartTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDataPoint }>;
  currency: CurrencyCode;
}) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0]!.payload;

  return (
    <div className="rounded-xl border border-border/80 bg-card/95 p-3 shadow-lift backdrop-blur-md transition-all">
      <p className="text-[11px] font-medium text-muted-foreground">{item.fullDate || item.date}</p>
      <p className="mt-0.5 font-display text-base font-semibold text-foreground">
        {formatCurrency(item.amount, currency)}
      </p>
      {item.ordersCount > 0 && (
        <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">
          {item.ordersCount} {item.ordersCount === 1 ? "order" : "orders"}
        </p>
      )}
    </div>
  );
}

export function PayoutAnalyticsCard() {
  const { data, isLoading, isError, period, setPeriod, currency, setCurrency, refetch } =
    useDashboardPayouts("12d", "usd");

  const [, setHoveredPoint] = useState<ChartDataPoint | null>(null);

  const activePeriodMeta = PERIODS.find((p) => p.id === period) || PERIODS[1]!;

  // -------------------------------------------------------------
  // Loading State
  // -------------------------------------------------------------
  if (isLoading && !data) {
    return (
      <div className="w-full max-w-xl mx-auto rounded-[32px] border border-border/80 bg-card p-6 sm:p-8 shadow-soft animate-pulse">
        <div className="flex items-center justify-between gap-4">
          <div className="h-4 w-20 rounded-md bg-secondary/80" />
          <div className="h-9 w-44 rounded-full bg-secondary/80" />
        </div>
        <div className="mt-6 space-y-2">
          <div className="h-10 w-40 rounded-lg bg-secondary/80" />
          <div className="h-4 w-28 rounded-md bg-secondary/60" />
        </div>
        <div className="mt-8 h-48 w-full rounded-2xl bg-secondary/40" />
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-border/60 pt-6">
          <div className="h-10 rounded-xl bg-secondary/60" />
          <div className="h-10 rounded-xl bg-secondary/60" />
        </div>
        <div className="mt-6 h-11 w-full rounded-full bg-secondary/60" />
      </div>
    );
  }

  // -------------------------------------------------------------
  // Error State
  // -------------------------------------------------------------
  if (isError && !data) {
    return (
      <div className="w-full max-w-xl mx-auto rounded-[32px] border border-destructive/30 bg-card p-6 sm:p-8 shadow-soft text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="mt-4 font-display text-xl font-semibold text-foreground">
          Unable to load payout analytics
        </h3>
        <p className="mx-auto mt-2 max-w-xs text-xs text-muted-foreground">
          We encountered an issue fetching the latest payout records. Please try again.
        </p>
        <div className="mt-6 flex justify-center">
          <Button onClick={() => void refetch()} variant="outline" className="rounded-full gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const hasData = (data?.totalDatasetRecords ?? 0) > 0;

  // -------------------------------------------------------------
  // Empty State (No payout records uploaded yet)
  // -------------------------------------------------------------
  if (!hasData) {
    return (
      <div className="w-full max-w-xl mx-auto rounded-[32px] border border-border/80 bg-card p-6 sm:p-8 shadow-soft text-center">
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Payout
          </span>
          <div className="inline-flex rounded-full bg-secondary/70 p-0.5 border border-border/60">
            {PERIODS.map((p) => (
              <span key={p.id} className="px-2.5 py-1 text-xs font-medium text-muted-foreground/60">
                {p.label}
              </span>
            ))}
          </div>
        </div>

        <div className="py-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
            <FileSpreadsheet className="h-7 w-7" />
          </div>
          <h3 className="mt-4 font-display text-2xl font-semibold text-foreground">
            No payout data yet
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Upload payout orders on the Payout page to see your payout analytics and trends.
          </p>
          <div className="mt-6 flex justify-center">
            <Link to="/">
              <Button className="rounded-full gap-2 px-6">
                Go to Payouts <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Main Analytics Card
  // -------------------------------------------------------------
  const totalPayout = data?.totalPayout ?? 0;
  const percentageChange = data?.percentageChange ?? 0;
  const totalOrders = data?.totalOrders ?? 0;
  const averagePayout = data?.averagePayout ?? 0;
  const chartData = data?.chartData ?? [];

  const handleDownloadCSV = () => {
    if (!chartData || chartData.length === 0) {
      toast.error("No payout chart data available to export");
      return;
    }

    const headers = [
      "Upload Date (YYYY-MM-DD)",
      "Calendar Date",
      `Payout Amount (${currency.toUpperCase()})`,
      "Payout Amount (GBP)",
      "Orders / Batches Processed",
    ];

    const rows = chartData.map((d) => [
      `"${d.date}"`,
      `"${d.fullDate || d.label}"`,
      d.amount.toFixed(2),
      d.gbpAmount.toFixed(2),
      d.ordersCount,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    link.setAttribute("href", url);
    link.setAttribute("download", `payout-overview-${period}-${currency}-${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${chartData.length} days of payout data (${period.toUpperCase()})`);
  };

  const isPositive = percentageChange > 0;
  const isNegative = percentageChange < 0;
  const isZero = percentageChange === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-xl mx-auto rounded-[32px] border border-border/80 bg-card p-6 sm:p-8 shadow-soft hover:shadow-lift transition-all duration-300"
    >
      {/* Header: Title Eyebrow + Period Selector & Download Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Payout
          </span>
          {/* Subtle Currency Switcher */}
          <div className="flex items-center rounded-full border border-border/70 bg-surface px-1 py-0.5 text-[10px] font-semibold text-muted-foreground">
            <button
              type="button"
              onClick={() => setCurrency("usd")}
              className={`rounded-full px-2 py-0.5 transition-all ${
                currency === "usd"
                  ? "bg-primary text-primary-foreground font-bold"
                  : "hover:text-foreground"
              }`}
            >
              USD
            </button>
            <button
              type="button"
              onClick={() => setCurrency("gbp")}
              className={`rounded-full px-2 py-0.5 transition-all ${
                currency === "gbp"
                  ? "bg-primary text-primary-foreground font-bold"
                  : "hover:text-foreground"
              }`}
            >
              GBP
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Period Selector Segmented Capsule */}
          <div className="inline-flex rounded-full bg-secondary/80 p-1 border border-border/60">
            {PERIODS.map((p) => {
              const isActive = period === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id)}
                  className={`relative px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200 ${
                    isActive
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Download Chart Data Button (Excel / CSV) */}
          <button
            type="button"
            id="download-chart-data-btn"
            onClick={handleDownloadCSV}
            title="Download Chart Data (CSV)"
            aria-label="Download Chart Data"
            className="group relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-secondary/80 text-muted-foreground transition-all duration-200 hover:border-emerald-500/40 hover:bg-secondary hover:text-foreground active:scale-95 shadow-sm"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400 transition-transform group-hover:scale-110" />
          </button>
        </div>
      </div>

      {/* Main Metric Display & Percentage Change */}
      <div className="mt-5">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="font-display text-4xl sm:text-5xl font-normal tracking-tight text-foreground tabular-nums">
            {formatCurrency(totalPayout, currency)}
          </span>

          {/* Percentage badge */}
          <div
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
              isPositive
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : isNegative
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                  : "bg-secondary text-muted-foreground"
            }`}
          >
            {isPositive && <TrendingUp className="h-3.5 w-3.5" />}
            {isNegative && <TrendingDown className="h-3.5 w-3.5" />}
            {isZero && <Minus className="h-3 w-3" />}
            <span>
              {isPositive
                ? `↑ ${Math.abs(percentageChange)}%`
                : isNegative
                  ? `↓ ${Math.abs(percentageChange)}%`
                  : "0.0%"}
            </span>
          </div>
        </div>

        <p className="mt-1 text-xs text-muted-foreground">
          vs previous {activePeriodMeta.sublabel}
        </p>
      </div>

      {/* Modern Smooth Area Chart */}
      <div className="mt-6 -mx-2 sm:-mx-4 h-52 sm:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 12, right: 12, left: 12, bottom: 0 }}
            onMouseMove={(state) => {
              if (state?.activePayload?.[0]?.payload) {
                setHoveredPoint(state.activePayload[0].payload as ChartDataPoint);
              }
            }}
            onMouseLeave={() => setHoveredPoint(null)}
          >
            <defs>
              <linearGradient id="payoutAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="currentColor"
              strokeOpacity={0.07}
            />

            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)", opacity: 0.75 }}
              dy={8}
            />

            <Tooltip
              content={<CustomChartTooltip currency={currency} />}
              cursor={{
                stroke: "var(--color-border)",
                strokeWidth: 1,
                strokeDasharray: "4 4",
              }}
            />

            <Area
              type="monotone"
              dataKey="amount"
              stroke="var(--color-primary)"
              strokeWidth={2.5}
              fill="url(#payoutAreaGradient)"
              activeDot={{
                r: 5,
                strokeWidth: 2,
                stroke: "var(--color-card)",
                fill: "var(--color-primary)",
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Supporting Metric Information */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 border-t border-border/70 pt-5">
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/60 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
            <ShoppingBag className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Orders
            </span>
            <span className="mt-0.5 block font-display text-lg font-semibold tabular-nums text-foreground">
              {totalOrders}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/60 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
            <Calculator className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
              Average Payout
            </span>
            <span className="mt-0.5 block font-display text-lg font-semibold tabular-nums text-foreground truncate">
              {formatCurrency(averagePayout, currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Action: View Details -> Payout Page */}
      <div className="mt-5">
        <Link to="/" className="block">
          <Button
            variant="outline"
            className="w-full justify-center gap-2 rounded-full py-5 text-sm font-semibold border-border/80 hover:bg-secondary/80 transition-all active:scale-[0.99]"
          >
            <span>View details</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}
