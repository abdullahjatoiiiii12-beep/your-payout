import type { ShipmentRecord } from "./types";

const GBP_FMT = '£#,##0.00;[Red](£#,##0.00);"-"';
const USD_FMT = '$#,##0.00;[Red]($#,##0.00);"-"';

type ColDef = {
  header: string;
  width: number;
  value: (r: ShipmentRecord, idx: number, rowNo: number, avgRate: number) => unknown;
  numFmt?: string;
  align?: "left" | "center";
  total?: boolean;
};

const COLS: ColDef[] = [
  { header: "S NO.", width: 8, value: (_r, idx) => idx + 1 },
  {
    header: "SHIP DATE",
    width: 14,
    value: (r) => toDate(r.shipmentDate),
    numFmt: "dd-mmm-yyyy",
  },
  { header: "STATUS", width: 15, value: (r) => r.status || "In Transit" },
  { header: "CARRIER", width: 16, value: (r) => r.carrier || "" },
  { header: "TRACKING / AWB #", width: 22, value: (r) => r.trackingNumber || "" },
  { header: "ORDER NO.", width: 18, value: (r) => r.orderNumber || "" },
  { header: "SUPPLIER", width: 20, value: (r) => r.supplier || "" },
  { header: "RECIPIENT", width: 18, value: (r) => r.recipientName || "" },
  {
    header: "DESTINATION",
    width: 18,
    value: (r) => [r.destinationCity, r.destinationCountry].filter(Boolean).join(", "),
  },
  { header: "PRODUCT / CARGO", width: 42, value: (r) => r.productName || "", align: "left" },
  { header: "CATEGORY", width: 16, value: (r) => r.category || "" },
  { header: "QUANTITY (PCS)", width: 16, value: (r) => r.quantity ?? "", total: true },
  { header: "PACKAGES", width: 13, value: (r) => r.packages ?? "", total: true },
  {
    header: "WEIGHT (KGS)",
    width: 15,
    value: (r) => r.weightKg ?? "",
    numFmt: "0.00",
    total: true,
  },
  { header: "DIMENSIONS", width: 16, value: (r) => r.dimensions || "" },
  {
    header: "SHIPPING COST (£)",
    width: 18,
    value: (r) => r.shippingCost ?? "",
    numFmt: GBP_FMT,
    total: true,
  },
  { header: "AVG RATE", width: 12, value: (_r, _i, _row, avgRate) => avgRate, numFmt: "0.0000" },
  {
    header: "USD COST ($)",
    width: 16,
    value: (_r, _i, rowNo) => ({
      formula: `${col("SHIPPING COST (£)")}${rowNo}*${col("AVG RATE")}${rowNo}`,
    }),
    numFmt: USD_FMT,
    total: true,
  },
  {
    header: "DECLARED VALUE (£)",
    width: 20,
    value: (r) => r.declaredValue ?? "",
    numFmt: GBP_FMT,
    total: true,
  },
  {
    header: "CUSTOMS / DUTY (£)",
    width: 20,
    value: (r) => r.customsFee ?? "",
    numFmt: GBP_FMT,
    total: true,
  },
  { header: "NOTES", width: 24, value: (r) => r.notes || "", align: "left" },
];

export const COLUMNS = COLS.map((c) => c.header);

/** Excel column letter helper */
function col(header: string): string {
  const i = COLS.findIndex((c) => c.header === header) + 1;
  let n = i;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const HEADER_ROW = 4;

function toDate(iso: string): Date | string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : d;
}

function thin() {
  const s = { style: "thin" as const, color: { argb: "FFD9D9D9" } };
  return { top: s, left: s, bottom: s, right: s };
}

