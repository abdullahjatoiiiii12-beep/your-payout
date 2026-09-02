import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { TopNav } from "@/components/navigation/TopNav";
import { PayoutAnalyticsCard } from "@/components/dashboard/PayoutAnalyticsCard";
import { ShipmentOverviewCard } from "@/components/dashboard/ShipmentOverviewCard";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Overview & Analytics | YourPayouts" },
      {
        name: "description",
        content:
          "Monitor dynamic payout analytics and shipment delivery trends calculated directly from your master records.",
      },
      { property: "og:title", content: "Dashboard — Overview & Analytics | YourPayouts" },
      {
        property: "og:description",
        content:
          "Real-time payout analytics, shipment delivery trends, and performance metrics in YourPayouts.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Background Decorators */}
      <div className="pointer-events-none fixed inset-0 aurora opacity-40" />
      <div className="pointer-events-none fixed inset-0 grid-bg" />

      {/* Main Content Area */}
      <main className="relative z-10 mx-auto min-h-[calc(100vh-6rem)] max-w-6xl px-4 pt-8 pb-32 sm:px-6 sm:pt-12 sm:pb-28">
        {/* Page Header */}
        <div className="mb-8 text-center sm:mb-10">
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground shadow-xs backdrop-blur"
          >
            <span>Overview & Analytics</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="mt-3 font-display text-4xl sm:text-5xl leading-[1.08] font-normal tracking-tight text-foreground"
          >
            Dashboard
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground sm:text-base"
          >
            Real-time payout analytics and shipment delivery volume trends calculated from your live
            records.
          </motion.p>
        </div>

        {/* Analytics Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Payout Overview */}
          <PayoutAnalyticsCard />

          {/* Shipment Overview */}
          <ShipmentOverviewCard />
        </div>
      </main>

      <TopNav />
    </div>
  );
}
