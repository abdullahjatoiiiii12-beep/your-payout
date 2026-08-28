export type ShipmentStatus =
  | "Delivered"
  | "Received"
  | "In Transit"
  | "Dispatched"
  | "Out for Delivery"
  | "Pending"
  | "Exception";

export interface ShipmentRecord {
  id: string;
  /** Unique key (e.g. trackingNumber || orderNumber + supplier + date) used to detect duplicates */
  dupKey: string;
  /** True when this row repeats an existing shipment order already in master storage */
  isDuplicate: boolean;
  trackingNumber: string;
  orderNumber: string;
  shipmentDate: string;
  deliveryDate: string;
  carrier: string;
  supplier: string;
  recipientName: string;
  destinationCity: string;
  destinationCountry: string;
  productName: string;
  category: string;
  quantity: number | null;
  packages: number | null;
  weightKg: number | null;
  dimensions: string;
  shippingCost: number | null;
  customsFee: number | null;
  declaredValue: number | null;
  currency: string;
  status: ShipmentStatus;
  notes: string;
  sourceFile: string;
  importedAt: string;
}

export interface ShipmentBatch {
  id: string;
  at: string;
  files: string[];
  imported: number;
  duplicates: number;
  errors: number;
}

export interface ShipmentFileError {
  file: string;
  reason: string;
}

export interface ShipmentProcessSummary {
  imported: number;
  duplicates: number;
  errors: number;
  fileErrors: ShipmentFileError[];
}

export interface ShipmentTotals {
  totalRecords: number;
  totalPackages: number;
  totalWeightKg: number;
  totalShippingCostGbp: number;
  totalShippingCostUsd: number;
  totalQuantity: number;
  totalDeclaredValue: number;
  deliveredCount: number;
  receivedCount: number;
  inTransitCount: number;
  uniqueCarriers: number;
  uniqueCountries: number;
  uniqueSuppliers: number;
  filesImported: number;
  lastUpdated: string | null;
}
