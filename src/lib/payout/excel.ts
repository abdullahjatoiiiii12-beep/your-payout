import type { PayoutRecord } from "./types";

const GBP_FMT = '£#,##0.00;[Red](£#,##0.00);"-"';
const USD_FMT = '$#,##0.00;[Red]($#,##0.00);"-"';

type ColDef = {
  header: string;
  width: number;
  /** cell value per record; rowNo lets money columns build formulas */
  value: (r: PayoutRecord, idx: number, rowNo: number, avgRate: number) => unknown;
  numFmt?: string;
  align?: "left" | "center";
  total?: boolean;
};

const COLS: ColDef[] = [
  { header: "S NO.", width: 8, value: (_r, idx) => idx + 1 },
  {
    header: "DATE",
    width: 14,
    value: (r) => toDate(r.orderDate || r.payoutDate),
    numFmt: "dd-mmm-yyyy",
  },
  { header: "CATEGORY", width: 16, value: (r) => r.category || "" },
  { header: "ORDER", width: 18, value: (r) => r.orderNumber || "" },
  { header: "PRODUCT NAME", width: 52, value: (r) => r.productName || "", align: "left" },
  { header: "QUANTITY (PCS)", width: 16, value: (r) => r.quantity ?? "", total: true },
  {
    header: "WEIGHT (KGS)",
    width: 15,
    value: (r) => r.weightKg ?? "",
    numFmt: "0.00",
    total: true,
  },
  {
    header: "VENDOR BASE PRICE",
    width: 20,
    value: (r) => r.vendorBasePrice ?? "",
    numFmt: GBP_FMT,
    total: true,
  },
  { header: "DISCOUNT", width: 15, value: (r) => r.discount ?? "", numFmt: GBP_FMT, total: true },
  {
    header: "TOTAL BASE PRICE",
    width: 20,
    value: (r) => r.totalBasePrice ?? "",
    numFmt: GBP_FMT,
    total: true,
  },
  {
    header: "FLEEK COMMISSION",
    width: 20,
    value: (r) => r.commission ?? "",
    numFmt: GBP_FMT,
    total: true,
  },
  { header: "BALANCE", width: 16, value: (r) => r.balance ?? "", numFmt: GBP_FMT, total: true },
  {
    header: "GBP AMOUNT by Fleek",
    width: 22,
    value: (r) => r.gbpAmount ?? "",
    numFmt: GBP_FMT,
    total: true,
  },
  { header: "AVG RATE", width: 12, value: (_r, _i, _row, avgRate) => avgRate, numFmt: "0.0000" },
  {
    header: "USD AMOUNT",
    width: 16,
    value: (_r, _i, rowNo) => ({
      formula: `${col("GBP AMOUNT by Fleek")}${rowNo}*${col("AVG RATE")}${rowNo}`,
    }),
    numFmt: USD_FMT,
    total: true,
  },
  { header: "PACKAGES", width: 13, value: (r) => r.packages ?? "", total: true },
  { header: "DIMENSIONS (C.M)", width: 20, value: (r) => r.dimensions || "" },
  { header: "COUNTRY", width: 14, value: (r) => r.country || "" },
];

export const COLUMNS = COLS.map((c) => c.header);

/** Excel letter for a header name. */
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

export async function downloadExcel(records: PayoutRecord[], avgRate: number) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Payout Manager";
  wb.created = new Date();
  const ws = wb.addWorksheet("PAYOUT DATA", {
    views: [{ state: "frozen", ySplit: HEADER_ROW }],
  });

  ws.columns = COLS.map((c) => ({ width: c.width }));

  ws.mergeCells(1, 1, 1, COLS.length);
  const title = ws.getCell(1, 1);
  title.value = "PAYOUT MASTER DATA";
  title.font = { name: "Arial", size: 16, bold: true };
  title.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;

  ws.mergeCells(2, 1, 2, COLS.length);
  const sub = ws.getCell(2, 1);
  sub.value = `Generated ${new Date().toLocaleString("en-GB")}  •  ${records.length} records`;
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
  a.download = `payout-master-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function thin() {
  const s = { style: "thin" as const, color: { argb: "FFD9D9D9" } };
  return { top: s, left: s, bottom: s, right: s };
}
