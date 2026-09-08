import fs from "node:fs/promises";
import path from "node:path";
import type { PayoutRecord, ImportBatch, Settings } from "../lib/payout/types";
import type { ShipmentRecord, ShipmentBatch, ShipmentSettings } from "../lib/shipment/types";
import { getSupabaseAdminClient } from "./supabase";

export interface DatabaseSchema {
  shipments: ShipmentRecord[];
  shipmentBatches: ShipmentBatch[];
  shipmentSettings: ShipmentSettings;
  payouts: PayoutRecord[];
  payoutBatches: ImportBatch[];
  payoutSettings: Settings;
  lastUpdated: string;
}

export interface TableVerificationResult {
  supabaseUrl: string;
  supabaseConfigured: boolean;
  payoutsTable: boolean;
  shipmentsTable: boolean;
  payoutBatchesTable: boolean;
  shipmentBatchesTable: boolean;
  appSettingsTable: boolean;
  dashboardMetricsTable?: boolean;
  allTablesReady: boolean;
  message: string;
  localStats: {
    payoutsCount: number;
    shipmentsCount: number;
    payoutBatchesCount: number;
    shipmentBatchesCount: number;
    lastUpdated: string;
  };
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const DB_BACKUP_FILE = path.join(DATA_DIR, "db.backup.json");

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
let hasCheckedSupabaseInitial = false;

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // Directory already exists or cannot be created
  }
}

/**
 * Check which Supabase tables exist and are ready for querying.
 */
export async function verifySupabaseTables(): Promise<TableVerificationResult> {
  const db = await getDatabase();
  const result: TableVerificationResult = {
    supabaseUrl: "https://vaouuotyarwkupjwrpbz.supabase.co",
    supabaseConfigured: false,
    payoutsTable: false,
    shipmentsTable: false,
    payoutBatchesTable: false,
    shipmentBatchesTable: false,
    appSettingsTable: false,
    allTablesReady: false,
    message: "Checking database status...",
    localStats: {
      payoutsCount: db.payouts.length,
      shipmentsCount: db.shipments.length,
      payoutBatchesCount: db.payoutBatches.length,
      shipmentBatchesCount: db.shipmentBatches.length,
      lastUpdated: db.lastUpdated,
    },
  };

  const client = getSupabaseAdminClient();
  if (!client) {
    result.message = "Supabase client not initialized or credentials missing.";
    return result;
  }

  result.supabaseConfigured = true;

  try {
    const [payoutsRes, shipmentsRes, pBatchesRes, sBatchesRes, settingsRes, dashboardRes] =
      await Promise.allSettled([
        client.from("payouts").select("id").limit(1),
        client.from("shipments").select("id").limit(1),
        client.from("payout_batches").select("id").limit(1),
        client.from("shipment_batches").select("id").limit(1),
        client.from("app_settings").select("id").limit(1),
        client.from("dashboard_metrics").select("id").limit(1),
      ]);

    result.payoutsTable = payoutsRes.status === "fulfilled" && !payoutsRes.value.error;
    result.shipmentsTable = shipmentsRes.status === "fulfilled" && !shipmentsRes.value.error;
    result.payoutBatchesTable = pBatchesRes.status === "fulfilled" && !pBatchesRes.value.error;
    result.shipmentBatchesTable = sBatchesRes.status === "fulfilled" && !sBatchesRes.value.error;
    result.appSettingsTable = settingsRes.status === "fulfilled" && !settingsRes.value.error;
    result.dashboardMetricsTable = dashboardRes.status === "fulfilled" && !dashboardRes.value.error;

    result.allTablesReady =
      result.payoutsTable &&
      result.shipmentsTable &&
      result.payoutBatchesTable &&
      result.shipmentBatchesTable &&
      result.appSettingsTable;

    if (result.allTablesReady) {
      result.message =
        "All Supabase tables are active and synchronized with the database in shared team mode.";
    } else {
      result.message =
        "Tables not yet created in Supabase. Run supabase_tables.sql in Supabase SQL Editor to activate cloud tables.";
    }
  } catch (e) {
    result.message = e instanceof Error ? e.message : "Error verifying Supabase tables";
  }

  return result;
}

/**
 * Sync local data into Supabase if tables exist
 */
