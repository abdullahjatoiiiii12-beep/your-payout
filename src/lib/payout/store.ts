import { get, set, del } from "idb-keyval";
import type { ImportBatch, PayoutRecord, ProcessSummary, UnmatchedOrder } from "./types";
import { setCachedShipmentRecords } from "../shipment/store";
import type { ShipmentRecord } from "../shipment/types";

const RECORDS_KEY = "payout:records:v1";
const BATCHES_KEY = "payout:batches:v1";
const SETTINGS_KEY = "payout:settings:v1";

export interface Settings {
  avgRate: number;
}

export const DEFAULT_SETTINGS: Settings = { avgRate: 1.27 };

let cachedRecords: PayoutRecord[] | null = null;
let cachedBatches: ImportBatch[] | null = null;
let cachedSettings: Settings | null = null;

export async function loadRecords(forceRefresh = false): Promise<PayoutRecord[]> {
  if (!forceRefresh && cachedRecords !== null) return cachedRecords;

  try {
    const res = await fetch("/api/payouts");
    if (res.ok) {
      const data = (await res.json()) as {
        records?: PayoutRecord[];
        batches?: ImportBatch[];
        settings?: Settings;
      };
      if (Array.isArray(data.records)) {
        cachedRecords = data.records;
        if (Array.isArray(data.batches)) cachedBatches = data.batches;
        if (data.settings) cachedSettings = data.settings;

        void set(RECORDS_KEY, data.records);
        if (data.batches) void set(BATCHES_KEY, data.batches);
        if (data.settings) void set(SETTINGS_KEY, data.settings);

        return cachedRecords;
      }
    }
  } catch {
    // Fallback
  }

  cachedRecords = (await get<PayoutRecord[]>(RECORDS_KEY)) ?? [];
  return cachedRecords;
}

export function getCachedRecords(): PayoutRecord[] {
  return cachedRecords ?? [];
}

export async function saveRecords(records: PayoutRecord[]): Promise<void> {
  cachedRecords = records;
  await set(RECORDS_KEY, records);

  try {
    await fetch("/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records }),
    });
  } catch (e) {
    console.warn("Failed to sync payouts to backend:", e);
  }
}

export async function loadBatches(): Promise<ImportBatch[]> {
  if (cachedBatches !== null) return cachedBatches;

  try {
    const res = await fetch("/api/payouts");
    if (res.ok) {
      const data = (await res.json()) as { batches?: ImportBatch[] };
      if (Array.isArray(data.batches)) {
        cachedBatches = data.batches;
        void set(BATCHES_KEY, data.batches);
        return cachedBatches;
      }
    }
  } catch {
    // Fallback
  }

  cachedBatches = (await get<ImportBatch[]>(BATCHES_KEY)) ?? [];
  return cachedBatches;
}

export async function saveBatches(batches: ImportBatch[]): Promise<void> {
  cachedBatches = batches;
  await set(BATCHES_KEY, batches);

  try {
    await fetch("/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batches }),
    });
  } catch (e) {
    console.warn("Failed to sync payout batches to backend:", e);
  }
}

export async function loadSettings(): Promise<Settings> {
  if (cachedSettings !== null) return cachedSettings;
  cachedSettings = { ...DEFAULT_SETTINGS, ...((await get<Partial<Settings>>(SETTINGS_KEY)) ?? {}) };
  return cachedSettings;
}

export async function saveSettings(s: Settings): Promise<void> {
  cachedSettings = s;
  await set(SETTINGS_KEY, s);

  try {
    await fetch("/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: s }),
    });
  } catch (e) {
    console.warn("Failed to sync payout settings to backend:", e);
  }
}

export interface MatchBackendResponse {
  success: boolean;
  summary: {
    totalPayoutOrders: number;
    matchedShipments: number;
    markedReceived: number;
    ordersNotFound: number;
    duplicatePayoutOrders: number;
    unmatchedOrders: UnmatchedOrder[];
    payoutImported: number;
  };
  updatedShipments?: ShipmentRecord[];
  updatedPayouts?: PayoutRecord[];
}

export async function processAndMatchPayouts(
  payoutRecords: PayoutRecord[],
  batch: ImportBatch,
): Promise<MatchBackendResponse | null> {
  try {
    const res = await fetch("/api/payouts/process-and-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payoutRecords,
        batch,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as MatchBackendResponse;
      if (data.success && data.updatedShipments) {
        setCachedShipmentRecords(data.updatedShipments);
      }
      return data;
    }
  } catch (err) {
    console.error("Backend process-and-match failed:", err);
  }
  return null;
}

export async function clearAll(): Promise<void> {
  cachedRecords = [];
  cachedBatches = [];
  await Promise.all([del(RECORDS_KEY), del(BATCHES_KEY)]);

  try {
    await fetch("/api/payouts/clear", { method: "POST" });
  } catch (e) {
    console.warn("Failed to clear payouts on backend:", e);
  }
}
