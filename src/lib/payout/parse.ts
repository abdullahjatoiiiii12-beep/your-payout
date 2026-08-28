import type { PayoutRecord } from "./types";
import { isFleekStatement, parseFleekLines } from "./fleek";

/* ---------------- text extraction ---------------- */

function readFileBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }
      reject(new Error("The PDF could not be read on this device"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("The PDF could not be read"));
    reader.readAsArrayBuffer(file);
  });
}

export async function extractPdfLines(file: File): Promise<string[]> {
  // Use PDF.js' compatibility build. The default v6 bundle relies on newer
  // browser APIs (notably Promise.withResolvers/Iterator helpers) and fails on
  // some Safari/WebView versions with the opaque "undefined is not a function".
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerUrl = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  // File.arrayBuffer is missing on older iPhone Safari/WebViews.
  const buf = await readFileBuffer(file);
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const lines: string[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const rows = new Map<number, { x: number; s: string }[]>();
    const seen = new Set<string>();
    for (const item of content.items as Array<{ str?: string; transform?: number[] }>) {
      const str = String(item.str ?? "");
      if (!str.trim()) continue;
      const y = Math.round((item.transform?.[5] ?? 0) / 3) * 3;
      const x = item.transform?.[4] ?? 0;
      // Some PDFs paint the same text twice; drop exact duplicate draws.
      const key = `${y}|${Math.round(x)}|${str}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push({ x, s: str });
    }

    const ys = [...rows.keys()].sort((a, b) => b - a);
    for (const y of ys) {
      const line = rows
        .get(y)!
        .sort((a, b) => a.x - b.x)
        .map((i) => i.s)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (line) lines.push(line);
    }
  }
  return lines;
}

/* ---------------- helpers ---------------- */

const MONTHS = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*";
const DATE_RE = new RegExp(
  `(\\d{1,2}[\\/.-]\\d{1,2}[\\/.-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\s+${MONTHS}\\.?,?\\s+\\d{4}|${MONTHS}\\.?\\s+\\d{1,2},?\\s+\\d{4})`,
  "i",
);

const MONTH_MAP: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/** Normalise any recognised date string to ISO yyyy-mm-dd, else "". */
export function normaliseDate(raw?: string | null): string {
  if (!raw) return "";
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    let d = m[1]!,
      mo = m[2]!;
    const y = m[3]!;
    if (+d > 12 && +mo <= 12) {
      // dd/mm/yyyy
    } else if (+mo > 12) {
      [d, mo] = [mo, d];
    }
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  m = s.match(new RegExp(`^(\\d{1,2})\\s+(${MONTHS})\\.?,?\\s+(\\d{4})$`, "i"));
  if (m) {
    const mo = MONTH_MAP[m[2]!.slice(0, 3).toLowerCase()]!;
    return `${m[3]}-${String(mo).padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  }

  m = s.match(new RegExp(`^(${MONTHS})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})$`, "i"));
  if (m) {
    const mo = MONTH_MAP[m[1]!.slice(0, 3).toLowerCase()]!;
    return `${m[3]}-${String(mo).padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
  }
  return "";
}

function findDate(text: string): string {
  const m = text.match(DATE_RE);
  return m ? normaliseDate(m[1]) : "";
}

function num(raw?: string | null): number | null {
  if (raw == null) return null;
  const cleaned = raw.replace(/[£$,\s]/g, "").replace(/[()]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const v = parseFloat(cleaned);
  if (Number.isNaN(v)) return null;
  return /^\(.*\)$/.test(raw.trim()) ? -v : v;
}

const MONEY_RE = /-?£?\s?-?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|-?£?\s?\d+(?:\.\d{1,2})?/g;

function moneyAfterLabel(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const re = new RegExp(
      `${label}[^\\d£()-]{0,20}(\\(?-?£?\\s?-?[\\d,]+(?:\\.\\d{1,2})?\\)?)`,
      "i",
    );
    const m = text.match(re);
    const v = num(m?.[1]);
    if (v != null) return v;
  }
  return null;
}

function lastMoney(line: string): number | null {
  const all = line.match(MONEY_RE);
  if (!all?.length) return null;
  return num(all[all.length - 1]!);
}

/* ---------------- field detection ---------------- */

const CATEGORY_KEYWORDS: [string, RegExp][] = [
  ["Y2K", /\by ?2 ?k\b/i],
  ["VINTAGE", /\bvintage\b/i],
  ["BRANDED", /\bbranded\b|\bbrand mix\b/i],
  ["SPORTSWEAR", /\bsportswear|track ?suit|jersey\b/i],
  ["DENIM", /\bdenim|jeans\b/i],
  ["JACKETS", /\bjacket|coat|puffer\b/i],
  ["HOODIES", /\bhoodie|sweatshirt|crewneck\b/i],
  ["T-SHIRTS", /\bt-?shirts?\b|\btees?\b/i],
  ["SHIRTS", /\bshirts?\b/i],
  ["KNITWEAR", /\bknit|jumper|sweater|cardigan\b/i],
  ["TRACKSUITS", /\btrousers|pants|cargo\b/i],
  ["ACCESSORIES", /\bbag|cap|hat|belt|scarf\b/i],
  ["SHOES", /\bshoes|trainers|sneakers|boots\b/i],
];

export function detectCategory(productName: string): string {
  for (const [cat, re] of CATEGORY_KEYWORDS) if (re.test(productName)) return cat;
  return "";
}

export function detectQuantity(productName: string): number | null {
  const m =
    productName.match(/(\d{1,5})\s*(?:x\s*)?(?:pcs|pc|pieces|piece|items)\b/i) ??
    productName.match(/\bqty[:\s]+(\d{1,5})\b/i);
  if (m) {
    const v = parseInt(m[1]!, 10);
    return Number.isFinite(v) ? v : null;
  }
  return null;
}

function cleanProductName(raw: string): string {
  return raw
    .replace(/£\s?[\d,]+(?:\.\d{1,2})?/g, " ")
    .replace(/\b(?:order|invoice|payout)\s*(?:no\.?|number|#)?\s*[:#]?\s*[A-Z0-9-]{4,}/gi, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s\-–|:,.]+|[\s\-–|:,.]+$/g, "")
    .trim();
}

/** Lines that are pure financial/label noise, never a product title. */
const LABEL_LINE_RE =
  /^(order|payout|invoice|remittance|supplier|seller|date|total|subtotal|sub total|base price|item price|gross|net|fleek commission|commission|platform fee|service fee|discount|promo|adjustment|shipping|delivery|postage|freight|balance|amount|qty|quantity|vat|tax|page|summary|order details)\b/i;

const ORDER_RE =
  /(?:order|ord|inv|invoice)\s*(?:no\.?|number|id|#)?\s*[:#]?\s*([A-Z]{0,4}[-]?\d{4,}[A-Z0-9-]*)|#([A-Z0-9]{4,}[A-Z0-9-]*)/i;

/** Bare identifier tokens used as order numbers in table-style payout PDFs. */
const BARE_ID_RE =
  /\b([A-Z]{1,6}[-_/]?\d{3,}[A-Z0-9-]*|\d{5,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i;

/** Token at the very start of a table row that identifies an order. */
function leadingIdToken(line: string): string | null {
  const m = line.match(/^\s*#?\s*([A-Za-z0-9][A-Za-z0-9._\-/]{3,})\b/);
  if (!m) return null;
  const tok = m[1]!;
  if (!/\d/.test(tok)) return null; // ids always carry digits
  if (DATE_RE.test(tok)) return null;
  if (/^£?[\d,]+(\.\d{1,2})?$/.test(tok)) return null; // pure money/number column
  if (LABEL_LINE_RE.test(tok)) return null;
  return tok;
}

/** Lines that end an "Order Level Details" table. */
const SECTION_END_RE = /^(grand\s*total|total\s*payout|summary|end of report|disclaimer|terms\b)/i;

function looksLikeMoneyRow(line: string): boolean {
  const m = line.match(MONEY_RE);
  return !!m && m.some((x) => /\d/.test(x)) && /[a-z]{3,}/i.test(line);
}

function detectSupplier(lines: string[], fileName: string): string {
  const joined = lines.slice(0, 40).join("\n");
  const patterns = [
    /(?:supplier|seller|vendor|paid to|payee|store|shop)\s*(?:name)?\s*[:-]\s*(.+)/i,
    /payout\s+(?:statement\s+)?for\s*[:-]?\s*(.+)/i,
  ];
  for (const re of patterns) {
    const m = joined.match(re);
    if (m) {
      const v = m[1]!.split(/\s{2,}|\||,\s?(?=[A-Z]{2,})/)[0]!.trim();
      if (v && v.length < 80) return v;
    }
  }
  const first = lines.find(
    (l) => l.length > 2 && l.length < 60 && !/payout|statement|invoice|page|remittance/i.test(l),
  );
  return first?.trim() || fileName.replace(/\.pdf$/i, "");
}

/* ---------------- per-order breakdown ---------------- */

export const BREAKDOWN_KEYS = [
  "vendorBasePrice",
  "discount",
  "totalBasePrice",
  "commission",
  "balance",
] as const;

export type BreakdownKey = (typeof BREAKDOWN_KEYS)[number];
export type Breakdown = Record<BreakdownKey, number | null>;

const BREAKDOWN_LABELS: [BreakdownKey, RegExp][] = [
  ["vendorBasePrice", /vendor\s*base\s*price/i],
  ["discount", /discount/i],
  ["totalBasePrice", /total\s*base\s*price/i],
  ["commission", /fleek\s*commission|commission/i],
  ["balance", /balance/i],
];

/** Read the money-column order from the table header, e.g. Vendor Base Price | Discount | ... */
export function detectColumnOrder(lines: string[]): BreakdownKey[] {
  for (const line of lines) {
    const hits: { key: BreakdownKey; at: number }[] = [];
    for (const [key, re] of BREAKDOWN_LABELS) {
      const m = line.match(re);
      if (m && m.index != null) hits.push({ key, at: m.index });
    }
    const unique = new Map<BreakdownKey, number>();
    for (const h of hits) if (!unique.has(h.key)) unique.set(h.key, h.at);
    if (unique.size >= 3) {
      return [...unique.entries()].sort((a, b) => a[1] - b[1]).map(([k]) => k);
    }
  }
  return [...BREAKDOWN_KEYS];
}

const emptyBreakdown = (): Breakdown => ({
  vendorBasePrice: null,
  discount: null,
  totalBasePrice: null,
  commission: null,
  balance: null,
});

/** Assign the trailing money columns of a table row to the header's column order. */
export function positionalBreakdown(blockLines: string[], order: BreakdownKey[]): Breakdown {
  const out = emptyBreakdown();
  const row = blockLines.slice(0, 2).join(" ");
  const tokens = (row.match(MONEY_RE) ?? [])
    .map((t) => num(t))
    .filter((v): v is number => v != null);
  if (tokens.length < order.length) return out;
  const tail = tokens.slice(tokens.length - order.length);
  order.forEach((key, i) => {
    out[key] = tail[i] ?? null;
  });
  return out;
}

/* ---------------- main parser ---------------- */

export function makeRecordId(r: {
  supplier: string;
  orderNumber: string;
  orderDate: string;
  productName: string;
}): string {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  // Order number is the strongest identity signal; supplier scopes it so two
  // suppliers can never collide. Used as the duplicate key, not the row id.
  return [norm(r.supplier), norm(r.orderNumber)].join("::");
}

export function parsePayoutLines(
  allLines: string[],
  fileName: string,
): Omit<PayoutRecord, "importedAt">[] {
  // Fleek statements have a known layout — parse them exactly.
  if (isFleekStatement(allLines)) {
    const fleek = parseFleekLines(allLines, fileName);
    if (fleek.length) return fleek;
  }
  // "Order Level Details" is the authoritative per-order section in these payout
  // PDFs — when present, parse only from there so every listed order is picked up
  // and summary/aggregate blocks above it are ignored.
  const headerRe = /order\s*[-_ ]?level\s*details/i;
  const hasSection = allLines.some((l) => headerRe.test(l));
  let lines = allLines;

  if (hasSection) {
    // The header can repeat on every page — collect every section segment so all
    // rows across all pages are parsed, not just the first page's rows.
    const collected: string[] = [];
    let inside = false;
    for (const l of allLines) {
      if (headerRe.test(l)) {
        inside = true;
        continue;
      }
      if (!inside) continue;
      if (SECTION_END_RE.test(l.trim())) {
        inside = false;
        continue;
      }
      collected.push(l);
    }
    if (collected.length) lines = collected;
  }
  let rowSeq = 0;
  const rowId = (dupKey: string) => `${dupKey}#${fileName}#${++rowSeq}`;
  const supplier = detectSupplier(lines, fileName);
  const columnOrder = detectColumnOrder(allLines);
  const head = lines.slice(0, 60).join("\n");

  const payoutDate =
    normaliseDate(
      head.match(
        new RegExp(
          `(?:payout|payment|statement|paid on)\\s*(?:date)?\\s*[:\\-]?\\s*${DATE_RE.source}`,
          "i",
        ),
      )?.[1],
    ) || findDate(head);

  const payoutRef =
    head.match(
      /(?:payout|remittance|statement)\s*(?:id|no\.?|number|ref(?:erence)?)\s*[:#-]?\s*([A-Z0-9-]{4,})/i,
    )?.[1] ?? "";

  // Split into blocks: a new block starts on every line carrying an order number.
  const blocks: { orderNumber: string; lines: string[] }[] = [];
  const seenLeading = new Set<string>();
  for (const line of lines) {
    const m = line.match(ORDER_RE);
    if (m) {
      const orderNumber = (m[1] ?? m[2] ?? "").trim();
      if (orderNumber && /\d{3,}/.test(orderNumber)) {
        blocks.push({ orderNumber, lines: [line] });
        continue;
      }
    }
    // Table-style rows: a row starts whenever the line begins with an id token,
    // even if the money columns wrapped onto the following line.
    const lead = leadingIdToken(line);
    if (lead && !seenLeading.has(`${lead}|${line}`)) {
      seenLeading.add(`${lead}|${line}`);
      blocks.push({ orderNumber: lead, lines: [line] });
      continue;
    }
    // Fallback: identifier somewhere in a money-bearing row.
    if (looksLikeMoneyRow(line)) {
      const bare = line.match(BARE_ID_RE)?.[1]?.trim();
      if (bare && !DATE_RE.test(bare)) {
        blocks.push({ orderNumber: bare, lines: [line] });
        continue;
      }
    }
    if (blocks.length) blocks[blocks.length - 1]!.lines.push(line);
  }

  const parsedRows: Omit<PayoutRecord, "importedAt">[] = [];

  for (const block of blocks) {
    // A block is bounded: stop collecting once we hit obvious footer/summary noise.
    const text = block.lines
      .slice(0, 6)
      .filter((l) => !/^(page \d|thank you|terms|generated)/i.test(l))
      .join(" \n ");

    const orderDate =
      normaliseDate(
        text.match(new RegExp(`order\\s*date\\s*[:\\-]?\\s*${DATE_RE.source}`, "i"))?.[1],
      ) || findDate(text);

    const basePrice = moneyAfterLabel(text, [
      "base price",
      "item price",
      "subtotal",
      "product total",
      "gross",
    ]);
    const shipping = moneyAfterLabel(text, ["shipping", "delivery", "postage", "freight"]);

    // Per-order financial breakdown: labelled values win, otherwise fall back to
    // the money columns of the row in the order the table header declares them.
    const labelled = {
      vendorBasePrice: moneyAfterLabel(text, ["vendor base price", "vendor price"]),
      discount: moneyAfterLabel(text, ["discount", "promo", "adjustment"]),
      totalBasePrice: moneyAfterLabel(text, ["total base price"]),
      commission: moneyAfterLabel(text, [
        "fleek commission",
        "commission",
        "platform fee",
        "service fee",
      ]),
      balance: moneyAfterLabel(text, ["balance", "net payout", "payout amount", "net total"]),
    };
    const positional = positionalBreakdown(block.lines, columnOrder);
    const breakdown = { ...positional };
    for (const k of BREAKDOWN_KEYS) {
      if (labelled[k] != null) breakdown[k] = labelled[k];
    }
    // Derive whatever the statement leaves implicit.
    if (breakdown.totalBasePrice == null && breakdown.vendorBasePrice != null) {
      breakdown.totalBasePrice = +(breakdown.vendorBasePrice - (breakdown.discount ?? 0)).toFixed(
        2,
      );
    }
    if (breakdown.vendorBasePrice == null && breakdown.totalBasePrice != null) {
      breakdown.vendorBasePrice = +(breakdown.totalBasePrice + (breakdown.discount ?? 0)).toFixed(
        2,
      );
    }
    if (breakdown.balance == null && breakdown.totalBasePrice != null) {
      breakdown.balance = +(breakdown.totalBasePrice - (breakdown.commission ?? 0)).toFixed(2);
    }

    const commission = breakdown.commission;
    const discount = breakdown.discount;

    let gbp =
      breakdown.balance ??
      moneyAfterLabel(text, [
        "payout amount",
        "net payout",
        "payout",
        "total payout",
        "balance",
        "net total",
        "you (?:will )?receive",
        "total",
      ]) ??
      lastMoney(block.lines[0] ?? "");

    if (gbp == null && basePrice != null) {
      gbp = +(basePrice - (commission ?? 0) - (discount ?? 0) + (shipping ?? 0)).toFixed(2);
    }

    // product name: prefer an explicitly labelled title, else the longest wordy
    // fragment in the block that is not a financial/label line.
    const titleLabel = text.match(
      /(?:product|item|title|description)\s*(?:name)?\s*[:-]\s*([^\n]+)/i,
    )?.[1];
    let productName = titleLabel ? cleanProductName(titleLabel) : "";
    if (!productName) {
      const candidates: string[] = [];
      for (const l of block.lines.slice(0, 8)) {
        const c = cleanProductName(l);
        if (c.length >= 6 && /[a-z]{3,}/i.test(c) && !LABEL_LINE_RE.test(c) && !DATE_RE.test(c)) {
          candidates.push(c);
        }
      }
      productName = cleanProductName(candidates.sort((a, b) => b.length - a.length)[0] ?? "");
    }

    const quantity =
      detectQuantity(productName) ??
      (() => {
        const m = text.match(/\b(?:qty|quantity|pcs|units)\s*[:-]?\s*(\d{1,5})\b/i);
        return m ? parseInt(m[1]!, 10) : null;
      })();

    const weightKg = (() => {
      const m = text.match(/([\d.]+)\s*(?:kgs?|kilograms?)\b/i);
      return m ? num(m[1]!) : null;
    })();

    const packages = (() => {
      const m = text.match(/\b(\d{1,4})\s*(?:packages?|boxes?|cartons?|parcels?)\b/i);
      return m ? parseInt(m[1]!, 10) : null;
    })();

    const dimensions =
      text.match(/(\d{1,3}\s?[x×]\s?\d{1,3}\s?[x×]\s?\d{1,3})\s*(?:cm)?/i)?.[1] ?? "";
    const country = text.match(/\bcountry\s*[:-]\s*([A-Za-z ]{2,30})/i)?.[1]?.trim() ?? "";

    const base = {
      supplier,
      payoutDate,
      payoutRef,
      orderDate,
      orderNumber: block.orderNumber,
      productName,
      category: detectCategory(productName),
      quantity,
      weightKg,
      gbpAmount: gbp,
      basePrice,
      commission,
      discount,
      vendorBasePrice: breakdown.vendorBasePrice,
      totalBasePrice: breakdown.totalBasePrice,
      balance: breakdown.balance,
      shipping,
      packages,
      dimensions,
      country,
      sourceFile: fileName,
    };

    // Every order row in the PDF is kept — duplicates are flagged, never dropped.
    const dupKey = makeRecordId(base);
    parsedRows.push({ ...base, dupKey, isDuplicate: false, id: rowId(dupKey) });
  }

  const parsed = parsedRows.filter((r) => r.orderNumber);
  if (parsed.length) return parsed;

  // Last-resort fallback: treat every money-bearing text line as one order row so
  // unusual layouts still produce data the user can review and correct.
  const fallback: Omit<PayoutRecord, "importedAt">[] = [];
  let idx = 0;
  for (const line of lines) {
    if (!looksLikeMoneyRow(line)) continue;
    const clean = cleanProductName(line);
    if (clean.length < 4 || LABEL_LINE_RE.test(clean)) continue;
    idx++;
    const base = {
      supplier,
      payoutDate,
      payoutRef,
      orderDate: findDate(line) || payoutDate,
      orderNumber:
        line.match(BARE_ID_RE)?.[1]?.trim() ||
        `${fileName.replace(/\.pdf$/i, "")}-${String(idx).padStart(3, "0")}`,
      productName: clean,
      category: detectCategory(clean),
      quantity: detectQuantity(clean),
      weightKg: null,
      gbpAmount: lastMoney(line),
      basePrice: null,
      commission: null,
      discount: null,
      vendorBasePrice: null,
      totalBasePrice: null,
      balance: lastMoney(line),
      shipping: null,
      packages: null,
      dimensions: "",
      country: "",
      sourceFile: fileName,
    };
    const dupKey = makeRecordId(base);
    fallback.push({ ...base, dupKey, isDuplicate: false, id: rowId(dupKey) });
  }
  return fallback;
}

export async function parsePdfFile(file: File): Promise<Omit<PayoutRecord, "importedAt">[]> {
  const lines = await extractPdfLines(file);
  if (!lines.length) throw new Error("No readable text found (the PDF may be a scanned image)");
  const records = parsePayoutLines(lines, file.name);
  if (!records.length) throw new Error("No payout orders could be detected in this file");
  return records;
}
