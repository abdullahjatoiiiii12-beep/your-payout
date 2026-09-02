import { useState, useEffect, useCallback } from "react";
import type { AnalyticsPeriod, CurrencyCode, PayoutAnalyticsResult } from "./analytics";
import { calculatePayoutAnalytics } from "./analytics";
import { loadRecords, loadSettings } from "./store";

export function useDashboardPayouts(
  initialPeriod: AnalyticsPeriod = "30d",
  initialCurrency: CurrencyCode = "usd",
) {
  const [period, setPeriod] = useState<AnalyticsPeriod>(initialPeriod);
  const [currency, setCurrency] = useState<CurrencyCode>(initialCurrency);
  const [data, setData] = useState<PayoutAnalyticsResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(
    async (targetPeriod = period, targetCurrency = currency) => {
      setIsLoading(true);
      setIsError(false);
      setError(null);

      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Karachi";

      try {
        const res = await fetch(
          `/api/dashboard/payouts?period=${targetPeriod}&currency=${targetCurrency}&tz=${encodeURIComponent(userTz)}`,
        );

        if (res.ok) {
          const result = (await res.json()) as PayoutAnalyticsResult;
          setData(result);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.warn("Backend analytics fetch failed, trying local fallback:", err);
      }

      // Fallback: calculate from client-side stored records
      try {
        const [records, settings] = await Promise.all([loadRecords(), loadSettings()]);
        const calculated = calculatePayoutAnalytics(
          records,
          targetPeriod,
          settings.avgRate,
          targetCurrency,
          userTz,
        );
        setData(calculated);
        setIsLoading(false);
      } catch (err) {
        console.error("Local analytics calculation failed:", err);
        setIsError(true);
        setError("Failed to load payout analytics");
        setIsLoading(false);
      }
    },
    [period, currency],
  );

  useEffect(() => {
    void fetchAnalytics(period, currency);
  }, [fetchAnalytics, period, currency]);

  return {
    data,
    isLoading,
    isError,
    error,
    period,
    setPeriod,
    currency,
    setCurrency,
    refetch: () => fetchAnalytics(period, currency),
  };
}
