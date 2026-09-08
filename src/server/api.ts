import {
  getDatabase,
  saveDatabase,
  verifySupabaseTables,
  deleteShipmentFromDatabase,
  deletePayoutFromDatabase,
} from "./db";
import { getSupabaseConfig } from "./supabase";
import fs from "node:fs/promises";
import nodePath from "node:path";
import type { PayoutRecord, ImportBatch, Settings } from "../lib/payout/types";
import type { ShipmentRecord, ShipmentBatch, ShipmentSettings } from "../lib/shipment/types";
import {
  calculatePayoutAnalytics,
  type AnalyticsPeriod,
  type CurrencyCode,
} from "../lib/payout/analytics";
import { calculateShipmentAnalytics, type ShipmentRange } from "../lib/shipment/analytics";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

function normalizeOrderNumber(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.toString().replace(/\s+/g, " ").trim().toLowerCase();
}

export async function handleApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  try {
    // -------------------------------------------------------------
    // GET /api/supabase/status
    // -------------------------------------------------------------
    if (path === "/api/supabase/status" && method === "GET") {
      const config = getSupabaseConfig();
      return jsonResponse({
        success: true,
        supabase: config,
      });
    }

    // -------------------------------------------------------------
    // GET /api/database/status
    // -------------------------------------------------------------
    if (path === "/api/database/status" && method === "GET") {
      const status = await verifySupabaseTables();
      return jsonResponse({
        success: true,
        database: status,
      });
    }

    // -------------------------------------------------------------
    // GET /api/database/schema
    // -------------------------------------------------------------
    if (path === "/api/database/schema" && method === "GET") {
      try {
        const candidatePaths = [
          nodePath.join(process.cwd(), "supabase_tables.sql"),
          nodePath.resolve("supabase_tables.sql"),
          "/app/applet/supabase_tables.sql",
        ];
        let sql = "";
        for (const p of candidatePaths) {
          try {
            sql = await fs.readFile(p, "utf-8");
            if (sql) break;
          } catch {
            // continue
          }
        }
        if (!sql) {
          throw new Error(
            "Could not locate supabase_tables.sql in paths: " + candidatePaths.join(", "),
          );
        }
        return jsonResponse({ success: true, sql });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return jsonResponse({ success: false, error: msg }, 500);
      }
    }

    // -------------------------------------------------------------
    // GET /api/shipments
    // -------------------------------------------------------------
    if (path === "/api/shipments" && method === "GET") {
      const db = await getDatabase();
      return jsonResponse({
        records: db.shipments,
        batches: db.shipmentBatches,
        settings: db.shipmentSettings,
        lastUpdated: db.lastUpdated,
      });
    }

    // -------------------------------------------------------------
    // POST /api/shipments (save / append shipments from Excel)
    // -------------------------------------------------------------
    if (path === "/api/shipments" && method === "POST") {
      const body = (await request.json()) as {
        records?: ShipmentRecord[];
        batches?: ShipmentBatch[];
        settings?: ShipmentSettings;
      };

      const updated = await saveDatabase((db) => {
        if (body.records) {
          // Merge with existing master records to prevent accidental overwrite
          const map = new Map<string, ShipmentRecord>();
          for (const s of db.shipments || []) {
            const key = s.dupKey || s.id || `${s.orderNumber}|${s.trackingNumber}`;
            map.set(key, s);
          }
          for (const s of body.records) {
            const key = s.dupKey || s.id || `${s.orderNumber}|${s.trackingNumber}`;
            map.set(key, s);
          }
          db.shipments = Array.from(map.values());
        }
        if (body.batches) {
          const bMap = new Map<string, ShipmentBatch>();
          for (const b of db.shipmentBatches || []) {
            bMap.set(b.id, b);
          }
          for (const b of body.batches) {
            bMap.set(b.id, b);
          }
          db.shipmentBatches = Array.from(bMap.values());
        }
        if (body.settings) db.shipmentSettings = body.settings;
      });

      return jsonResponse({
        success: true,
        count: updated.shipments.length,
        batchesCount: updated.shipmentBatches.length,
      });
    }

    // -------------------------------------------------------------
    // POST /api/shipments/clear
    // -------------------------------------------------------------
    if (path === "/api/shipments/clear" && method === "POST") {
      await saveDatabase((db) => {
        db.shipments = [];
        db.shipmentBatches = [];
      });
      return jsonResponse({ success: true });
    }

    // -------------------------------------------------------------
    // POST /api/shipments/delete or DELETE /api/shipments/:id
    // -------------------------------------------------------------
    if (
      (path === "/api/shipments/delete" && method === "POST") ||
      (path.startsWith("/api/shipments/") && method === "DELETE")
    ) {
      let idToDelete = "";
      if (method === "DELETE") {
        idToDelete = decodeURIComponent(path.replace("/api/shipments/", ""));
      } else {
        const body = (await request.json()) as { id?: string };
        idToDelete = body.id || "";
      }

      if (!idToDelete) {
        return jsonResponse({ error: "Missing shipment ID" }, 400);
      }

      const updated = await deleteShipmentFromDatabase(idToDelete);
      return jsonResponse({
        success: true,
        count: updated.shipments.length,
      });
    }

    // -------------------------------------------------------------
    // GET /api/dashboard/shipments or /api/shipments/summary
    // (aggregated analytics for shipment overview chart)
    // -------------------------------------------------------------
    if (
      (path === "/api/dashboard/shipments" || path === "/api/shipments/summary") &&
      method === "GET"
    ) {
      const range = (url.searchParams.get("range") || "12d") as ShipmentRange;
      const db = await getDatabase();
      const analytics = calculateShipmentAnalytics(db.shipments, range);
      return jsonResponse(analytics);
    }

    // -------------------------------------------------------------
    // GET /api/dashboard/payouts (aggregated analytics for chart)
    // -------------------------------------------------------------
    if (path === "/api/dashboard/payouts" && method === "GET") {
      const period = (url.searchParams.get("period") || "30d") as AnalyticsPeriod;
      const currency = (url.searchParams.get("currency") || "usd") as CurrencyCode;
      const timeZone = url.searchParams.get("tz") || "Asia/Karachi";
      const db = await getDatabase();
      const analytics = calculatePayoutAnalytics(
        db.payouts,
        period,
        db.payoutSettings?.avgRate ?? 1.27,
        currency,
        timeZone,
      );
      return jsonResponse(analytics);
    }

    // -------------------------------------------------------------
    // GET /api/payouts
    // -------------------------------------------------------------
    if (path === "/api/payouts" && method === "GET") {
      const db = await getDatabase();
      return jsonResponse({
        records: db.payouts,
        batches: db.payoutBatches,
        settings: db.payoutSettings,
        lastUpdated: db.lastUpdated,
      });
    }

    // -------------------------------------------------------------
    // POST /api/payouts (save / append payout records)
    // -------------------------------------------------------------
    if (path === "/api/payouts" && method === "POST") {
      const body = (await request.json()) as {
        records?: PayoutRecord[];
        batches?: ImportBatch[];
        settings?: Settings;
      };

      const nowIso = new Date().toISOString();
      const processedRecords = body.records?.map((p) => ({
        ...p,
        importedAt: p.importedAt || nowIso,
        payout_uploaded_at: p.payout_uploaded_at || p.importedAt || nowIso,
        payout_processed_at: p.payout_processed_at || nowIso,
      }));

      const updated = await saveDatabase((db) => {
        if (processedRecords) {
          const map = new Map<string, PayoutRecord>();
          for (const p of db.payouts || []) {
            const key = p.dupKey || p.id || `${p.orderNumber}:${p.payoutDate || p.orderDate}`;
            map.set(key, p);
          }
          for (const p of processedRecords) {
            const key = p.dupKey || p.id || `${p.orderNumber}:${p.payoutDate || p.orderDate}`;
            map.set(key, p);
          }
          db.payouts = Array.from(map.values());
        }
        if (body.batches) {
          const bMap = new Map<string, ImportBatch>();
          for (const b of db.payoutBatches || []) {
            bMap.set(b.id, b);
          }
          for (const b of body.batches) {
            bMap.set(b.id, b);
          }
          db.payoutBatches = Array.from(bMap.values());
        }
        if (body.settings) db.payoutSettings = body.settings;
      });

      return jsonResponse({
        success: true,
        count: updated.payouts.length,
        batchesCount: updated.payoutBatches.length,
      });
    }

    // -------------------------------------------------------------
    // POST /api/payouts/clear
    // -------------------------------------------------------------
    if (path === "/api/payouts/clear" && method === "POST") {
      await saveDatabase((db) => {
        db.payouts = [];
        db.payoutBatches = [];
      });
      return jsonResponse({ success: true });
    }

    // -------------------------------------------------------------
    // POST /api/payouts/delete or DELETE /api/payouts/:id
    // -------------------------------------------------------------
    if (
      (path === "/api/payouts/delete" && method === "POST") ||
      (path.startsWith("/api/payouts/") && method === "DELETE")
    ) {
      let idToDelete = "";
      if (method === "DELETE") {
        idToDelete = decodeURIComponent(path.replace("/api/payouts/", ""));
      } else {
        const body = (await request.json()) as { id?: string };
        idToDelete = body.id || "";
      }

      if (!idToDelete) {
        return jsonResponse({ error: "Missing payout ID" }, 400);
      }

      const updated = await deletePayoutFromDatabase(idToDelete);
      return jsonResponse({
        success: true,
        count: updated.payouts.length,
      });
    }

    // -------------------------------------------------------------
    // POST /api/payouts/process-and-match
    // Primary backend endpoint: Matches payout orders against shipments
    // and updates matching shipments to "Received"
    // -------------------------------------------------------------
    if (path === "/api/payouts/process-and-match" && method === "POST") {
      const body = (await request.json()) as {
        payoutRecords: PayoutRecord[];
        batch: ImportBatch;
      };

      const incomingPayouts = Array.isArray(body.payoutRecords) ? body.payoutRecords : [];
      const newBatch = body.batch;
      const processingTimestamp = new Date().toISOString();

      // Ensure every incoming payout record has the backend upload/processing timestamp
      const stampedIncomingPayouts: PayoutRecord[] = incomingPayouts.map((p) => ({
        ...p,
        importedAt: p.importedAt || processingTimestamp,
        payout_uploaded_at: p.payout_uploaded_at || p.importedAt || processingTimestamp,
        payout_processed_at: p.payout_processed_at || processingTimestamp,
      }));

      const db = await getDatabase();
      const shipments = [...db.shipments];
      const existingPayouts = [...db.payouts];
      const existingBatches = [...db.payoutBatches];

      // Build a lookup index for shipments by normalized Order Number
      // Maps normalized order number -> array of indices in `shipments`
      const shipmentOrderIndex = new Map<string, number[]>();
      shipments.forEach((s, idx) => {
        const key = normalizeOrderNumber(s.orderNumber);
        if (key) {
          const list = shipmentOrderIndex.get(key) || [];
          list.push(idx);
          shipmentOrderIndex.set(key, list);
        }
      });

      // Track duplicate protection and match statistics
      const processedPayoutOrderNumbers = new Set<string>();
      let duplicatePayoutOrders = 0;
      let matchedShipments = 0;
      let markedReceived = 0;
      const unmatchedOrders: Array<{ orderNumber: string; result: string }> = [];

      for (const payout of stampedIncomingPayouts) {
        const rawOrderNum = payout.orderNumber || "";
        const normalized = normalizeOrderNumber(rawOrderNum);

        if (!normalized) {
          continue;
        }

        // Duplicate protection within the payout batch
        if (processedPayoutOrderNumbers.has(normalized)) {
          duplicatePayoutOrders++;
          continue;
        }
        processedPayoutOrderNumbers.add(normalized);

        // Search matching shipment orders
        const matchingIndices = shipmentOrderIndex.get(normalized);

        if (matchingIndices && matchingIndices.length > 0) {
          matchedShipments++;
          for (const idx of matchingIndices) {
            const currentShipment = shipments[idx];
            if (currentShipment.status !== "Received") {
              shipments[idx] = {
                ...currentShipment,
                status: "Received",
              };
              markedReceived++;
            }
          }
        } else {
          unmatchedOrders.push({
            orderNumber: rawOrderNum || "(empty)",
            result: "Shipment not found",
          });
        }
      }

      // Merge and save payout records
      const mergedPayouts = [...existingPayouts, ...stampedIncomingPayouts];
      const mergedBatches = newBatch ? [newBatch, ...existingBatches] : existingBatches;

      await saveDatabase((data) => {
        data.shipments = shipments;
        data.payouts = mergedPayouts;
        data.payoutBatches = mergedBatches;
      });

      const summary = {
        totalPayoutOrders: incomingPayouts.length,
        matchedShipments,
        markedReceived,
        ordersNotFound: unmatchedOrders.length,
        duplicatePayoutOrders,
        unmatchedOrders,
        payoutImported: incomingPayouts.length,
      };

      return jsonResponse({
        success: true,
        summary,
        updatedShipments: shipments,
        updatedPayouts: mergedPayouts,
      });
    }

    return jsonResponse({ error: "Endpoint not found" }, 404);
  } catch (error) {
    console.error("[API Error]", error);
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return jsonResponse({ error: msg }, 500);
  }
}
