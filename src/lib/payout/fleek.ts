import type { PayoutRecord } from "./types";
import { detectCategory, detectQuantity, normaliseDate } from "./parse";

/**
 * Dedicated parser for Fleek supplier payout statements.
 *
 * Layout:
 *   header:  Supplier | Payout date | Payout balance
 *   Summary: #  ORDER DATE  ORDER NUMBER  TITLE (wraps)  BALANCE
 *   Order Level Details: one table per order with the labelled money rows
 *     Vendor Base Price / Discount / Total Base Price / Fleek Commission / Balance
 */

const ORDER_NO_RE = /\b(\d{4,8}\/\d{2})\b/;
const DATE_RE = /\b(\d{2}\/\d{2}\/\d{4})\b/;
const MONEY = String.raw`\(?-?£?\s?-?[\d,]+\.\d{2}\)?`;

function money(raw?: string | null): number | null {
  if (raw == null) return null;
  const neg = /^\(.*\)$/.test(raw.trim());
  const cleaned = raw.replace(/[£,()\s]/g, "");
  const v = parseFloat(cleaned);
  if (!Number.isFinite(v)) return null;
  return neg ? -Math.abs(v) : v;
}

/** Does this look like a Fleek payout statement? */
export function isFleekStatement(lines: string[]): boolean {
  const joined = lines.join("\n");
  return (
    /order\s*level\s*details/i.test(joined) &&
    /particular/i.test(joined) &&
    /(total\s*base\s*price|fleek\s*commission)/i.test(joined)
  );
}

const LABELS = [
  ["vendorBasePrice", /vendor\s*base\s*price/i],
  ["discount", /\bdiscount\b/i],
  ["totalBasePrice", /total\s*base\s*price/i],
  ["commission", /fleek\s*commission/i],
  ["balance", /\bbalance\b/i],
] as const;

type Detail = {
  orderNumber: string;
  orderDate: string;
  vendorBasePrice: number | null;
  discount: number | null;
  totalBasePrice: number | null;
  commission: number | null;
  balance: number | null;
  titleParts: string[];
};

const HEADER_RE = /^ORDER\s+DATE\s+PARTICULAR\s+AMOUNT/i;
const NOISE_RE =
  /^(←?\s*back to summary|download as csv|page \d|summary(\s*\(continued\))?|order level details|supplier\b.*payout|thank you)/i;

/** Remove repeated draw artefacts: "A A 54.00 54.00" -> "A 54.00". */
function dedupeLine(line: string): string {
  const toks = line.split(" ");
  const n = toks.length;
  if (n >= 2 && n % 2 === 0) {
    const half = n / 2;
    if (toks.slice(0, half).join(" ") === toks.slice(half).join(" ")) {
      return toks.slice(0, half).join(" ");
    }
  }
  // token-wise adjacent duplicates ("Balance Balance 45.90 45.90")
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    if (out.length && out[out.length - 1] === toks[i]) continue;
    out.push(toks[i]!);
  }
  return out.join(" ");
}

function parseDetails(lines: string[]): Map<string, Detail> {
  const start = lines.findIndex((l) => /order\s*level\s*details/i.test(l));
  const body = start >= 0 ? lines.slice(start + 1) : lines;
  const blocks: string[][] = [];
  let cur: string[] | null = null;
  for (const raw of body) {
    const line = dedupeLine(raw.trim());
    if (!line) continue;
    if (HEADER_RE.test(line)) {
      cur = [];
      blocks.push(cur);
      continue;
    }
    if (!cur) continue;
    if (NOISE_RE.test(line)) continue;
    cur.push(line);
  }

  const map = new Map<string, Detail>();
  for (const block of blocks) {
    const text = block.join("\n");
    const orderNumber = text.match(ORDER_NO_RE)?.[1];
    if (!orderNumber) continue;
    const d: Detail = {
      orderNumber,
      orderDate: normaliseDate(text.match(DATE_RE)?.[1]),
      vendorBasePrice: null,
      discount: null,
      totalBasePrice: null,
      commission: null,
      balance: null,
      titleParts: [],
    };
    for (const line of block) {
      let matched = false;
      for (const [key, re] of LABELS) {
        if (!re.test(line)) continue;
        if (key === "discount" && /total\s*base|vendor\s*base/i.test(line)) continue;
        const m = line.match(
          // labels can carry a rate suffix, e.g. "Fleek Commission (15%)"
          new RegExp(`${re.source}\\s*(?:\\([^)]*\\))?[^\\d£(-]*(${MONEY})`, "i"),
        );

        const v = money(m?.[1]);
        if (v != null && d[key] == null) d[key] = v;
        matched = true;
      }
      if (matched) continue;
      // remaining text on the row is part of the wrapped product title
      const t = line
        .replace(ORDER_NO_RE, " ")
        .replace(DATE_RE, " ")
        .replace(new RegExp(MONEY, "g"), " ")
        .replace(/\s+/g, " ")
        .trim();
      if (t && /[A-Za-z]/.test(t)) d.titleParts.push(t);
    }
    // keep the richest detail block for an order number
    const prev = map.get(orderNumber);
    if (!prev || (prev.balance == null && d.balance != null)) map.set(orderNumber, d);
  }
  return map;
}

