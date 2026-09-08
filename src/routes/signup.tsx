import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { TopNav } from "@/components/navigation/TopNav";
import { AuthForm } from "@/components/auth/AuthForm";
import { ShieldCheck, Cloud, FileSpreadsheet, Sparkles } from "lucide-react";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign Up & Register — YourPayouts" },
      {
        name: "description",
        content: "Create an account with Supabase to manage and store your payout PDFs.",
      },
      { property: "og:title", content: "Sign Up & Register — YourPayouts" },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground flex flex-col justify-between overflow-x-hidden">
      <div aria-hidden className="pointer-events-none fixed inset-0 aurora opacity-50 -z-10" />
      <div aria-hidden className="pointer-events-none fixed inset-0 grid-bg opacity-35 -z-10" />

      <TopNav />

      <main className="relative z-10 mx-auto w-full max-w-5xl px-4 pt-8 pb-32 sm:px-6 sm:pt-14 sm:pb-28 flex-1 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8 text-center"
        >
          <Link
            to="/"
            className="group inline-flex items-center gap-2.5 rounded-full border border-border/80 bg-card/80 px-4 py-1.5 text-xs font-semibold text-foreground shadow-soft backdrop-blur-md transition-all hover:bg-secondary/70 hover:shadow-xs"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <FileSpreadsheet className="h-3 w-3" />
            </div>
            <span>YourPayouts</span>
            <span className="text-muted-foreground/60">•</span>
            <span className="text-muted-foreground font-normal group-hover:text-foreground transition-colors">
              Return Home
            </span>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full flex justify-center"
        >
          <AuthForm defaultTab="signup" redirectTo="/dashboard" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-md text-center"
        >
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card/60 px-3 py-2 text-[11px] text-muted-foreground backdrop-blur-md">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Encrypted Auth</span>
          </div>
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card/60 px-3 py-2 text-[11px] text-muted-foreground backdrop-blur-md">
            <Cloud className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
            <span>Supabase Cloud</span>
          </div>
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card/60 px-3 py-2 text-[11px] text-muted-foreground backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Auto Sync</span>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
