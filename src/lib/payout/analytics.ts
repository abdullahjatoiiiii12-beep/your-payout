import type { PayoutRecord } from "./types";
import { normaliseDate } from "./parse";

export type AnalyticsPeriod = "7d" | "12d" | "30d" | "90d" | "12m";
export type CurrencyCode = "usd" | "gbp";

export interface ChartDataPoint {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Aug 23"
  fullDate: string; // e.g. "Aug 23, 2026"
  amount: number;
  gbpAmount: number;
  ordersCount: number;
}

export interface PayoutAnalyticsResult {
  period: AnalyticsPeriod;
  currency: CurrencyCode;
  totalPayout: number;
  previousPeriodPayout: number;
  percentageChange: number;
  totalOrders: number;
  averagePayout: number;
  avgRate: number;
  startDate: string;
  endDate: string;
  chartData: ChartDataPoint[];
  totalDatasetRecords: number;
}

/**
 * Extract the exact calendar date (YYYY-MM-DD) when a payout record was
 * uploaded / processed through the system.
 *
 * Uses:
 * 1. payout_uploaded_at / payout_processed_at / importedAt backend timestamp
 *
 * Timezone:
 * Uses the configured application / user local timezone (e.g. "Asia/Karachi" / UTC+05:00)
 * so that an upload at 28 August in the local timezone is recorded under 28 August,
 * not shifted across midnight due to raw UTC formatting.
 */
export function extractPayoutUploadDateKey(r: PayoutRecord, timeZone?: string): string | null {
  const ts = r.payout_uploaded_at || r.payout_processed_at || r.importedAt;

  if (ts && typeof ts === "string" && ts.trim()) {
    const raw = ts.trim();
    // If it is already a pure YYYY-MM-DD string
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }

    const dt = new Date(raw);
    if (!Number.isNaN(dt.getTime())) {
      try {
        // Format in local/configured timezone (e.g. 'en-CA' outputs YYYY-MM-DD)
        const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Karachi";
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: tz,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(dt);
        if (/^\d{4}-\d{2}-\d{2}$/.test(parts)) {
          return parts;
        }
      } catch {
        // Fallback to ISO string slice if Intl timeZone fails
        return dt.toISOString().slice(0, 10);
      }
    }
  }

  // Fallback for older records without importedAt timestamp
  if (r.payoutDate && typeof r.payoutDate === "string" && r.payoutDate.trim()) {
    const norm = normaliseDate(r.payoutDate.trim());
    if (norm && /^\d{4}-\d{2}-\d{2}$/.test(norm)) {
      return norm;
    }
  }

  if (r.orderDate && typeof r.orderDate === "string" && r.orderDate.trim()) {
    const norm = normaliseDate(r.orderDate.trim());
    if (norm && /^\d{4}-\d{2}-\d{2}$/.test(norm)) {
      return norm;
    }
  }

  return null;
}

/**
 * Backward compatibility alias
 */
export const extractPayoutDateKey = extractPayoutUploadDateKey;

/**
 * Add or subtract calendar days from an ISO date string (YYYY-MM-DD) in UTC.
 * Avoids any timezone shifts or daylight savings jumps.
 */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

/**
 * Format a calendar date string (YYYY-MM-DD) consistently in UTC to avoid double timezone shift.
 */
export function formatDateKeyLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
  return dt.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
}

