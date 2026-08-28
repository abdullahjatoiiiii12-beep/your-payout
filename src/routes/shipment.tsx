import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Download, Trash2, AlertTriangle, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { TopNav } from "@/components/navigation/TopNav";
import { ShipmentDashboard } from "@/components/shipment/ShipmentDashboard";
import { ShipmentDropzone, type QueuedShipmentFile } from "@/components/shipment/ShipmentDropzone";
import {
  ShipmentProcessingModal,
  SHIPMENT_STEPS,
} from "@/components/shipment/ShipmentProcessingModal";
import { ShipmentTable } from "@/components/shipment/ShipmentTable";
import { TableSkeleton } from "@/components/common/TableSkeleton";
import type {
  ShipmentBatch,
  ShipmentProcessSummary,
  ShipmentRecord,
  ShipmentTotals,
} from "@/lib/shipment/types";
import { parseShipmentFile } from "@/lib/shipment/parse";
import {
  clearAllShipmentData,
  getCachedShipmentRecords,
  loadShipmentBatches,
  loadShipmentRecords,
  loadShipmentSettings,
  saveShipmentBatches,
  saveShipmentRecords,
  saveShipmentSettings,
  DEFAULT_SHIPMENT_SETTINGS,
} from "@/lib/shipment/store";
import { downloadSampleShipmentTemplate, downloadShipmentExcel } from "@/lib/shipment/excel";

