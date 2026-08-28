import type { ShipmentRecord, ShipmentStatus } from "./types";

/** Convert any ExcelJS cell value into a clean plain string */
function cellToString(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number" || typeof val === "boolean") return String(val).trim();
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return "";
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === "object") {
    // ExcelJS Formula cell
    if ("result" in val && (val as { result: unknown }).result != null) {
      return cellToString((val as { result: unknown }).result);
    }
    // ExcelJS RichText cell
    if ("richText" in val && Array.isArray((val as { richText: unknown[] }).richText)) {
      return (val as { richText: Array<{ text?: string }> }).richText
        .map((t) => t.text ?? "")
        .join("")
        .trim();
    }
    // ExcelJS hyperlink cell
    if ("text" in val && typeof (val as { text: unknown }).text === "string") {
      return (val as { text: string }).text.trim();
    }
  }
  return String(val).trim();
}

/** Parse various date formats into YYYY-MM-DD */
export function normalizeDate(input: unknown): string {
  if (!input) return "";
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return input.toISOString().slice(0, 10);
  }

  // Handle Excel serial date numbers (e.g. 45230 -> 2023-10-31)
  if (typeof input === "number" && input > 20000 && input < 80000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + input * 86400000);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  const s = String(input).trim();
  if (!s) return "";

  // Check ISO YYYY-MM-DD
  const iso = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (iso && iso[1] && iso[2] && iso[3]) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  // Check DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{2,4})/);
  if (dmy && dmy[1] && dmy[2] && dmy[3]) {
    let year = parseInt(dmy[3], 10);
    if (year < 100) year += 2000;
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // Check Month names like "15 Oct 2024", "October 15, 2024"
  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    return d.toISOString().slice(0, 10);
  }

  return s;
}

/** Clean numeric strings by stripping currencies, commas, and unit letters */
export function parseNumber(input: unknown): number | null {
  if (input == null) return null;
  if (typeof input === "number") {
    return Number.isFinite(input) ? input : null;
  }
  const s = String(input).trim();
  if (!s || s === "-" || s === "N/A" || s === "null") return null;

  // Handle parentheses accounting negative like (150.00)
  const isParenNeg = /^\(.*\)$/.test(s);
  const clean = s.replace(/[^0-9.-]/g, "");
  if (!clean || clean === "-" || clean === ".") return null;

  const num = parseFloat(clean);
  if (!Number.isFinite(num)) return null;
  return isParenNeg ? -Math.abs(num) : num;
}

/** Standardize shipment delivery status */
export function normalizeStatus(input: string): ShipmentStatus {
  const s = input.trim().toLowerCase();
  if (/deliver|received|completed|signed/i.test(s)) return "Delivered";
  if (/transit|in-transit|on the way|moving|customs|cleared/i.test(s)) return "In Transit";
  if (/dispatch|shipped|departed|booked|picked up|manifest/i.test(s)) return "Dispatched";
  if (/out for delivery|with courier/i.test(s)) return "Out for Delivery";
  if (/pending|processing|draft|awaiting/i.test(s)) return "Pending";
  if (/exception|failed|delayed|returned|held|cancelled/i.test(s)) return "Exception";
  return "In Transit";
}

/** Known carrier brand names */
function normalizeCarrier(input: string): string {
  const s = input.trim();
  if (!s) return "Standard Courier";
  if (/dhl/i.test(s)) return /express/i.test(s) ? "DHL Express" : "DHL";
  if (/fedex/i.test(s)) return "FedEx";
  if (/ups/i.test(s)) return "UPS";
  if (/dpd/i.test(s)) return "DPD";
  if (/royal\s*mail/i.test(s)) return "Royal Mail";
  if (/fleek/i.test(s)) return "Fleek Logistics";
  if (/evri|hermes/i.test(s)) return "Evri";
  if (/usps/i.test(s)) return "USPS";
  if (/gls/i.test(s)) return "GLS";
  if (/tnt/i.test(s)) return "TNT";
  if (/aramex/i.test(s)) return "Aramex";
  return s;
}

