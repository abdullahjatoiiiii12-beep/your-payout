import { getDatabase, saveDatabase } from "./db";
import type { PayoutRecord, ImportBatch, Settings } from "../lib/payout/types";
import type { ShipmentRecord, ShipmentBatch, ShipmentSettings } from "../lib/shipment/types";

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
        if (body.records) db.shipments = body.records;
        if (body.batches) db.shipmentBatches = body.batches;
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

      const updated = await saveDatabase((db) => {
        if (body.records) db.payouts = body.records;
        if (body.batches) db.payoutBatches = body.batches;
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

      for (const payout of incomingPayouts) {
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
      const mergedPayouts = [...existingPayouts, ...incomingPayouts];
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
