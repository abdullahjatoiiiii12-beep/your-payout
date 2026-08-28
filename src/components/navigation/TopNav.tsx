import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import { FileSpreadsheet, Truck, LayoutDashboard } from "lucide-react";

export function TopNav() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const isDashboard = currentPath.startsWith("/dashboard");
  const isShipment = currentPath.startsWith("/shipment");
  const isPayouts = !isDashboard && !isShipment;

  const navItems = [
    {
      to: "/" as const,
      label: "Payouts",
      icon: FileSpreadsheet,
      isActive: isPayouts,
    },
    {
      to: "/shipment" as const,
      label: "Shipments",
      icon: Truck,
      isActive: isShipment,
    },
    {
      to: "/dashboard" as const,
      label: "Dashboard",
      icon: LayoutDashboard,
      isActive: isDashboard,
    },
  ];

  return (
    <nav
      aria-label="Bottom Navigation"
      className="fixed inset-x-0 bottom-3 sm:bottom-5 z-50 flex flex-col items-center pointer-events-none px-4 pb-[env(safe-area-inset-bottom)]"
    >
      {/* Floating Capsule Bar */}
      <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 rounded-full border border-border/80 bg-card/95 p-1.5 sm:p-2 shadow-[0_14px_40px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all hover:shadow-[0_16px_48px_rgba(0,0,0,0.22)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              preload="intent"
              className={`relative flex min-h-[42px] sm:min-h-[44px] items-center justify-center rounded-full transition-all duration-300 active:scale-95 ${
                item.isActive
                  ? "bg-primary text-primary-foreground px-4 sm:px-5 shadow-sm"
                  : "px-3 sm:px-4 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              <div className="flex items-center gap-2 text-xs sm:text-sm font-medium tracking-wide">
                <Icon className="h-4 w-4 shrink-0 sm:h-4.5 sm:w-4.5" />
                {item.isActive && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="whitespace-nowrap overflow-hidden font-semibold"
                  >
                    {item.label}
                  </motion.span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Subtle Home Indicator / Dock Anchor on small screens */}
      <div className="mt-1.5 h-1 w-20 sm:w-24 rounded-full bg-muted-foreground/20 transition-opacity" />
    </nav>
  );
}