export function formatFullDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
  return dt.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function calculatePayoutAnalytics(
  records: PayoutRecord[],
  period: AnalyticsPeriod = "12d",
  avgRate = 1.27,
  currency: CurrencyCode = "usd",
  timeZone?: string,
): PayoutAnalyticsResult {
  const totalDatasetRecords = records.length;

  if (totalDatasetRecords === 0) {
    return {
      period,
      currency,
      totalPayout: 0,
      previousPeriodPayout: 0,
      percentageChange: 0,
      totalOrders: 0,
      averagePayout: 0,
      avgRate,
      startDate: "",
      endDate: "",
      chartData: [],
      totalDatasetRecords: 0,
    };
  }

  // 1. Group all database records by exact calendar date key (YYYY-MM-DD)
  // based on when the payout was actually uploaded / processed.
  const dailyMap = new Map<
    string,
    { gbpAmount: number; ordersCount: number; records: PayoutRecord[] }
  >();

  for (const r of records) {
    const dateKey = extractPayoutUploadDateKey(r, timeZone);
    if (!dateKey) continue;

    const gbp = r.gbpAmount != null && !Number.isNaN(r.gbpAmount) ? r.gbpAmount : 0;
    const existing = dailyMap.get(dateKey) || { gbpAmount: 0, ordersCount: 0, records: [] };
    existing.gbpAmount += gbp;
    existing.ordersCount += 1;
    existing.records.push(r);
    dailyMap.set(dateKey, existing);
  }

  const allDateKeys = Array.from(dailyMap.keys()).sort();

  if (allDateKeys.length === 0) {
    return {
      period,
      currency,
      totalPayout: 0,
      previousPeriodPayout: 0,
      percentageChange: 0,
      totalOrders: 0,
      averagePayout: 0,
      avgRate,
      startDate: "",
      endDate: "",
      chartData: [],
      totalDatasetRecords,
    };
  }

  // Determine the latest payout date in the database as the anchor
  const maxDateKey = allDateKeys[allDateKeys.length - 1]!;

  let rangeDays = 12;
  if (period === "7d") rangeDays = 7;
  else if (period === "12d") rangeDays = 12;
  else if (period === "30d") rangeDays = 30;
  else if (period === "90d") rangeDays = 90;
  else if (period === "12m") rangeDays = 365;

  const startDate = addDaysToDateKey(maxDateKey, -(rangeDays - 1));
  const endDate = maxDateKey;

  const multiplier = currency === "usd" ? avgRate : 1;

  // 2. Build chronological chart data (oldest -> newest) for the rangeDays window
  const chartData: ChartDataPoint[] = [];
  let currentTotalGbp = 0;
  let currentOrdersCount = 0;

  for (let i = rangeDays - 1; i >= 0; i--) {
    const dayDateKey = addDaysToDateKey(maxDateKey, -i);
    const dayData = dailyMap.get(dayDateKey);
    const gbp = dayData ? dayData.gbpAmount : 0;
    const orders = dayData ? dayData.ordersCount : 0;

    currentTotalGbp += gbp;
    currentOrdersCount += orders;

    chartData.push({
      date: dayDateKey,
      label: formatDateKeyLabel(dayDateKey),
      fullDate: formatFullDateKey(dayDateKey),
      amount: +(gbp * multiplier).toFixed(2),
      gbpAmount: +gbp.toFixed(2),
      ordersCount: orders,
    });
  }

  // 3. Compute equivalent previous period for comparison
  let prevTotalGbp = 0;
  for (let i = 1; i <= rangeDays; i++) {
    const prevDateKey = addDaysToDateKey(startDate, -i);
    const prevData = dailyMap.get(prevDateKey);
    if (prevData) {
      prevTotalGbp += prevData.gbpAmount;
    }
  }

  const totalPayout = +(currentTotalGbp * multiplier).toFixed(2);
  const previousPeriodPayout = +(prevTotalGbp * multiplier).toFixed(2);

  let percentageChange = 0;
  if (previousPeriodPayout > 0) {
    percentageChange = +(
      ((totalPayout - previousPeriodPayout) / previousPeriodPayout) *
      100
    ).toFixed(1);
  } else if (totalPayout > 0 && previousPeriodPayout === 0) {
    percentageChange = 100;
  }

  const averagePayout = currentOrdersCount > 0 ? +(totalPayout / currentOrdersCount).toFixed(2) : 0;

  return {
    period,
    currency,
    totalPayout,
    previousPeriodPayout,
    percentageChange,
    totalOrders: currentOrdersCount,
    averagePayout,
    avgRate,
    startDate,
    endDate,
    chartData,
    totalDatasetRecords,
  };
}