type Summary = { orderNumber: string; orderDate: string; title: string; balance: number | null };

function parseSummary(lines: string[]): Summary[] {
  const end = lines.findIndex((l) => /order\s*level\s*details/i.test(l));
  const body = (end >= 0 ? lines.slice(0, end) : lines).map((l) => dedupeLine(l.trim()));
  const rows: Summary[] = [];
  let pendingTag = "";
  for (const line of body) {
    if (!line || NOISE_RE.test(line) || /^ORDER\s+DATE\s+ORDER\s+NUMBER/i.test(line)) continue;
    if (/^(DISCOUNT|REFUND)$/i.test(line)) {
      pendingTag = line;
      continue;
    }
    const m = line.match(
      new RegExp(`^\\d{1,4}\\s+${DATE_RE.source}\\s+${ORDER_NO_RE.source}\\s*(.*)$`),
    );
    if (m) {
      let rest = (m[3] ?? "").trim();
      const bal = rest.match(new RegExp(`(${MONEY})\\s*$`))?.[1];
      if (bal) rest = rest.slice(0, rest.length - bal.length).trim();
      rest = rest
        .replace(/\b(DISCOUNT|REFUND)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      rows.push({
        orderNumber: m[2]!,
        orderDate: normaliseDate(m[1]),
        title: rest,
        balance: money(bal),
      });
      pendingTag = "";
      continue;
    }
    // wrapped title continuation for the previous summary row
    if (rows.length && /[A-Za-z]/.test(line) && !ORDER_NO_RE.test(line)) {
      const last = rows[rows.length - 1]!;
      const extra = line
        .replace(/\b(DISCOUNT|REFUND)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (extra) last.title = `${last.title} ${extra}`.trim();
    }
    void pendingTag;
  }
  return rows;
}

function parseHeader(lines: string[]) {
  let supplier = "";
  let payoutDate = "";
  let payoutBalance: number | null = null;
  const i = lines.findIndex((l) => /supplier/i.test(l) && /payout\s*date/i.test(l));
  if (i >= 0) {
    const row = dedupeLine((lines[i + 1] ?? "").trim());
    const dm = row.match(/(\d{1,2}\s+[A-Za-z]{3,}\.?,?\s+\d{4}|\d{2}\/\d{2}\/\d{4})/);
    if (dm) {
      supplier = row.slice(0, dm.index).trim();
      payoutDate = normaliseDate(dm[1]);
      payoutBalance = money(row.slice(dm.index! + dm[1]!.length).match(/[\d,]+\.\d{2}/)?.[0]);
    } else {
      supplier = row.trim();
    }
  }
  return { supplier, payoutDate, payoutBalance };
}

export function parseFleekLines(
  allLines: string[],
  fileName: string,
): Omit<PayoutRecord, "importedAt">[] {
  const { supplier, payoutDate } = parseHeader(allLines);
  const summary = parseSummary(allLines);
  const details = parseDetails(allLines);

  const keys = summary.length ? summary.map((s) => s.orderNumber) : [...details.keys()];

  const rows: Omit<PayoutRecord, "importedAt">[] = [];
  let seq = 0;
  for (const key of keys) {
    const s = summary.find((r) => r.orderNumber === key);
    const d = details.get(key);
    const productName = (s?.title || d?.titleParts.join(" ") || "").replace(/\s+/g, " ").trim();
    const commission = d?.commission ?? null;
    const discount = d?.discount ?? null;
    let totalBasePrice = d?.totalBasePrice ?? null;
    let vendorBasePrice = d?.vendorBasePrice ?? null;
    const balance = d?.balance ?? s?.balance ?? null;
    if (totalBasePrice == null && vendorBasePrice != null) {
      totalBasePrice = +(vendorBasePrice + (discount ?? 0)).toFixed(2);
    }
    if (vendorBasePrice == null && totalBasePrice != null) {
      vendorBasePrice = totalBasePrice;
    }
    const base = {
      supplier: supplier || fileName.replace(/\.pdf$/i, ""),
      payoutDate,
      payoutRef: "",
      orderDate: s?.orderDate || d?.orderDate || "",
      orderNumber: key,
      productName,
      category: detectCategory(productName),
      quantity: detectQuantity(productName),
      weightKg: null,
      gbpAmount: balance,
      basePrice: totalBasePrice,
      commission,
      discount,
      vendorBasePrice,
      totalBasePrice,
      balance,
      shipping: null,
      packages: null,
      dimensions: "",
      country: "",
      sourceFile: fileName,
    };
    const dupKey = `${supplier.toLowerCase().replace(/[^a-z0-9]/g, "")}::${key.replace(/[^a-z0-9]/gi, "")}`;
    rows.push({ ...base, dupKey, isDuplicate: false, id: `${dupKey}#${fileName}#${++seq}` });
  }
  return rows;
}
