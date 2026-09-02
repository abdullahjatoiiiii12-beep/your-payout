import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Truck,
  Package,
  PackageCheck,
  Clock,
  ArrowRight,
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import { useDashboardShipments } from "@/lib/shipment/useDashboardShipments";
import type { ShipmentRange, ShipmentChartDataPoint } from "@/lib/shipment/analytics";
import { Button } from "@/components/ui/button";

const RANGES: { id: ShipmentRange; label: string; sublabel: string }[] = [
  { id: "7d", label: "7d", sublabel: "last 7 days" },
  { id: "12d", label: "12d", sublabel: "last 12 days" },
  { id: "30d", label: "30d", sublabel: "last 30 days" },
];

function CustomShipmentTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ShipmentChartDataPoint }>;
}) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0]!.payload;

  return (
    <div className="rounded-xl border border-border/80 bg-card/95 p-3 shadow-lift backdrop-blur-md transition-all">
      <p className="text-[11px] font-medium text-muted-foreground">{item.fullDate || item.date}</p>
      <p className="mt-0.5 font-display text-base font-semibold text-foreground">
        {item.shipments} {item.shipments === 1 ? "Shipment" : "Shipments"}
      </p>
      {(item.received > 0 || item.inTransit > 0 || item.pending > 0) && (
        <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
          {item.received > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {item.received} received
            </span>
          )}
          {item.inTransit > 0 && (
            <span className="text-sky-600 dark:text-sky-400 font-medium">
              {item.inTransit} in transit
            </span>
          )}
          {item.pending > 0 && (
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              {item.pending} pending
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function ShipmentOverviewCard() {
  const { data, isLoading, isError, range, setRange, refetch } = useDashboardShipments("12d");
  const [, setHoveredPoint] = useState<ShipmentChartDataPoint | null>(null);

  const activeRangeMeta = RANGES.find((r) => r.id === range) || RANGES[1]!;

  // -------------------------------------------------------------
  // Loading State
  // -------------------------------------------------------------
  if (isLoading && !data) {
    return (
      <div className="w-full max-w-xl mx-auto rounded-[32px] border border-border/80 bg-card p-6 sm:p-8 shadow-soft animate-pulse">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="h-4 w-28 rounded-md bg-secondary/80" />
            <div className="h-3 w-44 rounded-md bg-secondary/50" />
          </div>
          <div className="h-8 w-32 rounded-full bg-secondary/80" />
        </div>
        <div className="mt-6 space-y-2">
          <div className="h-10 w-32 rounded-lg bg-secondary/80" />
          <div className="h-4 w-24 rounded-md bg-secondary/60" />
        </div>
        <div className="mt-8 h-48 w-full rounded-2xl bg-secondary/40" />
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-border/60 pt-6">
          <div className="h-12 rounded-xl bg-secondary/60" />
          <div className="h-12 rounded-xl bg-secondary/60" />
          <div className="h-12 rounded-xl bg-secondary/60" />
          <div className="h-12 rounded-xl bg-secondary/60" />
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
          Unable to load shipment data
        </h3>
        <p className="mx-auto mt-2 max-w-xs text-xs text-muted-foreground">
          Please try again later or check your network connection.
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
  // Empty State (No shipment records uploaded yet)
  // -------------------------------------------------------------
  if (!hasData) {
    return (
      <div className="w-full max-w-xl mx-auto rounded-[32px] border border-border/80 bg-card p-6 sm:p-8 shadow-soft text-center">
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="text-left">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Shipment Overview
            </span>
            <p className="text-xs text-muted-foreground">
              Shipment activity and delivery status over time
            </p>
          </div>
          <div className="inline-flex rounded-full bg-secondary/70 p-0.5 border border-border/60">
            {RANGES.map((r) => (
              <span key={r.id} className="px-2.5 py-1 text-xs font-medium text-muted-foreground/60">
                {r.label}
              </span>
            ))}
          </div>
        </div>

        <div className="py-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
            <FileSpreadsheet className="h-7 w-7" />
          </div>
          <h3 className="mt-4 font-display text-2xl font-semibold text-foreground">
            No shipment data yet
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Upload shipment orders from the Shipment Page to see shipment analytics here.
          </p>
          <div className="mt-6 flex justify-center">
            <Link to="/shipments">
              <Button className="rounded-full gap-2 px-6">
                Go to Shipments <ArrowRight className="h-4 w-4" />
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
  const totalShipments = data?.totalShipments ?? 0;
  const changePercentage = data?.changePercentage ?? 0;
  const statusSummary = data?.statusSummary ?? {
    total: 0,
    inTransit: 0,
    received: 0,
    pending: 0,
    delivered: 0,
    dispatched: 0,
    exception: 0,
  };
  const timeline = data?.timeline ?? [];

  const isPositive = changePercentage > 0;
  const isNegative = changePercentage < 0;
  const isZero = changePercentage === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-xl mx-auto rounded-[32px] border border-border/80 bg-card p-6 sm:p-8 shadow-soft hover:shadow-lift transition-all duration-300"
    >
      {/* Header: Title & Subtitle + Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Shipment Overview
          </span>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Shipment activity and delivery status over time
          </p>
        </div>

        {/* Time Range Selector Capsule */}
        <div className="inline-flex self-start sm:self-auto rounded-full bg-secondary/80 p-1 border border-border/60">
          {RANGES.map((r) => {
            const isActive = range === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                className={`relative px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200 ${
                  isActive
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Shipment Metric Display */}
      <div className="mt-5">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="font-display text-4xl sm:text-5xl font-normal tracking-tight text-foreground tabular-nums">
            {totalShipments.toLocaleString()}
          </span>

          {/* Percentage change indicator */}
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
                ? `↑ ${Math.abs(changePercentage)}%`
                : isNegative
                  ? `↓ ${Math.abs(changePercentage)}%`
                  : "0.0%"}
            </span>
          </div>
        </div>

        <p className="mt-1 text-xs text-muted-foreground">
          Total shipments in {activeRangeMeta.sublabel} vs previous period
        </p>
      </div>

      {/* Smooth Area/Line Chart */}
      <div className="mt-6 -mx-2 sm:-mx-4 h-52 sm:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={timeline}
            margin={{ top: 12, right: 12, left: 12, bottom: 0 }}
            onMouseMove={(state) => {
              if (state?.activePayload?.[0]?.payload) {
                setHoveredPoint(state.activePayload[0].payload as ShipmentChartDataPoint);
              }
            }}
            onMouseLeave={() => setHoveredPoint(null)}
          >
            <defs>
              <linearGradient id="shipmentAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
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
              content={<CustomShipmentTooltip />}
              cursor={{
                stroke: "var(--color-border)",
                strokeWidth: 1,
                strokeDasharray: "4 4",
              }}
            />

            <Area
              type="monotone"
              dataKey="shipments"
              stroke="#10b981"
              strokeWidth={2.5}
              fill="url(#shipmentAreaGradient)"
              activeDot={{
                r: 5,
                strokeWidth: 2,
                stroke: "var(--color-card)",
                fill: "#10b981",
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Compact 4-Stat Grid Based on Real Data */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 border-t border-border/70 pt-5">
        {/* Stat 1: Total Shipments */}
        <div className="rounded-2xl border border-border/60 bg-surface/60 p-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Package className="h-3.5 w-3.5 text-foreground" />
            <span className="text-[10px] font-semibold uppercase tracking-wider truncate">
              Total
            </span>
          </div>
          <span className="mt-1.5 block font-display text-lg font-semibold tabular-nums text-foreground">
            {statusSummary.total}
          </span>
        </div>

        {/* Stat 2: In Transit */}
        <div className="rounded-2xl border border-border/60 bg-surface/60 p-3">
          <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
            <Truck className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
              In Transit
            </span>
          </div>
          <span className="mt-1.5 block font-display text-lg font-semibold tabular-nums text-foreground">
            {statusSummary.inTransit}
          </span>
        </div>

        {/* Stat 3: Received */}
        <div className="rounded-2xl border border-border/60 bg-surface/60 p-3">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <PackageCheck className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
              Received
            </span>
          </div>
          <span className="mt-1.5 block font-display text-lg font-semibold tabular-nums text-foreground">
            {statusSummary.received}
          </span>
        </div>

        {/* Stat 4: Pending */}
        <div className="rounded-2xl border border-border/60 bg-surface/60 p-3">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
              Pending
            </span>
          </div>
          <span className="mt-1.5 block font-display text-lg font-semibold tabular-nums text-foreground">
            {statusSummary.pending}
          </span>
        </div>
      </div>

      {/* Action: View Details -> Shipment Page */}
      <div className="mt-5">
        <Link to="/shipments" className="block">
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