async function syncToSupabaseIfTablesExist(db: DatabaseSchema): Promise<void> {
  const client = getSupabaseAdminClient();
  if (!client) return;

  try {
    // Check if payouts table exists before syncing
    const { error: pErr } = await client.from("payouts").select("id").limit(1);
    if (!pErr && db.payouts.length > 0) {
      const rows = db.payouts.map((p) => {
        const orderId =
          p.orderNumber ||
          (p as unknown as Record<string, unknown>).orderId ||
          (p as unknown as Record<string, unknown>).order_id ||
          "UNKNOWN";
        const date =
          p.payoutDate || p.orderDate || (p as unknown as Record<string, unknown>).date || "";
        const itemDesc =
          p.productName ||
          (p as unknown as Record<string, unknown>).itemDescription ||
          (p as unknown as Record<string, unknown>).item_description ||
          "";
        const unitPrice =
          p.basePrice != null
            ? p.basePrice
            : Number((p as unknown as Record<string, unknown>).unitPrice) || 0;
        const grossAmount =
          p.totalBasePrice != null
            ? p.totalBasePrice
            : p.basePrice != null
              ? p.basePrice
              : Number((p as unknown as Record<string, unknown>).grossAmount) || 0;
        const feeAmount =
          p.commission != null
            ? p.commission
            : Number((p as unknown as Record<string, unknown>).feeAmount) || 0;
        const netAmount =
          p.balance != null
            ? p.balance
            : p.gbpAmount != null
              ? p.gbpAmount
              : Number((p as unknown as Record<string, unknown>).netAmount) || 0;

        return {
          id: p.id || crypto.randomUUID(),
          order_id: String(orderId),
          date: String(date),
          source_file: p.sourceFile || "",
          item_description: String(itemDesc),
          quantity: p.quantity ?? 1,
          packages: p.packages ?? 1,
          unit_price: unitPrice,
          gross_amount: grossAmount,
          fee_amount: feeAmount,
          net_amount: netAmount,
          gbp_amount: p.gbpAmount ?? 0,
          vendor_base_price: p.vendorBasePrice ?? 0,
          discount: p.discount ?? 0,
          total_base_price: p.totalBasePrice ?? 0,
          commission: p.commission ?? 0,
          balance: p.balance ?? 0,
          currency: (p as unknown as Record<string, unknown>).currency || "GBP",
          dup_key: p.dupKey || `${orderId}:${date}`,
          is_duplicate: Boolean(p.isDuplicate),
          imported_at: p.importedAt || new Date().toISOString(),
          payout_uploaded_at: p.payout_uploaded_at || p.importedAt || new Date().toISOString(),
          payout_processed_at: p.payout_processed_at || new Date().toISOString(),
        };
      });

      // Upsert in batches of 200
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        await client.from("payouts").upsert(chunk, { onConflict: "id" });
      }
    }

    // Check shipments table
    const { error: sErr } = await client.from("shipments").select("id").limit(1);
    if (!sErr && db.shipments.length > 0) {
      const rows = db.shipments.map((s) => {
        const orderId =
          s.orderNumber ||
          (s as unknown as Record<string, unknown>).orderId ||
          (s as unknown as Record<string, unknown>).order_id ||
          "UNKNOWN";
        const shipDate =
          s.shipmentDate ||
          (s as unknown as Record<string, unknown>).shipDate ||
          (s as unknown as Record<string, unknown>).ship_date ||
          "";
        const customerName =
          s.recipientName ||
          (s as unknown as Record<string, unknown>).customerName ||
          (s as unknown as Record<string, unknown>).customer_name ||
          "";

        return {
          id: s.id || crypto.randomUUID(),
          order_id: String(orderId),
          tracking_number: s.trackingNumber || "",
          carrier: s.carrier || "",
          status: s.status || "In Transit",
          ship_date: String(shipDate),
          delivery_date: s.deliveryDate || "",
          weight_kg: s.weightKg ?? 0,
          packages: s.packages ?? 1,
          quantity: s.quantity ?? 1,
          declared_value: s.declaredValue ?? 0,
          shipping_cost: s.shippingCost ?? 0,
          destination_country: s.destinationCountry || "",
          supplier: s.supplier || "",
          source_file: s.sourceFile || "",
          customer_name: String(customerName),
          payout_matched: Boolean((s as unknown as Record<string, unknown>).payout_matched),
          payout_matched_at: (s as unknown as Record<string, unknown>).payout_matched_at || null,
          imported_at: s.importedAt || new Date().toISOString(),
        };
      });

      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        await client.from("shipments").upsert(chunk, { onConflict: "id" });
      }
    }
  } catch (err) {
    // Non-fatal, local storage remains authoritative and completely intact
    console.warn("[Database] Supabase background sync notice:", err);
  }
}

