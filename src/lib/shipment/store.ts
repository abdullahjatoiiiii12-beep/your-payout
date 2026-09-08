import { get, set, del } from "idb-keyval";
import type { ShipmentBatch, ShipmentRecord } from "./types";

const SHIPMENT_RECORDS_KEY = "shipment:records:v1";
const SHIPMENT_BATCHES_KEY = "shipment:batches:v1";
const SHIPMENT_SETTINGS_KEY = "shipment:settings:v1";

export interface ShipmentSettings {
  avgRate: number;
}

export const DEFAULT_SHIPMENT_SETTINGS: ShipmentSettings = { avgRate: 1.27 };

let cachedShipmentRecords: ShipmentRecord[] | null = null;
let cachedShipmentBatches: ShipmentBatch[] | null = null;
let cachedShipmentSettings: ShipmentSettings | null = null;

export async function loadShipmentRecords(forceRefresh = false): Promise<ShipmentRecord[]> {
  if (!forceRefresh && cachedShipmentRecords !== null && cachedShipmentRecords.length > 0) {
    return cachedShipmentRecords;
  }

  let localIdbRecords: ShipmentRecord[] = [];
  try {
    localIdbRecords = (await get<ShipmentRecord[]>(SHIPMENT_RECORDS_KEY)) ?? [];
  } catch {
    // IDB error fallback
  }

  // Attempt to fetch fresh data from backend API
  try {
    const res = await fetch("/api/shipments");
    if (res.ok) {
      const data = (await res.json()) as {
        records?: ShipmentRecord[];
        batches?: ShipmentBatch[];
        settings?: ShipmentSettings;
      };
      if (Array.isArray(data.records)) {
        if (data.records.length > 0) {
          cachedShipmentRecords = data.records;
          if (Array.isArray(data.batches)) cachedShipmentBatches = data.batches;
          if (data.settings) cachedShipmentSettings = data.settings;

          // Sync to IndexedDB for offline / instant availability
          void set(SHIPMENT_RECORDS_KEY, data.records);
          if (data.batches) void set(SHIPMENT_BATCHES_KEY, data.batches);
          if (data.settings) void set(SHIPMENT_SETTINGS_KEY, data.settings);

          return cachedShipmentRecords;
        } else if (localIdbRecords.length > 0) {
          // Self-heal: backend was empty but local storage has records -> restore to backend
          cachedShipmentRecords = localIdbRecords;
          void saveShipmentRecords(localIdbRecords);
          return cachedShipmentRecords;
        }
      }
    }
  } catch {
    // Fallback to IndexedDB if network fetch fails
  }

  cachedShipmentRecords = localIdbRecords;
  return cachedShipmentRecords;
}

export function getCachedShipmentRecords(): ShipmentRecord[] {
  return cachedShipmentRecords ?? [];
}

export function setCachedShipmentRecords(records: ShipmentRecord[]): void {
  cachedShipmentRecords = records;
}

export async function deleteShipmentRecord(recordId: string): Promise<ShipmentRecord[]> {
  const current = cachedShipmentRecords ?? (await loadShipmentRecords());
  const updated = current.filter((r) => r.id !== recordId && r.orderNumber !== recordId);
  cachedShipmentRecords = updated;
  await set(SHIPMENT_RECORDS_KEY, updated);

  try {
    await fetch("/api/shipments/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: recordId }),
    });
  } catch (e) {
    console.warn("Failed to sync shipment deletion to backend:", e);
  }

  return updated;
}

export async function saveShipmentRecords(records: ShipmentRecord[]): Promise<void> {
  cachedShipmentRecords = records;
  await set(SHIPMENT_RECORDS_KEY, records);

  // Sync to Backend Database
  try {
    await fetch("/api/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records }),
    });
  } catch (e) {
    console.warn("Failed to sync shipments to backend:", e);
  }
}

export async function loadShipmentBatches(): Promise<ShipmentBatch[]> {
  if (cachedShipmentBatches !== null) return cachedShipmentBatches;

  try {
    const res = await fetch("/api/shipments");
    if (res.ok) {
      const data = (await res.json()) as { batches?: ShipmentBatch[] };
      if (Array.isArray(data.batches)) {
        cachedShipmentBatches = data.batches;
        void set(SHIPMENT_BATCHES_KEY, data.batches);
        return cachedShipmentBatches;
      }
    }
  } catch {
    // Fallback
  }

  cachedShipmentBatches = (await get<ShipmentBatch[]>(SHIPMENT_BATCHES_KEY)) ?? [];
  return cachedShipmentBatches;
}

export async function saveShipmentBatches(batches: ShipmentBatch[]): Promise<void> {
  cachedShipmentBatches = batches;
  await set(SHIPMENT_BATCHES_KEY, batches);

  try {
    await fetch("/api/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batches }),
    });
  } catch (e) {
    console.warn("Failed to sync shipment batches to backend:", e);
  }
}

export async function loadShipmentSettings(): Promise<ShipmentSettings> {
  if (cachedShipmentSettings !== null) return cachedShipmentSettings;
  cachedShipmentSettings = {
    ...DEFAULT_SHIPMENT_SETTINGS,
    ...((await get<Partial<ShipmentSettings>>(SHIPMENT_SETTINGS_KEY)) ?? {}),
  };
  return cachedShipmentSettings;
}

export async function saveShipmentSettings(s: ShipmentSettings): Promise<void> {
  cachedShipmentSettings = s;
  await set(SHIPMENT_SETTINGS_KEY, s);

  try {
    await fetch("/api/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: s }),
    });
  } catch (e) {
    console.warn("Failed to sync shipment settings to backend:", e);
  }
}

export async function clearAllShipmentData(): Promise<void> {
  cachedShipmentRecords = [];
  cachedShipmentBatches = [];
  await Promise.all([del(SHIPMENT_RECORDS_KEY), del(SHIPMENT_BATCHES_KEY)]);

  try {
    await fetch("/api/shipments/clear", { method: "POST" });
  } catch (e) {
    console.warn("Failed to clear shipments on backend:", e);
  }
}
