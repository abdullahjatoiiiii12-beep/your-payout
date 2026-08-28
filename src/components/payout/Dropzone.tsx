import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FileText, UploadCloud, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FileStatus = "queued" | "processing" | "done" | "error";

export interface QueuedFile {
  id: string;
  file: File;
  status: FileStatus;
  message?: string;
  records?: number;
}

export function Dropzone({
  files,
  onAdd,
  onRemove,
  onProcess,
  busy,
}: {
  files: QueuedFile[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  onProcess: () => void;
  busy: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const pdfs = Array.from(list).filter(
        (f) => /\.pdf$/i.test(f.name) || f.type === "application/pdf",
      );
      if (pdfs.length) onAdd(pdfs);
    },
    [onAdd],
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={cn(
          "group relative cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed border-border bg-surface px-6 py-12 text-center transition-all duration-300 hover:border-foreground/40 hover:bg-accent sm:py-16",
          dragging && "scale-[1.01] border-foreground bg-accent shadow-lift",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <motion.div
          animate={{ y: dragging ? -4 : 0, scale: dragging ? 1.06 : 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-soft"
        >
          <UploadCloud className="h-6 w-6" />
        </motion.div>
        <p className="mt-5 font-display text-2xl">
          {dragging ? "Drop them right here" : "Drag & drop your payout PDFs"}
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Upload 6 or more files at once — we read each one, extract every order and merge it into
          your master data.
        </p>
        <p className="mt-4 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          or click to browse
        </p>
      </motion.div>

      <AnimatePresence initial={false}>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <AnimatePresence initial={false}>
                {files.map((f) => (
                  <motion.div
                    key={f.id}
                    layout
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.22 }}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{f.file.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {f.status === "queued" && `${(f.file.size / 1024).toFixed(0)} KB · ready`}
                        {f.status === "processing" && "Analyzing…"}
                        {f.status === "done" && `${f.records ?? 0} orders extracted`}
                        {f.status === "error" && (f.message ?? "Could not process this file")}
                      </p>
                    </div>
                    {f.status === "processing" && <Loader2 className="h-4 w-4 animate-spin" />}
                    {f.status === "done" && <CheckCircle2 className="h-4 w-4 text-success" />}
                    {f.status === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
                    {!busy && (
                      <button
                        aria-label={`Remove ${f.file.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(f.id);
                        }}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="mt-5 flex justify-center">
              <Button
                size="lg"
                disabled={busy || !files.some((f) => f.status === "queued")}
                onClick={onProcess}
                className="h-13 w-full rounded-xl px-10 py-6 text-base font-semibold shadow-lift transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 sm:w-auto"
              >
                {busy
                  ? "Processing…"
                  : `Process Payouts (${files.filter((f) => f.status === "queued").length})`}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
