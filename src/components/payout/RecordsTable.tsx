import { useMemo, useState } from "react";
import { ArrowUpDown, Inbox, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PayoutRecord } from "@/lib/payout/types";
import { PayoutMobileCard } from "./PayoutMobileCard";

const ALL = "__all__";
const PAGE_SIZES = [25, 50, 100, 250];

type SortKey = "date" | "amount";
type DupFilter = "all" | "unique" | "duplicates";

export function RecordsTable({ records, avgRate }: { records: PayoutRecord[]; avgRate: number }) {
  const [query, setQuery] = useState("");
  const [supplier, setSupplier] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [month, setMonth] = useState(ALL);
  const [dupFilter, setDupFilter] = useState<DupFilter>("all");
  const [pageSize, setPageSize] = useState(100);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [asc, setAsc] = useState(false);
  const [page, setPage] = useState(1);

  const suppliers = useMemo(
    () => [...new Set(records.map((r) => r.supplier).filter(Boolean))].sort(),
    [records],
  );
  const categories = useMemo(
    () => [...new Set(records.map((r) => r.category).filter(Boolean))].sort(),
    [records],
  );
  const months = useMemo(
    () =>
      [...new Set(records.map((r) => (r.orderDate || r.payoutDate).slice(0, 7)).filter(Boolean))]
        .sort()
        .reverse(),
    [records],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = records.filter((r) => {
      if (supplier !== ALL && r.supplier !== supplier) return false;
      if (category !== ALL && r.category !== category) return false;
      if (month !== ALL && !(r.orderDate || r.payoutDate).startsWith(month)) return false;
      if (dupFilter === "unique" && r.isDuplicate) return false;
      if (dupFilter === "duplicates" && !r.isDuplicate) return false;
      if (!q) return true;
      return [r.productName, r.orderNumber, r.supplier, r.category, r.sourceFile]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
    out.sort((a, b) => {
      const v =
        sortKey === "date"
          ? (a.orderDate || a.payoutDate).localeCompare(b.orderDate || b.payoutDate)
          : (a.gbpAmount ?? 0) - (b.gbpAmount ?? 0);
      return asc ? v : -v;
    });
    return out;
  }, [records, query, supplier, category, month, dupFilter, sortKey, asc]);

  const duplicateCount = useMemo(() => records.filter((r) => r.isDuplicate).length, [records]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * pageSize, current * pageSize);

  const money = (v: number | null, cur: "£" | "$") =>
    v == null
      ? ""
      : `${cur}${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <section className="mx-auto w-full max-w-[98%] 2xl:max-w-[1720px] px-2 sm:px-4 lg:px-6">
      <div className="rounded-3xl border border-border bg-card shadow-soft">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:p-5 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search product, order or supplier…"
              className="h-10 rounded-xl pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <FilterSelect
              value={supplier}
              onChange={(v) => {
                setSupplier(v);
                setPage(1);
              }}
              label="Supplier"
              plural="All suppliers"
              options={suppliers}
            />
            <FilterSelect
              value={category}
              onChange={(v) => {
                setCategory(v);
                setPage(1);
              }}
              label="Category"
              plural="All categories"
              options={categories}
            />
            <FilterSelect
              value={month}
              onChange={(v) => {
                setMonth(v);
                setPage(1);
              }}
              label="Date"
              plural="All dates"
              options={months}
            />
            <Select
              value={dupFilter}
              onValueChange={(v) => {
                setDupFilter(v as DupFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder="Duplicates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All orders ({records.length})</SelectItem>
                <SelectItem value="unique">
                  Unique only ({records.length - duplicateCount})
                </SelectItem>
                <SelectItem value="duplicates">Duplicates only ({duplicateCount})</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder="Rows" />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} rows
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={() => {
                if (sortKey === "date") setAsc((a) => !a);
                setSortKey((k) => (k === "date" ? "amount" : "date"));
              }}
            >
              <ArrowUpDown className="mr-1.5 h-3.5 w-3.5" />
              {sortKey === "date" ? "Date" : "Amount"}
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface">
              <Inbox className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-4 font-display text-xl">
              {records.length === 0 ? "No payout records yet" : "Nothing matches those filters"}
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {records.length === 0
                ? "Upload your payout PDFs above and your master data will appear here."
                : "Try clearing the search or filters."}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile View: Clean Responsive Cards (< md) */}
            <div className="block md:hidden p-3 sm:p-4 space-y-3">
              {rows.map((r, i) => (
                <PayoutMobileCard
                  key={r.id}
                  record={r}
                  index={(current - 1) * pageSize + i}
                  avgRate={avgRate}
                />
              ))}
            </div>

            {/* Desktop / Tablet View: Complete Master Table (>= md) */}
            <div className="hidden md:block max-h-[36rem] overflow-auto rounded-b-3xl">
              <table className="w-full min-w-[1600px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur">
                  <tr className="text-left">
                    {[
                      "S NO.",
                      "DATE",
                      "CATEGORY",
                      "ORDER",
                      "STATUS",
                      "PRODUCT NAME",
                      "QTY (PCS)",
                      "WEIGHT (KGS)",
                      "VENDOR BASE PRICE",
                      "DISCOUNT",
                      "TOTAL BASE PRICE",
                      "FLEEK COMMISSION",
                      "BALANCE",
                      "GBP AMOUNT",
                      "AVG RATE",
                      "USD AMOUNT",
                      "PACKAGES",
                      "DIMENSIONS",
                      "COUNTRY",
                      "SUPPLIER",
                    ].map((h) => (
                      <th
                        key={h}
                        className="whitespace-nowrap border-b border-border px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={r.id}
                      className={`border-b border-border/70 transition-colors hover:bg-accent/60 ${r.isDuplicate ? "bg-accent/40" : ""}`}
                    >
                      <Td>{(current - 1) * pageSize + i + 1}</Td>
                      <Td>{r.orderDate || r.payoutDate}</Td>
                      <Td>{r.category}</Td>
                      <Td className="font-medium">{r.orderNumber}</Td>
                      <Td>
                        {r.isDuplicate ? (
                          <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            Duplicate
                          </span>
                        ) : (
                          ""
                        )}
                      </Td>
                      <Td className="max-w-[22rem] whitespace-normal">{r.productName}</Td>
                      <Td>{r.quantity ?? ""}</Td>
                      <Td>{r.weightKg ?? ""}</Td>
                      <Td className="tabular-nums">{money(r.vendorBasePrice, "£")}</Td>
                      <Td className="tabular-nums">{money(r.discount, "£")}</Td>
                      <Td className="tabular-nums">{money(r.totalBasePrice, "£")}</Td>
                      <Td className="tabular-nums">{money(r.commission, "£")}</Td>
                      <Td className="tabular-nums font-medium">{money(r.balance, "£")}</Td>
                      <Td className="tabular-nums">{money(r.gbpAmount, "£")}</Td>
                      <Td className="tabular-nums">{avgRate}</Td>
                      <Td className="tabular-nums">
                        {r.gbpAmount == null ? "" : money(+(r.gbpAmount * avgRate).toFixed(2), "$")}
                      </Td>
                      <Td>{r.packages ?? ""}</Td>
                      <Td>{r.dimensions}</Td>
                      <Td>{r.country}</Td>
                      <Td className="text-muted-foreground">{r.supplier}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-border p-4">
            <p className="text-xs text-muted-foreground">
              Showing {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, filtered.length)}{" "}
              of {filtered.length}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                disabled={current === 1}
                onClick={() => setPage(current - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                disabled={current === pages}
                onClick={() => setPage(current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-3 py-2.5 align-middle ${className}`}>{children}</td>;
}

function FilterSelect({
  value,
  onChange,
  label,
  plural,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  plural: string;
  options: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10 rounded-xl">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{plural}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
