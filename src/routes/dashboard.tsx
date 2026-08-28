import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { TopNav } from "@/components/navigation/TopNav";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Coming Soon | YourPayouts" },
      {
        name: "description",
        content:
          "Your centralized executive dashboard is currently under development. Monitor and manage payouts, shipments, and logistics in one unified command center.",
      },
      { property: "og:title", content: "Dashboard — Coming Soon | YourPayouts" },
      {
        property: "og:description",
        content: "Unified metrics and cross-system overview coming soon to YourPayouts Engine.",
      },
    ],
  }),
  component: DashboardComingSoon,
});

function DashboardComingSoon() {
  return (
    <div className="relative min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Background Decorators */}
      <div className="pointer-events-none fixed inset-0 aurora opacity-40" />
      <div className="pointer-events-none fixed inset-0 grid-bg" />

      <TopNav />

      {/* Main Content Area */}
      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-8rem)] max-w-6xl flex-col items-center justify-center px-4 pt-6 pb-32 sm:px-6 sm:pt-8 sm:pb-24">
        <div className="w-full max-w-2xl text-center">
          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-4xl leading-[1.08] sm:text-6xl"
          >
            Coming Soon
          </motion.h1>

          {/* Supporting Copy */}
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-4 max-w-lg text-base text-muted-foreground sm:text-lg"
          >
            Your dashboard is currently under development. We're working on something powerful to
            help you monitor and manage everything in one place.
          </motion.p>
        </div>
      </main>
    </div>
  );
}