/**
 * On first startup, if Supabase has tables with records and local is empty, load from Supabase
 */
async function pullFromSupabaseIfAvailable(localDb: DatabaseSchema): Promise<DatabaseSchema> {
  if (hasCheckedSupabaseInitial) return localDb;
  hasCheckedSupabaseInitial = true;

  const client = getSupabaseAdminClient();
  if (!client) return localDb;

  try {
    let modified = false;

    // Pull payouts if local has none
    if (localDb.payouts.length === 0) {
      const { data: remotePayouts, error: pErr } = await client
        .from("payouts")
        .select("*")
        .limit(5000);

      if (!pErr && Array.isArray(remotePayouts) && remotePayouts.length > 0) {
        localDb.payouts = remotePayouts.map((r: Record<string, unknown>) => {
          const ord = (r.order_id as string) || "";
          const dt = (r.date as string) || "";
          return {
            id: (r.id as string) || "",
            orderId: ord,
            orderNumber: ord,
            date: dt,
            payoutDate: dt,
            orderDate: dt,
            sourceFile: (r.source_file as string) || "",
            itemDescription: (r.item_description as string) || "",
            productName: (r.item_description as string) || "",
            quantity: Number(r.quantity) || 1,
            packages: Number(r.packages) || 1,
            unitPrice: Number(r.unit_price) || 0,
            basePrice: Number(r.unit_price) || 0,
            grossAmount: Number(r.gross_amount) || 0,
            totalBasePrice: Number(r.total_base_price) || Number(r.gross_amount) || 0,
            feeAmount: Number(r.fee_amount) || 0,
            commission: Number(r.commission) || Number(r.fee_amount) || 0,
            netAmount: Number(r.net_amount) || 0,
            balance: Number(r.balance) || Number(r.net_amount) || 0,
            gbpAmount: Number(r.gbp_amount) || 0,
            vendorBasePrice: Number(r.vendor_base_price) || 0,
            discount: Number(r.discount) || 0,
            currency: (r.currency as string) || "GBP",
            dupKey: (r.dup_key as string) || `${ord}:${dt}`,
            isDuplicate: Boolean(r.is_duplicate),
            importedAt: (r.imported_at as string) || new Date().toISOString(),
            payout_uploaded_at: r.payout_uploaded_at as string | undefined,
            payout_processed_at: r.payout_processed_at as string | undefined,
          };
        });
        modified = true;
      }
    }

    // Pull shipments if local has none
    if (localDb.shipments.length === 0) {
      const { data: remoteShipments, error: sErr } = await client
        .from("shipments")
        .select("*")
        .limit(5000);

      if (!sErr && Array.isArray(remoteShipments) && remoteShipments.length > 0) {
        localDb.shipments = remoteShipments.map((r: Record<string, unknown>) => {
          const ord = (r.order_id as string) || "";
          const sDate = (r.ship_date as string) || "";
          const trk = (r.tracking_number as string) || "";
          const sup = (r.supplier as string) || "";
          return {
            id: (r.id as string) || "",
            orderId: ord,
            orderNumber: ord,
            trackingNumber: trk,
            carrier: (r.carrier as string) || "",
            status: ((r.status as string) ||
              "In Transit") as import("../lib/shipment/types").ShipmentStatus,
            shipDate: sDate,
            shipmentDate: sDate,
            deliveryDate: (r.delivery_date as string) || "",
            weightKg: Number(r.weight_kg) || 0,
            packages: Number(r.packages) || 1,
            quantity: Number(r.quantity) || 1,
            declaredValue: Number(r.declared_value) || 0,
            shippingCost: Number(r.shipping_cost) || 0,
            destinationCountry: (r.destination_country as string) || "",
            destinationCity: (r.destination_city as string) || "",
            supplier: sup,
            sourceFile: (r.source_file as string) || "",
            customerName: (r.customer_name as string) || "",
            recipientName: (r.customer_name as string) || "",
            productName: (r.product_name as string) || "",
            category: (r.category as string) || "",
            dimensions: (r.dimensions as string) || "",
            customsFee: Number(r.customs_fee) || 0,
            currency: (r.currency as string) || "GBP",
            notes: (r.notes as string) || "",
            dupKey: `${trk}|${ord}|${sup}|${sDate}`.toLowerCase(),
            isDuplicate: false,
            payout_matched: Boolean(r.payout_matched),
            payout_matched_at: (r.payout_matched_at as string) || undefined,
            importedAt: (r.imported_at as string) || new Date().toISOString(),
          };
        });
        modified = true;
      }
    }

    if (modified) {
      await saveDatabaseDirect(localDb);
    }
  } catch (e) {
    console.warn("[Database] Could not pull initial remote records:", e);
  }

  return localDb;
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
    // If primary file missing or unreadable, check backup
    try {
      const backupRaw = await fs.readFile(DB_BACKUP_FILE, "utf-8");
      const backupParsed = JSON.parse(backupRaw) as Partial<DatabaseSchema>;
      memoryDb = {
        shipments: Array.isArray(backupParsed.shipments) ? backupParsed.shipments : [],
        shipmentBatches: Array.isArray(backupParsed.shipmentBatches)
          ? backupParsed.shipmentBatches
          : [],
        shipmentSettings: backupParsed.shipmentSettings || { avgRate: 1.27 },
        payouts: Array.isArray(backupParsed.payouts) ? backupParsed.payouts : [],
        payoutBatches: Array.isArray(backupParsed.payoutBatches) ? backupParsed.payoutBatches : [],
        payoutSettings: backupParsed.payoutSettings || { avgRate: 1.27 },
        lastUpdated: backupParsed.lastUpdated || new Date().toISOString(),
      };
      await saveDatabaseDirect(memoryDb);
    } catch {
      // Default initialization
      memoryDb = { ...DEFAULT_DB, lastUpdated: new Date().toISOString() };
      await saveDatabaseDirect(memoryDb);
    }
  }

  // Attempt initial Supabase population if Supabase has tables with records
  memoryDb = await pullFromSupabaseIfAvailable(memoryDb);

  return memoryDb;
}

