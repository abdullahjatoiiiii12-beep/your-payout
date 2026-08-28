import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Truck,
  ArrowRight,
  PackageCheck,
  HelpCircle,
  Copy,
  Check,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import type { ProcessSummary } from "@/lib/payout/types";

interface PayoutUploadSummaryProps {
  summary: ProcessSummary;
  totalRecordsCount: number;
}

export function PayoutUploadSummary({ summary, totalRecordsCount }: PayoutUploadSummaryProps) {
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [copiedOrder, setCopiedOrder] = useState<string | null>(null);

  const totalPayoutOrders = summary.totalPayoutOrders ?? summary.imported;
  const matchedShipments = summary.matchedShipments ?? 0;
  const markedReceived = summary.markedReceived ?? 0;
  const ordersNotFound = summary.ordersNotFound ?? 0;
  const duplicatePayoutOrders = summary.duplicatePayoutOrders ?? summary.duplicates;
  const unmatchedOrders = summary.unmatchedOrders ?? [];

  const handleCopy = (orderNo: string) => {
    navigator.clipboard.writeText(orderNo);
    setCopiedOrder(orderNo);
    setTimeout(() => setCopiedOrder(null), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="mx-auto mt-6 w-full max-w-4xl px-4 sm:px-6"
    >
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <PackageCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold text-foreground">
                Payout Upload Completed
              </h3>
              <p className="text-xs text-muted-foreground">
                Matched against shipment fleet database &amp; updated statuses
              </p>
            </div>
          </div>
          {matchedShipments > 0 && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 rounded-xl border-border bg-surface px-3 text-xs font-semibold hover:bg-card"
            >
              <Link to="/shipment" preload="intent">
                <Truck className="mr-1.5 h-3.5 w-3.5 text-primary" />
                View Updated Shipments
                <ArrowRight className="ml-1 h-3 w-3 opacity-60" />
              </Link>
            </Button>
          )}
        </div>

        {/* 5-Metric KPI Summary */}
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-2xl border border-border/60 bg-surface/70 p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Total Payout Orders
            </p>
            <p className="mt-1 font-display text-2xl tabular-nums text-foreground">
              {totalPayoutOrders}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400">
              Shipments Matched
            </p>
            <p className="mt-1 font-display text-2xl tabular-nums text-emerald-600 dark:text-emerald-400">
              {matchedShipments}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400">
              Marked Received
            </p>
            <p className="mt-1 font-display text-2xl tabular-nums text-emerald-600 dark:text-emerald-400">
              {markedReceived}
            </p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-surface/70 p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Orders Not Found
            </p>
            <p className="mt-1 font-display text-2xl tabular-nums text-foreground">
              {ordersNotFound}
            </p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-surface/70 p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Duplicate Payouts
            </p>
            <p className="mt-1 font-display text-2xl tabular-nums text-foreground">
              {duplicatePayoutOrders}
            </p>
          </div>
        </div>

        {/* Unmatched Orders Details Section */}
        {unmatchedOrders.length > 0 && (
          <div className="mt-5 rounded-2xl border border-border/70 bg-surface/50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">
                  Orders Not Found in Shipments
                </span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {unmatchedOrders.length} {unmatchedOrders.length === 1 ? "order" : "orders"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUnmatched(!showUnmatched)}
                className="h-8 rounded-lg px-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                {showUnmatched ? (
                  <>
                    Hide Details <ChevronUp className="ml-1 h-3.5 w-3.5" />
                  </>
                ) : (
                  <>
                    View Details <ChevronDown className="ml-1 h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              These orders are saved in your Payout records, but no corresponding order number was
              found in the Shipment database.
            </p>

            <AnimatePresence>
              {showUnmatched && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-3 overflow-hidden"
                >
                  <div className="max-h-60 overflow-y-auto rounded-xl border border-border/80 bg-card">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 border-b border-border/80 bg-secondary/90 backdrop-blur-sm">
                        <tr>
                          <th className="px-3.5 py-2 font-semibold text-muted-foreground">
                            Order No.
                          </th>
                          <th className="px-3.5 py-2 font-semibold text-muted-foreground">
                            Result
                          </th>
                          <th className="px-3.5 py-2 text-right font-semibold text-muted-foreground">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {unmatchedOrders.map((item, idx) => (
                          <tr key={`${item.orderNumber}-${idx}`} className="hover:bg-surface/60">
                            <td className="px-3.5 py-2.5 font-mono font-medium text-foreground">
                              {item.orderNumber}
                            </td>
                            <td className="px-3.5 py-2.5">
                              <span className="inline-flex items-center rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                                {item.result}
                              </span>
                            </td>
                            <td className="px-3.5 py-2.5 text-right">
                              <button
                                onClick={() => handleCopy(item.orderNumber)}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                              >
                                {copiedOrder === item.orderNumber ? (
                                  <>
                                    <Check className="h-3 w-3 text-emerald-600" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3" />
                                    Copy
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* File Errors List */}
        {summary.fileErrors.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-border pt-3">
            {summary.fileErrors.map((e) => (
              <li key={e.file} className="flex items-start gap-2 text-xs">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <span>
                  <span className="font-medium text-foreground">Could not process:</span> {e.file} —{" "}
                  {e.reason}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}
