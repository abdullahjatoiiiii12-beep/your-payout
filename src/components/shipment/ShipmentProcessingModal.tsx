import { motion, AnimatePresence } from "motion/react";
import { Check, Loader2 } from "lucide-react";

export const SHIPMENT_STEPS = [
  "Reading spreadsheets",
  "Detecting column headers",
  "Extracting orders & tracking IDs",
  "Normalizing weights & dimensions",
  "Checking duplicate shipments",
  "Syncing master fleet data",
] as const;

export function ShipmentProcessingModal({
  open,
  step,
  progress,
}: {
  open: boolean;
  step: number;
  progress: number;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-lift sm:p-8"
          >
            <h3 className="font-display text-2xl">Extracting shipment data…</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Parsing order items, weights, and tracking manifests.
            </p>

            <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-secondary">
              <motion.div
                className="h-full rounded-full bg-primary"
                animate={{ width: `${Math.round(progress)}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
            <p className="mt-2 text-right text-xs font-medium tabular-nums text-muted-foreground">
              {Math.round(progress)}%
            </p>

            <ul className="mt-5 space-y-2.5">
              {SHIPMENT_STEPS.map((label, i) => {
                const state = i < step ? "done" : i === step ? "active" : "idle";
                return (
                  <li key={label} className="flex items-center gap-3 text-sm">
                    <span
                      className={
                        "flex h-5 w-5 items-center justify-center rounded-full border transition-colors " +
                        (state === "done"
                          ? "border-foreground bg-primary text-primary-foreground"
                          : state === "active"
                            ? "border-foreground"
                            : "border-border")
                      }
                    >
                      {state === "done" && <Check className="h-3 w-3" />}
                      {state === "active" && <Loader2 className="h-3 w-3 animate-spin" />}
                    </span>
                    <span
                      className={
                        state === "idle" ? "text-muted-foreground" : "font-medium text-foreground"
                      }
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