type ColumnMapping = {
  trackingIndex?: number;
  orderIndex?: number;
  shipDateIndex?: number;
  deliveryDateIndex?: number;
  carrierIndex?: number;
  supplierIndex?: number;
  recipientIndex?: number;
  destCityIndex?: number;
  destCountryIndex?: number;
  productIndex?: number;
  categoryIndex?: number;
  qtyIndex?: number;
  packagesIndex?: number;
  weightIndex?: number;
  weightIsLbs?: boolean;
  dimensionsIndex?: number;
  shippingCostIndex?: number;
  customsIndex?: number;
  declaredValueIndex?: number;
  statusIndex?: number;
  notesIndex?: number;
};

/** Match column headers against known shipment header terminology */
function mapColumns(headers: string[]): ColumnMapping {
  const map: ColumnMapping = {};

  headers.forEach((h, index) => {
    const s = h
      .toLowerCase()
      .replace(/[^a-z0-9]/g, " ")
      .trim();
    if (!s) return;

    // Tracking / AWB
    if (
      map.trackingIndex === undefined &&
      (s.includes("tracking") ||
        s.includes("awb") ||
        s.includes("waybill") ||
        s.includes("consignment") ||
        s.includes("airway") ||
        s.includes("shipment id") ||
        s.includes("track no") ||
        s.includes("shipment no") ||
        s === "track" ||
        s === "shpmt")
    ) {
      map.trackingIndex = index;
      return;
    }

    // Order number
    if (
      map.orderIndex === undefined &&
      (s.includes("order") ||
        s.includes("po num") ||
        s.includes("po no") ||
        s.includes("reference") ||
        s.includes("cust order") ||
        s.includes("invoice no") ||
        s === "po" ||
        s === "order" ||
        s === "ref")
    ) {
      map.orderIndex = index;
      return;
    }

    // Ship date / Dispatch date
    if (
      map.shipDateIndex === undefined &&
      (s.includes("ship date") ||
        s.includes("dispatch date") ||
        s.includes("dispatched") ||
        s.includes("shipment date") ||
        s.includes("sent date") ||
        s.includes("send date") ||
        s.includes("pickup date") ||
        s.includes("order date") ||
        s === "date" ||
        s === "created")
    ) {
      map.shipDateIndex = index;
      return;
    }

    // Delivery date
    if (
      map.deliveryDateIndex === undefined &&
      (s.includes("delivery date") ||
        s.includes("delivered date") ||
        s.includes("received date") ||
        s.includes("est delivery") ||
        s.includes("arrival date") ||
        s === "eta")
    ) {
      map.deliveryDateIndex = index;
      return;
    }

    // Carrier
    if (
      map.carrierIndex === undefined &&
      (s.includes("carrier") ||
        s.includes("courier") ||
        s.includes("service") ||
        s.includes("shipping method") ||
        s.includes("transport") ||
        s.includes("forwarder") ||
        s.includes("shipping line") ||
        s === "provider")
    ) {
      map.carrierIndex = index;
      return;
    }

    // Supplier / Sender
    if (
      map.supplierIndex === undefined &&
      (s.includes("supplier") ||
        s.includes("vendor") ||
        s.includes("sender") ||
        s.includes("shipper") ||
        s.includes("seller") ||
        s.includes("store") ||
        s.includes("source") ||
        s.includes("merchant") ||
        s === "from")
    ) {
      map.supplierIndex = index;
      return;
    }

    // Recipient / Consignee
    if (
      map.recipientIndex === undefined &&
      (s.includes("recipient") ||
        s.includes("consignee") ||
        s.includes("receiver") ||
        s.includes("customer") ||
        s.includes("deliver to") ||
        s.includes("ship to name") ||
        s.includes("client") ||
        s === "buyer")
    ) {
      map.recipientIndex = index;
      return;
    }

    // Destination Country
    if (
      map.destCountryIndex === undefined &&
      (s.includes("country") ||
        s.includes("dest country") ||
        s.includes("destination country") ||
        s.includes("ship to country") ||
        s === "destination" ||
        s === "dest")
    ) {
      map.destCountryIndex = index;
      return;
    }

    // Destination City
    if (
      map.destCityIndex === undefined &&
      (s.includes("city") ||
        s.includes("town") ||
        s.includes("dest city") ||
        s.includes("port") ||
        s.includes("destination city"))
    ) {
      map.destCityIndex = index;
      return;
    }

    // Product / Item name
    if (
      map.productIndex === undefined &&
      (s.includes("product") ||
        s.includes("item name") ||
        s.includes("item desc") ||
        s.includes("description") ||
        s.includes("commodity") ||
        s.includes("goods") ||
        s.includes("title") ||
        s.includes("sku") ||
        s === "item")
    ) {
      map.productIndex = index;
      return;
    }

    // Category
    if (
      map.categoryIndex === undefined &&
      (s.includes("category") ||
        s.includes("dept") ||
        s.includes("department") ||
        s.includes("commodity type") ||
        s.includes("classification"))
    ) {
      map.categoryIndex = index;
      return;
    }

    // Quantity / Units
    if (
      map.qtyIndex === undefined &&
      (s.includes("qty") ||
        s.includes("quantity") ||
        s.includes("pcs") ||
        s.includes("pieces") ||
        s.includes("units") ||
        s.includes("item count") ||
        s === "count")
    ) {
      map.qtyIndex = index;
      return;
    }

    // Packages / Cartons / Boxes
    if (
      map.packagesIndex === undefined &&
      (s.includes("package") ||
        s.includes("pkg") ||
        s.includes("carton") ||
        s.includes("ctn") ||
        s.includes("box") ||
        s.includes("boxes") ||
        s.includes("parcel"))
    ) {
      map.packagesIndex = index;
      return;
    }

    // Weight
    if (
      map.weightIndex === undefined &&
      (s.includes("weight") ||
        s.includes("kg") ||
        s.includes("kgs") ||
        s.includes("gross wt") ||
        s.includes("net wt") ||
        s.includes("chargeable wt") ||
        s.includes("wt") ||
        s.includes("lbs") ||
        s === "mass")
    ) {
      map.weightIndex = index;
      if (s.includes("lbs") || s.includes("pound")) {
        map.weightIsLbs = true;
      }
      return;
    }

    // Dimensions
    if (
      map.dimensionsIndex === undefined &&
      (s.includes("dimension") ||
        s.includes("dim") ||
        s.includes("dims") ||
        s.includes("size") ||
        s.includes("cbm") ||
        s.includes("volume") ||
        s.includes("l x w x h") ||
        s.includes("lxwxh"))
    ) {
      map.dimensionsIndex = index;
      return;
    }

    // Shipping cost / Freight
    if (
      map.shippingCostIndex === undefined &&
      (s.includes("shipping cost") ||
        s.includes("freight") ||
        s.includes("shipping fee") ||
        s.includes("courier charge") ||
        s.includes("postage") ||
        s.includes("delivery cost") ||
        s.includes("delivery fee") ||
        s.includes("rate") ||
        s.includes("freight charge") ||
        s === "cost" ||
        s === "shipping")
    ) {
      map.shippingCostIndex = index;
      return;
    }

    // Customs / Duty
    if (
      map.customsIndex === undefined &&
      (s.includes("custom") ||
        s.includes("duty") ||
        s.includes("tariff") ||
        s.includes("vat") ||
        s.includes("import fee"))
    ) {
      map.customsIndex = index;
      return;
    }

    // Declared value / Order value
    if (
      map.declaredValueIndex === undefined &&
      (s.includes("declared") ||
        s.includes("invoice val") ||
        s.includes("goods value") ||
        s.includes("order value") ||
        s.includes("total base") ||
        s.includes("base price") ||
        s.includes("total amount") ||
        s === "value")
    ) {
      map.declaredValueIndex = index;
      return;
    }

    // Status
    if (
      map.statusIndex === undefined &&
      (s.includes("status") ||
        s.includes("state") ||
        s.includes("delivery status") ||
        s.includes("tracking status") ||
        s.includes("shipping status"))
    ) {
      map.statusIndex = index;
      return;
    }

    // Notes
    if (
      map.notesIndex === undefined &&
      (s.includes("note") ||
        s.includes("remark") ||
        s.includes("comment") ||
        s.includes("instruction"))
    ) {
      map.notesIndex = index;
      return;
    }
  });

  return map;
}

