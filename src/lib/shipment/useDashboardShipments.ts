import { useState, useEffect, useCallback } from "react";
import type { ShipmentRange, ShipmentAnalyticsResult } from "./analytics";
import { calculateShipmentAnalytics } from "./analytics";
import { loadShipmentRecords } from "./store";

export function useDashboardShipments(initialRange: ShipmentRange = "12d") {
  const [range, setRange] = useState<ShipmentRange>(initialRange);
  const [data, setData] = useState<ShipmentAnalyticsResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(
    async (targetRange = range) => {
      setIsLoading(true);
      setIsError(false);
      setError(null);

      try {
        const res = await fetch(`/api/dashboard/shipments?range=${targetRange}`);

        if (res.ok) {
          const result = (await res.json()) as ShipmentAnalyticsResult;
          setData(result);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.warn("Backend shipment analytics fetch failed, trying local fallback:", err);
      }

      // Fallback: calculate from client-side stored records
      try {
        const records = await loadShipmentRecords();
        const calculated = calculateShipmentAnalytics(records, targetRange);
        setData(calculated);
        setIsLoading(false);
      } catch (err) {
        console.error("Local shipment analytics calculation failed:", err);
        setIsError(true);
        setError("Failed to load shipment analytics");
        setIsLoading(false);
      }
    },
    [range],
  );

  useEffect(() => {
    void fetchAnalytics(range);
  }, [fetchAnalytics, range]);

  return {
    data,
    isLoading,
    isError,
    error,
    range,
    setRange,
    refetch: () => fetchAnalytics(range),
  };
}
