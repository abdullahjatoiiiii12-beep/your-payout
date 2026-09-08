import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, FileText, CheckCircle2, ChevronDown, Package } from "lucide-react";
import { TopNav } from "@/components/navigation/TopNav";
import { RecordsTable } from "@/components/payout/RecordsTable";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PayoutRecord } from "@/lib/payout/types";
import { loadRecords, loadSettings, DEFAULT_SETTINGS } from "@/lib/payout/store";

export const Route = createFileRoute("/payout-details")({
  head: () => ({
    meta: [
      { title: "Payout Details & Orders | YourPayouts" },
      {
        name: "description",
        content: "View orders and detailed item breakdown for your uploaded payout statement.",
      },
      { property: "og:title", content: "Payout Details & Orders | YourPayouts" },
    ],
  }),
  component: PayoutDetailsPage,
});

function PayoutDetailsPage() {
  const [records, setRecords] = useState<PayoutRecord[]>([]);
  const [avgRate, setAvgRate] = useState(DEFAULT_SETTINGS.avgRate);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isOrdersVisible, setIsOrdersVisible] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [loadedRecords, settings] = await Promise.all([loadRecords(), loadSettings()]);
        if (!active) return;
        setRecords(loadedRecords);
        if (settings?.avgRate) {
          setAvgRate(settings.avgRate);
        }
        // Auto-select first payout file if available
        const files = Array.from(new Set(loadedRecords.map((r) => r.sourceFile).filter(Boolean)));
        if (files.length > 0) {
          setSelectedFile(files[0]!);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Group records by payout source file
  const fileGroups = useMemo(() => {
    const map = new Map<string, PayoutRecord[]>();
    for (const r of records) {
      const fn = r.sourceFile || "Payout Statement";
      if (!map.has(fn)) map.set(fn, []);
      map.get(fn)!.push(r);
    }
    return map;
  }, [records]);

  const fileNames = useMemo(() => Array.from(fileGroups.keys()), [fileGroups]);

  // Selected file's orders
  const activeFileName = selectedFile || fileNames[0] || null;
  const activeOrders = useMemo(() => {
    if (!activeFileName) return [];
    return fileGroups.get(activeFileName) || [];
  }, [activeFileName, fileGroups]);

  const activeGbp = useMemo(() => {
    return activeOrders.reduce((sum, r) => sum + (r.gbpAmount ?? 0), 0);
  }, [activeOrders]);

  const handleCardClick = (fileName: string) => {
    if (selectedFile === fileName) {
      // Toggle orders view on clicking already selected card
      setIsOrdersVisible((prev) => !prev);
    } else {
      setSelectedFile(fileName);
      setIsOrdersVisible(true);
    }
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Background Decorators */}
      <div className="pointer-events-none fixed inset-0 aurora opacity-40" />
      <div className="pointer-events-none fixed inset-0 grid-bg" />

      {/* Main Content Area */}
      <main className="relative z-10 mx-auto min-h-[calc(100vh-6rem)] max-w-6xl px-4 pt-8 pb-32 sm:px-6 sm:pt-10 sm:pb-28">
        {/* Navigation Breadcrumb / Back Link */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/80 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-xs backdrop-blur transition-colors hover:text-foreground hover:bg-secondary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Dashboard</span>
          </Link>
          <Link
            to="/"
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Open Uploader &rarr;
          </Link>
        </div>

        {/* Page Header */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground shadow-xs backdrop-blur"
          >
            <FileText className="h-3.5 w-3.5 text-primary" />
            <span>Payout Inspection</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="mt-2.5 font-display text-3xl sm:text-4xl leading-tight font-normal tracking-tight text-foreground"
          >
            Payout Details
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mt-1.5 text-sm text-muted-foreground sm:text-base"
          >
            Click on the payout card below to view all orders extracted from that statement.
          </motion.p>
        </div>

        {loading ? (
          <div className="mx-auto max-w-md">
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
        ) : fileNames.length === 0 ? (
          /* Empty State */
          <div className="rounded-3xl border border-dashed border-border/90 bg-card/50 p-10 text-center shadow-soft">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <Package className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-display text-xl font-normal text-foreground">
              No payout files imported
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Please upload a payout statement PDF first to view and analyze its orders.
            </p>
            <div className="mt-6">
              <Link to="/">
                <Button className="rounded-full px-6 text-sm font-semibold">
                  Upload Payout PDF
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div>
            {/* Single KPI Card Section (or one card per payout file if multiple exist) */}
            <div className="mb-8">
              <div
                className={`grid gap-4 ${
                  fileNames.length === 1
                    ? "mx-auto max-w-lg"
                    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                }`}
              >
                {fileNames.map((fileName, idx) => {
                  const isSelected = selectedFile === fileName && isOrdersVisible;
                  const fileOrders = fileGroups.get(fileName) || [];
                  const orderCount = fileOrders.length;

                  return (
                    <motion.button
                      key={fileName}
                      id={`payout-file-kpi-card-${idx}`}
                      type="button"
                      onClick={() => handleCardClick(fileName)}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: idx * 0.05 }}
                      className={`group relative flex min-h-[120px] sm:min-h-[130px] w-full flex-col justify-between rounded-2xl border p-5 text-left shadow-soft transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? "border-primary/80 bg-primary/[0.03] ring-2 ring-primary shadow-lift"
                          : "border-border/80 bg-card hover:-translate-y-0.5 hover:border-border hover:bg-card/90"
                      }`}
                    >
                      {/* Top row: Label and Order count */}
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Payout file
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-muted-foreground group-hover:text-foreground"
                            }`}
                          >
                            {orderCount} {orderCount === 1 ? "Order" : "Orders"}
                          </span>
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                        </div>
                      </div>

                      {/* Center of card: Exact Payout File Name */}
                      <div className="my-auto flex w-full items-center justify-center py-2 text-center">
                        <p
                          title={fileName}
                          className={`font-display text-lg sm:text-xl font-medium tracking-tight break-all line-clamp-2 transition-colors ${
                            isSelected
                              ? "text-primary font-semibold"
                              : "text-foreground group-hover:text-primary"
                          }`}
                        >
                          {fileName}
                        </p>
                      </div>

                      {/* Bottom row: Click hint */}
                      <div className="flex w-full items-center justify-between text-[11px] text-muted-foreground">
                        <span>Click to {isSelected ? "collapse" : "view"} orders</span>
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform duration-200 ${
                            isSelected ? "rotate-180 text-primary" : ""
                          }`}
                        />
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Orders Table for the Clicked Payout Card */}
            <AnimatePresence mode="wait">
              {isOrdersVisible && activeFileName && (
                <motion.section
                  key={activeFileName}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-border/80 bg-card p-4 sm:px-6 shadow-xs">
                    <div>
                      <h2 className="font-display text-xl sm:text-2xl text-foreground font-normal">
                        Orders in <span className="font-medium">{activeFileName}</span>
                      </h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Displaying {activeOrders.length} extracted line-item records with financial
                        breakdown.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-xs sm:text-sm">
                      <div className="rounded-xl bg-secondary/80 px-3 py-1.5 text-muted-foreground">
                        Total GBP:{" "}
                        <span className="font-semibold text-foreground">
                          £{activeGbp.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Render the full RecordsTable component */}
                  <RecordsTable records={activeOrders} avgRate={avgRate} />
                </motion.section>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>

      <TopNav />
    </div>
  );
}