export const Route = createFileRoute("/shipment")({
  head: () => ({
    meta: [
      { title: "Shipment & Order Extraction — Master Logistics Manager" },
      {
        name: "description",
        content:
          "Upload shipping spreadsheets (.xlsx, .xls, .csv), auto-extract tracking IDs and packages, and maintain a master shipment dataset with Excel export.",
      },
      { property: "og:title", content: "Shipment & Order Extraction — Master Logistics Manager" },
      {
        property: "og:description",
        content:
          "Extract shipments, tracking numbers, weights, and orders into a master logistics workbook.",
      },
    ],
  }),
  component: ShipmentPage,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ShipmentPage() {
  const initialRecords = getCachedShipmentRecords();
  const [records, setRecords] = useState<ShipmentRecord[]>(initialRecords);
  const [batches, setBatches] = useState<ShipmentBatch[]>([]);
  const [avgRate, setAvgRate] = useState(DEFAULT_SHIPMENT_SETTINGS.avgRate);
  const [files, setFiles] = useState<QueuedShipmentFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<ShipmentProcessSummary | null>(null);
  const [ready, setReady] = useState(initialRecords.length > 0);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [r, b, s] = await Promise.all([
        loadShipmentRecords(true),
        loadShipmentBatches(),
        loadShipmentSettings(),
      ]);
      if (!active) return;
      setRecords(r);
      setBatches(b);
      setAvgRate(s.avgRate);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo<ShipmentTotals>(() => {
    const costGbp = records.reduce((s, r) => s + (r.shippingCost ?? 0), 0);
    return {
      totalRecords: records.length,
      totalPackages: records.reduce((s, r) => s + (r.packages ?? 0), 0),
      totalWeightKg: records.reduce((s, r) => s + (r.weightKg ?? 0), 0),
      totalShippingCostGbp: costGbp,
      totalShippingCostUsd: costGbp * avgRate,
      totalQuantity: records.reduce((s, r) => s + (r.quantity ?? 0), 0),
      totalDeclaredValue: records.reduce((s, r) => s + (r.declaredValue ?? 0), 0),
      deliveredCount: records.filter((r) => r.status === "Delivered").length,
      receivedCount: records.filter((r) => r.status === "Received").length,
      inTransitCount: records.filter((r) => r.status === "In Transit" || r.status === "Dispatched")
        .length,
      uniqueCarriers: new Set(records.map((r) => r.carrier).filter(Boolean)).size,
      uniqueCountries: new Set(records.map((r) => r.destinationCountry).filter(Boolean)).size,
      uniqueSuppliers: new Set(records.map((r) => r.supplier).filter(Boolean)).size,
      filesImported: new Set(records.map((r) => r.sourceFile)).size,
      lastUpdated: batches[0]?.at ?? null,
    };
  }, [records, avgRate, batches]);

  const addFiles = useCallback((incoming: File[]) => {
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.file.name}:${f.file.size}`));
      const next = incoming
        .filter((f) => !existing.has(`${f.name}:${f.size}`))
        .map((file) => ({ id: crypto.randomUUID(), file, status: "queued" as const }));
      return [...prev, ...next];
    });
  }, []);

  const process = useCallback(async () => {
    const queued = files.filter((f) => f.status === "queued");
    if (!queued.length) return;
    setBusy(true);
    setSummary(null);
    setStep(0);
    setProgress(5);

    const extracted: Omit<ShipmentRecord, "importedAt" | "isDuplicate">[] = [];
    const fileErrors: ShipmentProcessSummary["fileErrors"] = [];

    for (let i = 0; i < queued.length; i++) {
      const qf = queued[i]!;
      setFiles((prev) => prev.map((f) => (f.id === qf.id ? { ...f, status: "processing" } : f)));
      try {
        const recs = await parseShipmentFile(qf.file);
        extracted.push(...recs);
        setFiles((prev) =>
          prev.map((f) => (f.id === qf.id ? { ...f, status: "done", records: recs.length } : f)),
        );
      } catch (err) {
        const reason = err instanceof Error ? err.message : "Unknown error";
        fileErrors.push({ file: qf.file.name, reason });
        setFiles((prev) =>
          prev.map((f) => (f.id === qf.id ? { ...f, status: "error", message: reason } : f)),
        );
      }
      setStep(1);
      setProgress(10 + ((i + 1) / queued.length) * 50);
      await sleep(40);
    }

    setStep(2);
    setProgress(65);
    await sleep(220);

    // Deduplicate against existing master dataset
    setStep(3);
    setProgress(75);
    const seen = new Set(records.map((r) => r.dupKey));
    const fresh: ShipmentRecord[] = [];
    let duplicates = 0;
    const importedAt = new Date().toISOString();

    for (const rec of extracted) {
      const isDuplicate = seen.has(rec.dupKey);
      if (isDuplicate) duplicates++;
      seen.add(rec.dupKey);
      fresh.push({ ...rec, isDuplicate, importedAt });
    }
    await sleep(200);

    setStep(4);
    setProgress(85);
    const merged = [...records, ...fresh];
    const batch: ShipmentBatch = {
      id: crypto.randomUUID(),
      at: importedAt,
      files: queued.map((f) => f.file.name),
      imported: fresh.length,
      duplicates,
      errors: fileErrors.length,
    };
    const nextBatches = [batch, ...batches];
    await Promise.all([saveShipmentRecords(merged), saveShipmentBatches(nextBatches)]);
    setRecords(merged);
    setBatches(nextBatches);
    await sleep(200);

    setStep(5);
    setProgress(96);
    await sleep(250);
    setProgress(100);
    await sleep(150);

    setSummary({ imported: fresh.length, duplicates, errors: fileErrors.length, fileErrors });
    setBusy(false);
    setFiles((prev) => prev.filter((f) => f.status === "error"));
    toast.success(
      `${fresh.length} new ${fresh.length === 1 ? "shipment" : "shipments"} added to master fleet data`,
    );
  }, [files, records, batches]);

  const onDownload = useCallback(async () => {
    if (!records.length) {
      toast.error("There are no shipments to export yet");
      return;
    }
    try {
      await downloadShipmentExcel(records, avgRate);
      toast.success("Shipment Master Excel downloaded successfully");
    } catch {
      toast.error("Could not generate the Shipment Excel file");
    }
  }, [records, avgRate]);

  const onDownloadSample = useCallback(async () => {
    try {
      await downloadSampleShipmentTemplate();
      toast.success("Sample shipment template downloaded");
    } catch {
      toast.error("Could not download sample template");
    }
  }, []);

  const onRateChange = useCallback((value: string) => {
    const v = parseFloat(value);
    const rate = Number.isFinite(v) && v > 0 ? v : DEFAULT_SHIPMENT_SETTINGS.avgRate;
    setAvgRate(Number.isFinite(v) ? v : DEFAULT_SHIPMENT_SETTINGS.avgRate);
    void saveShipmentSettings({ avgRate: rate });
  }, []);

  const onClear = useCallback(async () => {
    await clearAllShipmentData();
    setRecords([]);
    setBatches([]);
    setFiles([]);
    setSummary(null);
    toast.success("All stored shipment data cleared");
  }, []);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[46rem] aurora" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[46rem] grid-bg" />

      <div className="relative pt-6">
        <TopNav />

        {/* Hero */}
        <section className="mx-auto w-full max-w-4xl px-4 pb-10 pt-10 text-center sm:px-6 sm:pt-14">
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground shadow-soft"
          >
            Shipment Management
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-5 max-w-3xl font-display text-4xl leading-[1.05] sm:text-6xl"
          >
            Turn Shipment Excels Into Your Master Fleet
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg"
          >
            Upload manifests and dispatch spreadsheets (.xlsx, .csv), auto-extract tracking numbers
            and parcel weights, and keep your logistics master data in sync.
          </motion.p>
        </section>

        {/* Dropzone */}
        <ShipmentDropzone
          files={files}
          onAdd={addFiles}
          onRemove={(id) => setFiles((p) => p.filter((f) => f.id !== id))}
          onProcess={process}
          busy={busy}
        />

        {/* Summary Card */}
        <AnimatePresence>
          {summary && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-auto mt-6 w-full max-w-4xl px-4 sm:px-6"
            >
              <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Imported Shipments", summary.imported],
                    ["Total Master Fleet", records.length],
                    ["Duplicates Flagged", summary.duplicates],
                    ["File Errors", summary.errors],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {label}
                      </p>
                      <p className="font-display text-2xl tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>
                {summary.fileErrors.length > 0 && (
                  <ul className="mt-4 space-y-2 border-t border-border pt-3">
                    {summary.fileErrors.map((e) => (
                      <li key={e.file} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        <span>
                          <span className="font-medium">Could not process this file:</span> {e.file}{" "}
                          — {e.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions Bar */}
        <section className="mx-auto mt-10 w-full max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <label htmlFor="shipment-avg-rate" className="text-sm font-medium">
                AVG RATE
              </label>
              <Input
                id="shipment-avg-rate"
                type="number"
                step="0.0001"
                min="0"
                value={avgRate}
                onChange={(e) => onRateChange(e.target.value)}
                className="h-10 w-28 rounded-xl tabular-nums"
              />
              <span className="hidden text-xs text-muted-foreground sm:inline">
                GBP → USD currency multiplier for freight calculations
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="lg"
                onClick={onDownloadSample}
                className="h-11 rounded-xl px-4 text-xs font-medium"
                title="Download a formatted sample shipment Excel template"
              >
                <FileDown className="mr-1.5 h-4 w-4" />
                Sample Template
              </Button>
              <Button
                onClick={onDownload}
                size="lg"
                className="h-11 rounded-xl px-6 font-semibold transition-transform duration-200 hover:-translate-y-0.5"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Excel
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="lg" className="h-11 rounded-xl px-5">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear All Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all stored shipment fleet data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes all {records.length} shipment records and batch logs
                      from your local storage. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onClear} className="rounded-xl">
                      Yes, clear shipments
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </section>

        {/* Dashboard KPIs */}
        <div className="mt-10">
          <ShipmentDashboard totals={totals} loading={!ready} />
        </div>

        {/* Master Table */}
        <div ref={tableRef} className="mt-10 pb-32 sm:pb-24">
          {ready ? (
            <ShipmentTable records={records} avgRate={avgRate} />
          ) : (
            <TableSkeleton
              title="Shipments master fleet"
              columns={[
                "S NO.",
                "DATE",
                "STATUS",
                "ORDER NO.",
                "PRODUCT / CARGO",
                "QTY",
                "PKGS",
                "WEIGHT (KG)",
                "DIMENSIONS",
                "DESTINATION",
              ]}
              rowCount={6}
            />
          )}
        </div>
      </div>

      <ShipmentProcessingModal
        open={busy}
        step={Math.min(step, SHIPMENT_STEPS.length - 1)}
        progress={progress}
      />
      <Toaster position="top-center" />
    </main>
  );
}