export async function downloadShipmentExcel(records: ShipmentRecord[], avgRate: number) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Shipment Master";
  wb.created = new Date();
  const ws = wb.addWorksheet("SHIPMENT DATA", {
    views: [{ state: "frozen", ySplit: HEADER_ROW }],
  });

  ws.columns = COLS.map((c) => ({ width: c.width }));

  ws.mergeCells(1, 1, 1, COLS.length);
  const title = ws.getCell(1, 1);
  title.value = "SHIPMENT MASTER FLEET DATA";
  title.font = { name: "Arial", size: 16, bold: true };
  title.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;

  ws.mergeCells(2, 1, 2, COLS.length);
  const sub = ws.getCell(2, 1);
  sub.value = `Generated ${new Date().toLocaleString("en-GB")}  •  ${records.length} shipments`;
  sub.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF666666" } };
  sub.alignment = { horizontal: "center" };

  const header = ws.getRow(HEADER_ROW);
  COLS.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111111" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = thin();
  });
  header.height = 30;

  const first = HEADER_ROW + 1;
  records.forEach((r, idx) => {
    const rowNo = first + idx;
    const row = ws.getRow(rowNo);
    COLS.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.value = c.value(r, idx, rowNo, avgRate) as import("exceljs").CellValue;
      if (c.numFmt) cell.numFmt = c.numFmt;
      cell.font = { name: "Arial", size: 10 };
      cell.border = thin();
      cell.alignment = {
        vertical: "middle",
        horizontal: c.align === "left" ? "left" : "center",
        wrapText: c.align === "left",
      };
      if (idx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F7F7" } };
      }
    });
  });

  const last = first + Math.max(records.length, 1) - 1;
  const totalRow = ws.getRow(last + 1);
  totalRow.getCell(1).value = "TOTAL";
  COLS.forEach((c, i) => {
    const cell = totalRow.getCell(i + 1);
    if (c.total) {
      const letter = col(c.header);
      cell.value = { formula: `SUBTOTAL(109,${letter}${first}:${letter}${last})` };
      if (c.numFmt) cell.numFmt = c.numFmt.split(";")[0]!;
    }
    cell.font = { name: "Arial", size: 11, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEDED" } };
    cell.border = thin();
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  ws.autoFilter = {
    from: { row: HEADER_ROW, column: 1 },
    to: { row: last, column: COLS.length },
  };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shipment-master-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function downloadSampleShipmentTemplate() {
  const sampleRecords: ShipmentRecord[] = [
    {
      id: "sample-1",
      dupKey: "dhl-gb-01",
      isDuplicate: false,
      trackingNumber: "DHL-984210984",
      orderNumber: "ORD-89421",
      shipmentDate: "2025-02-14",
      deliveryDate: "2025-02-18",
      carrier: "DHL Express",
      supplier: "Vintage Wholesale UK",
      recipientName: "Metro Hub London",
      destinationCity: "London",
      destinationCountry: "United Kingdom",
      productName: "Grade A Vintage Fleece & Sweats Bales",
      category: "Vintage Apparel",
      quantity: 120,
      packages: 3,
      weightKg: 45.5,
      dimensions: "60x40x40 cm",
      shippingCost: 85.5,
      customsFee: 14.2,
      declaredValue: 650.0,
      currency: "GBP",
      status: "Delivered",
      notes: "Fragile vintage denim and fleece bales",
      sourceFile: "sample_manifest.xlsx",
      importedAt: new Date().toISOString(),
    },
    {
      id: "sample-2",
      dupKey: "fedex-fr-02",
      isDuplicate: false,
      trackingNumber: "FDX-773091823",
      orderNumber: "ORD-89422",
      shipmentDate: "2025-02-15",
      deliveryDate: "2025-02-19",
      carrier: "FedEx",
      supplier: "Paris Relove Co",
      recipientName: "Manchester Boutique",
      destinationCity: "Manchester",
      destinationCountry: "United Kingdom",
      productName: "Y2K Leather Jackets & Outerwear",
      category: "Outerwear",
      quantity: 48,
      packages: 2,
      weightKg: 28.0,
      dimensions: "50x50x35 cm",
      shippingCost: 62.0,
      customsFee: 9.5,
      declaredValue: 420.0,
      currency: "GBP",
      status: "In Transit",
      notes: "Express air priority",
      sourceFile: "sample_manifest.xlsx",
      importedAt: new Date().toISOString(),
    },
    {
      id: "sample-3",
      dupKey: "dpd-it-03",
      isDuplicate: false,
      trackingNumber: "DPD-441209381",
      orderNumber: "ORD-89423",
      shipmentDate: "2025-02-16",
      deliveryDate: "2025-02-20",
      carrier: "DPD",
      supplier: "Milano Deadstock",
      recipientName: "Birmingham Store",
      destinationCity: "Birmingham",
      destinationCountry: "United Kingdom",
      productName: "90s Graphic Tees & Sweatshirts",
      category: "Vintage Tops",
      quantity: 200,
      packages: 4,
      weightKg: 62.0,
      dimensions: "70x50x45 cm",
      shippingCost: 110.0,
      customsFee: 18.0,
      declaredValue: 890.0,
      currency: "GBP",
      status: "Dispatched",
      notes: "Pallet batch #4",
      sourceFile: "sample_manifest.xlsx",
      importedAt: new Date().toISOString(),
    },
  ];

  await downloadShipmentExcel(sampleRecords, 1.27);
}
