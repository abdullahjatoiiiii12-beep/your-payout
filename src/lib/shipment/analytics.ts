import type { ShipmentRecord, ShipmentStatus } from "./types";
import { normalizeDate } from "./parse";

export type ShipmentRange = "7d" | "12d" | "30d";

export interface ShipmentChartDataPoint {
  date: string;
  label: string;
  fullDate: string;
  shipments: number;
  inTransit: number;
  received: number;
  pending: number;
}

export interface ShipmentStatusSummary {
  total: number;
  inTransit: number;
  received: number;
  pending: number;
  delivered: number;
  dispatched: number;
  exception: number;
}

export interface ShipmentAnalyticsResult {
  range: ShipmentRange;
  totalShipments: number;
  previousPeriodShipments: number;
  changePercentage: number;
  statusSummary: ShipmentStatusSummary;
  timeline: ShipmentChartDataPoint[];
  startDate: string;
  endDate: string;
  totalDatasetRecords: number;
}

export function extractShipmentDateKey(r: ShipmentRecord): string | null {
  if (r.shipmentDate && typeof r.shipmentDate === "string" && r.shipmentDate.trim()) {
    const norm = normalizeDate(r.shipmentDate.trim());
    if (norm && /^\d{4}-\d{2}-\d{2}$/.test(norm)) {
      return norm;
    }
  }

  if (r.deliveryDate && typeof r.deliveryDate === "string" && r.deliveryDate.trim()) {
    const norm = normalizeDate(r.deliveryDate.trim());
    if (norm && /^\d{4}-\d{2}-\d{2}$/.test(norm)) {
      return norm;
    }
  }

  return null;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

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

function categorizeStatus(
  status: ShipmentStatus | string,
): "inTransit" | "received" | "pending" | "delivered" | "dispatched" | "exception" {
  const s = (status || "").toLowerCase().trim();
  if (s.includes("received") || s.includes("delivered")) return "received";
  if (s.includes("pending") || s.includes("draft") || s.includes("awaiting")) return "pending";
  if (
    s.includes("transit") ||
    s.includes("customs") ||
    s.includes("way") ||
    s.includes("dispatch") ||
    s.includes("shipped") ||
    s.includes("out for delivery")
  ) {
    return "inTransit";
  }
  if (
    s.includes("exception") ||
    s.includes("cancel") ||
    s.includes("fail") ||
    s.includes("delay")
  ) {
    return "exception";
  }
  return "inTransit";
}

export function calculateShipmentAnalytics(
  records: ShipmentRecord[],
  range: ShipmentRange = "12d",
): ShipmentAnalyticsResult {
  const totalDatasetRecords = records.length;

  let rangeDays = 12;
  if (range === "7d") rangeDays = 7;
  else if (range === "12d") rangeDays = 12;
  else if (range === "30d") rangeDays = 30;

  if (totalDatasetRecords === 0) {
    return {
      range,
      totalShipments: 0,
      previousPeriodShipments: 0,
      changePercentage: 0,
      statusSummary: {
        total: 0,
        inTransit: 0,
        received: 0,
        pending: 0,
        delivered: 0,
        dispatched: 0,
        exception: 0,
      },
      timeline: [],
      startDate: "",
      endDate: "",
      totalDatasetRecords: 0,
    };
  }

  // 1. Group records by exact calendar date
  const dailyMap = new Map<string, ShipmentRecord[]>();

  for (const r of records) {
    const dateKey = extractShipmentDateKey(r);
    if (!dateKey) continue;

    const list = dailyMap.get(dateKey) || [];
    list.push(r);
    dailyMap.set(dateKey, list);
  }

  const allDateKeys = Array.from(dailyMap.keys()).sort();

  if (allDateKeys.length === 0) {
    return {
      range,
      totalShipments: 0,
      previousPeriodShipments: 0,
      changePercentage: 0,
      statusSummary: {
        total: 0,
        inTransit: 0,
        received: 0,
        pending: 0,
        delivered: 0,
        dispatched: 0,
        exception: 0,
      },
      timeline: [],
      startDate: "",
      endDate: "",
      totalDatasetRecords,
    };
  }

  const maxDateKey = allDateKeys[allDateKeys.length - 1]!;
  const startDate = addDaysToDateKey(maxDateKey, -(rangeDays - 1));
  const endDate = maxDateKey;

  // 2. Build daily timeline (oldest -> newest)
  const timeline: ShipmentChartDataPoint[] = [];
  const currentPeriodRecords: ShipmentRecord[] = [];

  for (let i = rangeDays - 1; i >= 0; i--) {
    const dayDateKey = addDaysToDateKey(maxDateKey, -i);
    const dayRecords = dailyMap.get(dayDateKey) || [];

    let dayInTransit = 0;
    let dayReceived = 0;
    let dayPending = 0;

    for (const r of dayRecords) {
      currentPeriodRecords.push(r);
      const cat = categorizeStatus(r.status);
      if (cat === "received") dayReceived++;
      else if (cat === "pending") dayPending++;
      else dayInTransit++;
    }

    timeline.push({
      date: dayDateKey,
      label: formatDateKeyLabel(dayDateKey),
      fullDate: formatFullDateKey(dayDateKey),
      shipments: dayRecords.length,
      inTransit: dayInTransit,
      received: dayReceived,
      pending: dayPending,
    });
  }

  // 3. Previous period records
  let previousPeriodCount = 0;
  for (let i = 1; i <= rangeDays; i++) {
    const prevDateKey = addDaysToDateKey(startDate, -i);
    const prevRecords = dailyMap.get(prevDateKey);
    if (prevRecords) {
      previousPeriodCount += prevRecords.length;
    }
  }

  const totalShipments = currentPeriodRecords.length;
  const previousPeriodShipments = previousPeriodCount;

  let changePercentage = 0;
  if (previousPeriodShipments > 0) {
    changePercentage = +(
      ((totalShipments - previousPeriodShipments) / previousPeriodShipments) *
      100
    ).toFixed(1);
  } else if (totalShipments > 0 && previousPeriodShipments === 0) {
    changePercentage = 100;
  }

  // Status Summary for records in scope
  const targetRecords = currentPeriodRecords.length > 0 ? currentPeriodRecords : records;
  const statusSummary: ShipmentStatusSummary = {
    total: targetRecords.length,
    inTransit: 0,
    received: 0,
    pending: 0,
    delivered: 0,
    dispatched: 0,
    exception: 0,
  };

  for (const r of targetRecords) {
    const cat = categorizeStatus(r.status);
    if (cat === "received") {
      statusSummary.received++;
      if (r.status === "Delivered") statusSummary.delivered++;
    } else if (cat === "inTransit") {
      statusSummary.inTransit++;
      if (r.status === "Dispatched") statusSummary.dispatched++;
    } else if (cat === "pending") {
      statusSummary.pending++;
    } else {
      statusSummary.exception++;
    }
  }

  return {
    range,
    totalShipments,
    previousPeriodShipments,
    changePercentage,
    statusSummary,
    timeline,
    startDate,
    endDate,
    totalDatasetRecords,
  };
}
