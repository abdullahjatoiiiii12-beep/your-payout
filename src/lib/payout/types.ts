export interface PayoutRecord {
  id: string;
  /** Identity of the underlying order (supplier + order number) — used to flag duplicates. */
  dupKey: string;
  /** True when this row repeats an order already present in the master dataset. */
  isDuplicate: boolean;
  supplier: string;
  payoutDate: string;
  payoutRef: string;
  orderDate: string;
  orderNumber: string;
  productName: string;
  category: string;
  quantity: number | null;
  weightKg: number | null;
  gbpAmount: number | null;
  basePrice: number | null;
  commission: number | null;
  discount: number | null;
  /** Per-order financial breakdown taken directly from the payout PDF. */
  vendorBasePrice: number | null;
  totalBasePrice: number | null;
  balance: number | null;
  shipping: number | null;
  packages: number | null;
  dimensions: string;
  country: string;
  sourceFile: string;
  importedAt: string;
  /** Exact ISO timestamp when payout order was uploaded/processed in system */
  payout_uploaded_at?: string;
  payout_processed_at?: string;
}

export interface ImportBatch {
  id: string;
  at: string;
  files: string[];
  imported: number;
  duplicates: number;
  errors: number;
}

export interface FileError {
  file: string;
  reason: string;
}

export interface UnmatchedOrder {
  orderNumber: string;
  result: string;
}

export interface ProcessSummary {
  imported: number;
  duplicates: number;
  errors: number;
  fileErrors: FileError[];
  totalPayoutOrders?: number;
  matchedShipments?: number;
  markedReceived?: number;
  ordersNotFound?: number;
  duplicatePayoutOrders?: number;
  unmatchedOrders?: UnmatchedOrder[];
}
