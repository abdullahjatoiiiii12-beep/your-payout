import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Download, Trash2, AlertTriangle } from "lucide-react";
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
import { Dashboard } from "@/components/payout/Dashboard";
import { Dropzone, type QueuedFile } from "@/components/payout/Dropzone";
import { ProcessingModal, STEPS } from "@/components/payout/ProcessingModal";
import { RecordsTable } from "@/components/payout/RecordsTable";
import { PayoutUploadSummary } from "@/components/payout/PayoutUploadSummary";
import { TableSkeleton } from "@/components/common/TableSkeleton";
import { TopNav } from "@/components/navigation/TopNav";
import type { ImportBatch, PayoutRecord, ProcessSummary } from "@/lib/payout/types";
import { parsePdfFile } from "@/lib/payout/parse";
import {
  clearAll,
  getCachedRecords,
  loadBatches,
  loadRecords,
  loadSettings,
  saveBatches,
  saveRecords,
  saveSettings,
  processAndMatchPayouts,
  DEFAULT_SETTINGS,
} from "@/lib/payout/store";
import { downloadExcel } from "@/lib/payout/excel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Payout PDF to Excel — Master Payout Manager" },
      {
        name: "description",
        content:
          "Upload multiple payout PDFs, auto-extract every order and keep one persistent master dataset you can export to a formatted Excel workbook.",
      },
      { property: "og:title", content: "Payout PDF to Excel — Master Payout Manager" },
      {
        property: "og:description",
        content:
          "Turn payout PDFs into your perfect Excel: automatic extraction, duplicate protection and persistent master data.",
      },
    ],
  }),
  component: Index,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Index() {
  const initialRecords = getCachedRecords();
  const [records, setRecords] = useState<PayoutRecord[]>(initialRecords);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [avgRate, setAvgRate] = useState(DEFAULT_SETTINGS.avgRate);
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<ProcessSummary | null>(null);
  const [ready, setReady] = useState(initialRecords.length > 0);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [r, b, s] = await Promise.all([loadRecords(), loadBatches(), loadSettings()]);
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

  const totals = useMemo(() => {
    const gbp = records.reduce((s, r) => s + (r.gbpAmount ?? 0), 0);
    return {
      records: records.length,
      gbp,
      usd: gbp * avgRate,
      quantity: records.reduce((s, r) => s + (r.quantity ?? 0), 0),
      packages: records.reduce((s, r) => s + (r.packages ?? 0), 0),
      vendorBasePrice: records.reduce((s, r) => s + (r.vendorBasePrice ?? 0), 0),
      discount: records.reduce((s, r) => s + (r.discount ?? 0), 0),
      totalBasePrice: records.reduce((s, r) => s + (r.totalBasePrice ?? 0), 0),
      commission: records.reduce((s, r) => s + (r.commission ?? 0), 0),
      balance: records.reduce((s, r) => s + (r.balance ?? 0), 0),
      pdfs: new Set(records.map((r) => r.sourceFile)).size,
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
    setProgress(4);

    const extracted: Omit<PayoutRecord, "importedAt">[] = [];
    const fileErrors: ProcessSummary["fileErrors"] = [];

    for (let i = 0; i < queued.length; i++) {
      const qf = queued[i]!;
      setFiles((prev) => prev.map((f) => (f.id === qf.id ? { ...f, status: "processing" } : f)));
      try {
        const recs = await parsePdfFile(qf.file);
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
      setStep(i === 0 ? 1 : 1);
      setProgress(6 + ((i + 1) / queued.length) * 54);
      await sleep(30);
    }

    setStep(2);
    setProgress(55);
    await sleep(150);

    // Deduplicate across this batch and against the existing master dataset.
    setStep(3);
    setProgress(70);
    // Every order in the PDF is imported. Repeats are flagged as duplicates so
    // they stay visible and filterable instead of being thrown away.
    const seen = new Set(records.map((r) => r.dupKey));
    const fresh: PayoutRecord[] = [];
    let duplicates = 0;
    const nowIso = new Date().toISOString();
    const importedAt = nowIso;
    const payout_uploaded_at = nowIso;
    const payout_processed_at = nowIso;

    for (const rec of extracted) {
      const isDuplicate = seen.has(rec.dupKey);
      if (isDuplicate) duplicates++;
      seen.add(rec.dupKey);
      fresh.push({
        ...rec,
        isDuplicate,
        importedAt,
        payout_uploaded_at,
        payout_processed_at,
      });
    }
    await sleep(150);

    setStep(4);
    setProgress(85);
    // Prepare batch
    const batch: ImportBatch = {
      id: crypto.randomUUID(),
      at: importedAt,
      files: queued.map((f) => f.file.name),
      imported: fresh.length,
      duplicates,
      errors: fileErrors.length,
    };

    // Process and match with the persistent backend shipment database
    const backendResult = await processAndMatchPayouts(fresh, batch);

    // EXISTING DATA + NEW UNIQUE DATA — never replace.
    const merged = [...records, ...fresh];
    const nextBatches = [batch, ...batches];
    await Promise.all([saveRecords(merged), saveBatches(nextBatches)]);
    setRecords(merged);
    setBatches(nextBatches);
    await sleep(150);

    setStep(5);
    setProgress(97);
    await sleep(200);
    setProgress(100);
    await sleep(150);

    const matchStats = backendResult?.summary;
    setSummary({
      imported: fresh.length,
      duplicates,
      errors: fileErrors.length,
      fileErrors,
      totalPayoutOrders: matchStats?.totalPayoutOrders ?? fresh.length,
      matchedShipments: matchStats?.matchedShipments ?? 0,
      markedReceived: matchStats?.markedReceived ?? 0,
      ordersNotFound: matchStats?.ordersNotFound ?? 0,
      duplicatePayoutOrders: matchStats?.duplicatePayoutOrders ?? duplicates,
      unmatchedOrders: matchStats?.unmatchedOrders ?? [],
    });
    setBusy(false);
    setFiles((prev) => prev.filter((f) => f.status === "error"));

    if (matchStats && matchStats.matchedShipments > 0) {
      toast.success(
        `Payouts processed! ${matchStats.matchedShipments} shipment orders matched (${matchStats.markedReceived} marked Received).`,
      );
    } else {
      toast.success(
        `${fresh.length} new ${fresh.length === 1 ? "record" : "records"} added to your master data`,
      );
    }
  }, [files, records, batches]);

  const onDownload = useCallback(async () => {
    if (!records.length) {
      toast.error("There is nothing to export yet");
      return;
    }
    try {
      await downloadExcel(records, avgRate);
      toast.success("Excel downloaded — your stored data is untouched");
    } catch {
      toast.error("Could not generate the Excel file");
    }
  }, [records, avgRate]);

  const onRateChange = useCallback((value: string) => {
    const v = parseFloat(value);
    const rate = Number.isFinite(v) && v > 0 ? v : DEFAULT_SETTINGS.avgRate;
    setAvgRate(Number.isFinite(v) ? v : DEFAULT_SETTINGS.avgRate);
    void saveSettings({ avgRate: rate });
  }, []);

  const onClear = useCallback(async () => {
    await clearAll();
    setRecords([]);
    setBatches([]);
    setFiles([]);
    setSummary(null);
    toast.success("All stored payout data cleared");
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
            Payout Management
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-5 max-w-3xl font-display text-4xl leading-[1.05] sm:text-6xl"
          >
            Turn Payout PDFs Into Your Perfect Excel
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg"
          >
            Upload multiple payout files, automatically extract your orders and keep your master
            payout data organized in one place.
          </motion.p>
        </section>

        <Dropzone
          files={files}
          onAdd={addFiles}
          onRemove={(id) => setFiles((p) => p.filter((f) => f.id !== id))}
          onProcess={process}
          busy={busy}
        />

        {/* Summary */}
        <AnimatePresence>
          {summary && <PayoutUploadSummary summary={summary} totalRecordsCount={records.length} />}
        </AnimatePresence>

        {/* Actions */}
        <section className="mx-auto mt-10 w-full max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <label htmlFor="avg-rate" className="text-sm font-medium">
                AVG RATE
              </label>
              <Input
                id="avg-rate"
                type="number"
                step="0.0001"
                min="0"
                value={avgRate}
                onChange={(e) => onRateChange(e.target.value)}
                className="h-10 w-28 rounded-xl tabular-nums"
              />
              <span className="hidden text-xs text-muted-foreground sm:inline">
                GBP → USD used in the Excel formula
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
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
                    <AlertDialogTitle>Clear all stored payout data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes all {records.length} master records and the import
                      history from this browser. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onClear} className="rounded-xl">
                      Yes, clear everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </section>

        <div className="mt-10">
          <Dashboard totals={totals} loading={!ready} />
        </div>

        <div ref={tableRef} className="mt-10 pb-32 sm:pb-24">
          {ready ? (
            <RecordsTable records={records} avgRate={avgRate} />
          ) : (
            <TableSkeleton title="Master records" rowCount={6} />
          )}
        </div>
      </div>

      <ProcessingModal open={busy} step={Math.min(step, STEPS.length - 1)} progress={progress} />
      <Toaster position="top-center" />
    </main>
  );
}