/** Parse CSV text into 2D row array */
function parseCsvText(text: string): string[][] {
  const lines = text.split(/\r\n|\n|\r/);
  const rows: string[][] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    // Detect delimiter: comma, semicolon, tab
    const delimiter = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";

    const row: string[] = [];
    let inQuote = false;
    let current = "";

    for (let i = 0; i < line.length; i++) {
      const char = line[i]!;
      if (char === '"') {
        if (inQuote && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (char === delimiter && !inQuote) {
        row.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

/** Parse a single Excel or CSV file and return clean Shipment records */
export async function parseShipmentFile(
  file: File,
): Promise<Omit<ShipmentRecord, "importedAt" | "isDuplicate">[]> {
  const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
  const records: Omit<ShipmentRecord, "importedAt" | "isDuplicate">[] = [];

  const rawSheets: Array<{ sheetName: string; rows: string[][] }> = [];

  if (isCsv) {
    const text = await file.text();
    const rows = parseCsvText(text);
    rawSheets.push({ sheetName: file.name, rows });
  } else {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await wb.xlsx.load(buffer);

    wb.eachSheet((ws) => {
      if (ws.rowCount === 0) return;
      const rows: string[][] = [];
      ws.eachRow({ includeEmpty: false }, (row) => {
        const values: string[] = [];
        // ExcelJS row.values is 1-indexed
        if (Array.isArray(row.values)) {
          for (let i = 1; i < row.values.length; i++) {
            values.push(cellToString(row.values[i]));
          }
        }
        if (values.some((v) => v.length > 0)) {
          rows.push(values);
        }
      });
      if (rows.length > 0) {
        rawSheets.push({ sheetName: ws.name, rows });
      }
    });
  }

  if (rawSheets.length === 0) {
    throw new Error("No data rows found in this file.");
  }

  for (const { sheetName: _sheetName, rows } of rawSheets) {
    if (rows.length < 2) continue;

    // Find the best header row in the first 20 rows
    let bestHeaderRowIndex = 0;
    let maxHeaderScore = 0;

    const keywords = [
      "tracking",
      "awb",
      "order",
      "date",
      "carrier",
      "supplier",
      "country",
      "product",
      "qty",
      "package",
      "carton",
      "box",
      "weight",
      "kg",
      "cost",
      "freight",
      "status",
      "dimension",
      "declared",
      "value",
      "recipient",
      "destination",
      "item",
      "pcs",
      "po",
    ];

    for (let r = 0; r < Math.min(rows.length, 20); r++) {
      const row = rows[r]!;
      let score = 0;
      for (const cell of row) {
        const lower = cell.toLowerCase();
        for (const kw of keywords) {
          if (lower.includes(kw)) {
            score++;
            break;
          }
        }
      }
      if (score > maxHeaderScore) {
        maxHeaderScore = score;
        bestHeaderRowIndex = r;
      }
    }

    const headerRow = rows[bestHeaderRowIndex] ?? [];
    const map = mapColumns(headerRow);

    // If score is too low, check row 0
    const startDataRow = bestHeaderRowIndex + 1;

    for (let r = startDataRow; r < rows.length; r++) {
      const row = rows[r]!;
      if (!row || row.length === 0) continue;

      const getVal = (idx?: number): string => (idx !== undefined && row[idx] ? row[idx]! : "");

      const trackingRaw = getVal(map.trackingIndex);
      const orderRaw = getVal(map.orderIndex);
      const shipDateRaw = getVal(map.shipDateIndex);
      const deliveryDateRaw = getVal(map.deliveryDateIndex);
      const carrierRaw = getVal(map.carrierIndex);
      const supplierRaw = getVal(map.supplierIndex);
      const recipientRaw = getVal(map.recipientIndex);
      const destCityRaw = getVal(map.destCityIndex);
      const destCountryRaw = getVal(map.destCountryIndex);
      const productRaw = getVal(map.productIndex);
      const categoryRaw = getVal(map.categoryIndex);
      const qtyRaw = getVal(map.qtyIndex);
      const packagesRaw = getVal(map.packagesIndex);
      const weightRaw = getVal(map.weightIndex);
      const dimsRaw = getVal(map.dimensionsIndex);
      const shippingCostRaw = getVal(map.shippingCostIndex);
      const customsRaw = getVal(map.customsIndex);
      const declaredValRaw = getVal(map.declaredValueIndex);
      const statusRaw = getVal(map.statusIndex);
      const notesRaw = getVal(map.notesIndex);

      // Skip row if it doesn't contain any useful identifier
      const hasAnyIdentifier =
        trackingRaw || orderRaw || productRaw || (weightRaw && parseFloat(weightRaw) > 0);
      if (!hasAnyIdentifier) continue;

      // Skip repeated header rows
      if (
        trackingRaw.toLowerCase().includes("tracking") ||
        orderRaw.toLowerCase().includes("order")
      ) {
        continue;
      }

      const trackingNumber = trackingRaw || `SHP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const orderNumber = orderRaw || (trackingRaw ? `ORD-${trackingRaw.slice(-6)}` : "");
      const shipmentDate = normalizeDate(shipDateRaw) || new Date().toISOString().slice(0, 10);
      const deliveryDate = normalizeDate(deliveryDateRaw);
      const carrier = normalizeCarrier(carrierRaw);
      const supplier = supplierRaw || "Supplier Direct";
      const recipientName = recipientRaw || "Warehouse Hub";
      const destinationCity = destCityRaw;
      const destinationCountry = destCountryRaw || "United Kingdom";
      const productName = productRaw || "Consolidated Cargo";
      const category = categoryRaw || "General Goods";

      const quantity = parseNumber(qtyRaw);
      const packages =
        parseNumber(packagesRaw) ?? (quantity ? Math.max(1, Math.ceil(quantity / 50)) : 1);

      let weightKg = parseNumber(weightRaw);
      if (weightKg != null && map.weightIsLbs) {
        weightKg = +(weightKg * 0.453592).toFixed(2);
      } else if (weightKg != null) {
        weightKg = +weightKg.toFixed(2);
      }

      const dimensions = dimsRaw;
      const shippingCost = parseNumber(shippingCostRaw);
      const customsFee = parseNumber(customsRaw);
      const declaredValue = parseNumber(declaredValRaw);
      const status = statusRaw ? normalizeStatus(statusRaw) : "In Transit";
      const notes = notesRaw;

      const dupKey = `${trackingNumber}|${orderNumber}|${supplier}|${shipmentDate}`.toLowerCase();

      records.push({
        id: crypto.randomUUID(),
        dupKey,
        trackingNumber,
        orderNumber,
        shipmentDate,
        deliveryDate,
        carrier,
        supplier,
        recipientName,
        destinationCity,
        destinationCountry,
        productName,
        category,
        quantity,
        packages,
        weightKg,
        dimensions,
        shippingCost,
        customsFee,
        declaredValue,
        currency: "GBP",
        status,
        notes,
        sourceFile: file.name,
      });
    }
  }

  if (records.length === 0) {
    throw new Error(
      "Could not extract shipment records from this file. Ensure columns contain tracking, order or shipment items.",
    );
  }

  return records;
}