async function saveDatabaseDirect(db: DatabaseSchema): Promise<void> {
  await ensureDataDir();
  const tmpFile = `${DB_FILE}.${Date.now()}.tmp`;
  const content = JSON.stringify(db, null, 2);
  await fs.writeFile(tmpFile, content, "utf-8");
  await fs.rename(tmpFile, DB_FILE);

  // Write backup asynchronously
  try {
    await fs.writeFile(DB_BACKUP_FILE, content, "utf-8");
  } catch {
    // Non-fatal
  }
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
      // Asynchronously sync to Supabase if tables exist
      void syncToSupabaseIfTablesExist(updated);
    } catch (err) {
      console.error("[Database] Failed to write db.json:", err);
    }
  });

  await writeQueue;
  return updated;
}

export async function deleteShipmentFromDatabase(id: string): Promise<DatabaseSchema> {
  const updated = await saveDatabase((db) => {
    db.shipments = (db.shipments || []).filter(
      (s) =>
        s.id !== id &&
        s.orderNumber !== id &&
        (s as unknown as Record<string, unknown>).orderId !== id,
    );
  });

  const client = getSupabaseAdminClient();
  if (client) {
    try {
      await client.from("shipments").delete().or(`id.eq.${id},order_id.eq.${id}`);
    } catch (e) {
      console.warn("[Database] Could not delete shipment from Supabase:", e);
    }
  }

  return updated;
}

export async function deletePayoutFromDatabase(id: string): Promise<DatabaseSchema> {
  const updated = await saveDatabase((db) => {
    db.payouts = (db.payouts || []).filter(
      (p) =>
        p.id !== id &&
        p.orderNumber !== id &&
        (p as unknown as Record<string, unknown>).orderId !== id,
    );
  });

  const client = getSupabaseAdminClient();
  if (client) {
    try {
      await client.from("payouts").delete().or(`id.eq.${id},order_id.eq.${id}`);
    } catch (e) {
      console.warn("[Database] Could not delete payout from Supabase:", e);
    }
  }

  return updated;
}
