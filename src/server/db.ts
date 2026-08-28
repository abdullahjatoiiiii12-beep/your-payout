import fs from "node:fs/promises";
import path from "node:path";
import type { PayoutRecord, ImportBatch, Settings } from "../lib/payout/types";
import type { ShipmentRecord, ShipmentBatch, ShipmentSettings } from "../lib/shipment/types";

export interface DatabaseSchema {
  shipments: ShipmentRecord[];
  shipmentBatches: ShipmentBatch[];
  shipmentSettings: ShipmentSettings;
  payouts: PayoutRecord[];
  payoutBatches: ImportBatch[];
  payoutSettings: Settings;
  lastUpdated: string;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const DEFAULT_DB: DatabaseSchema = {
  shipments: [],
  shipmentBatches: [],
  shipmentSettings: { avgRate: 1.27 },
  payouts: [],
  payoutBatches: [],
  payoutSettings: { avgRate: 1.27 },
  lastUpdated: new Date().toISOString(),
};

let memoryDb: DatabaseSchema | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // Directory already exists or cannot be created
  }
}

export async function getDatabase(): Promise<DatabaseSchema> {
  if (memoryDb) {
    return memoryDb;
  }

  await ensureDataDir();

  try {
    const raw = await fs.readFile(DB_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
    memoryDb = {
      shipments: Array.isArray(parsed.shipments) ? parsed.shipments : [],
      shipmentBatches: Array.isArray(parsed.shipmentBatches) ? parsed.shipmentBatches : [],
      shipmentSettings: parsed.shipmentSettings || { avgRate: 1.27 },
      payouts: Array.isArray(parsed.payouts) ? parsed.payouts : [],
      payoutBatches: Array.isArray(parsed.payoutBatches) ? parsed.payoutBatches : [],
      payoutSettings: parsed.payoutSettings || { avgRate: 1.27 },
      lastUpdated: parsed.lastUpdated || new Date().toISOString(),
    };
  } catch {
    // If file doesn't exist or is invalid JSON, initialize default
    memoryDb = { ...DEFAULT_DB, lastUpdated: new Date().toISOString() };
    await saveDatabaseDirect(memoryDb);
  }

  return memoryDb;
}

async function saveDatabaseDirect(db: DatabaseSchema): Promise<void> {
  await ensureDataDir();
  const tmpFile = `${DB_FILE}.${Date.now()}.tmp`;
  await fs.writeFile(tmpFile, JSON.stringify(db, null, 2), "utf-8");
  await fs.rename(tmpFile, DB_FILE);
}

export async function saveDatabase(
  updater: (db: DatabaseSchema) => DatabaseSchema | void,
): Promise<DatabaseSchema> {
  const current = await getDatabase();
  const result = updater(current);
  const updated = result || current;
  updated.lastUpdated = new Date().toISOString();
  memoryDb = updated;

  // Queue write to avoid race conditions
  writeQueue = writeQueue.then(async () => {
    try {
      await saveDatabaseDirect(updated);
    } catch (err) {
      console.error("[Database] Failed to write db.json:", err);
    }
  });

  await writeQueue;
  return updated;
}
