import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  LogOut,
  Sparkles,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/supabase/auth-context";

interface AuthFormProps {
  defaultTab?: "signin" | "signup";
  onSuccess?: () => void;
  redirectTo?: string;
  className?: string;
}

export function AuthForm({
  defaultTab = "signin",
  onSuccess,
  redirectTo = "/dashboard",
  className = "",
}: AuthFormProps) {
  const { user, signIn, signUp, signOut, resetPassword, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"signin" | "signup" | "forgot">(defaultTab);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sign In state
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  // Sign Up state
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState("");

  // Forgot password state
  const [resetEmail, setResetEmail] = useState("");

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!signInEmail || !signInPassword) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await signIn(signInEmail.trim(), signInPassword);
      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage("Signed in successfully!");
      if (onSuccess) {
        onSuccess();
      } else if (redirectTo) {
        navigate({ href: redirectTo });
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!signUpEmail || !signUpPassword) {
      setErrorMessage("Please enter an email and password.");
      return;
    }

    if (signUpPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    if (signUpPassword !== signUpConfirmPassword) {
      setErrorMessage("Passwords do not match. Please re-enter.");
      return;
    }

    setLoading(true);
    try {
      const { error, user: newUser } = await signUp(
        signUpEmail.trim(),
        signUpPassword,
        signUpName.trim(),
      );

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (newUser && !newUser.confirmed_at) {
        setSuccessMessage(
          "Account created! Please check your email to confirm your account, or sign in directly.",
        );
      } else {
        setSuccessMessage("Account created and signed in successfully!");
        if (onSuccess) {
          onSuccess();
        } else if (redirectTo) {
          navigate({ href: redirectTo });
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to create account.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!resetEmail) {
      setErrorMessage("Please enter your account email address.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await resetPassword(resetEmail.trim());
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      setSuccessMessage("Password reset link sent! Check your email inbox.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to send reset link.");
    } finally {
      setLoading(false);
    }
  };

  // If already logged in, display authenticated user card
  if (user && !authLoading) {
    const displayName =
      user.user_metadata?.full_name || user.email?.split("@")[0] || "Authenticated User";
    const initial = displayName.charAt(0).toUpperCase();

    return (
      <Card
        id="auth-authenticated-card"
        className={`w-full max-w-md border-border/80 bg-card/95 shadow-lift backdrop-blur-xl rounded-3xl p-2 sm:p-4 ${className}`}
      >
        <CardHeader className="text-center pb-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-display text-2xl shadow-sm">
            {initial}
          </div>
          <CardTitle className="mt-4 font-display text-2xl sm:text-3xl font-normal text-foreground">
            Welcome, {displayName}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Signed in with Supabase as{" "}
            <span className="font-medium text-foreground">{user.email}</span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-secondary/50 p-3.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Authenticated Session
            </span>
            <Badge
              variant="outline"
              className="rounded-full bg-background/80 text-[10px] font-semibold uppercase tracking-wider"
            >
              Active
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-2.5 pt-2">
            <Link to="/dashboard" className="w-full">
              <Button
                id="auth-go-to-dashboard-btn"
                className="w-full rounded-full py-5 text-sm font-semibold shadow-xs"
              >
                <span>Continue to Dashboard</span>
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/" className="w-full">
              <Button
                variant="outline"
                className="w-full rounded-full py-5 text-sm font-semibold border-border/80 hover:bg-secondary"
              >
                <span>Payout Uploader</span>
              </Button>
            </Link>
          </div>
        </CardContent>

        <CardFooter className="pt-2 border-t border-border/60 flex justify-center">
          <Button
            id="auth-signout-btn"
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
            className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full gap-1.5 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card
      id="auth-form-card"
      className={`w-full max-w-md border-border/80 bg-card/95 shadow-lift backdrop-blur-xl rounded-3xl p-1 sm:p-3 overflow-hidden ${className}`}
    >
      <CardHeader className="text-center pb-3 pt-6 sm:pt-7">
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-secondary/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground shadow-xs">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>Supabase Auth</span>
        </div>

        <CardTitle className="mt-3 font-display text-3xl sm:text-4xl font-normal tracking-tight text-foreground">
          {activeTab === "signup"
            ? "Create account"
            : activeTab === "forgot"
              ? "Reset password"
              : "Welcome back"}
        </CardTitle>

        <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
          {activeTab === "signup"
            ? "Sign up to securely sync and store your payout statements."
            : activeTab === "forgot"
              ? "Enter your email to receive a password recovery link."
              : "Sign in to manage your payout records and analytics."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 px-4 sm:px-6 pt-2 pb-6">
        {/* Error / Success Feedback Alerts */}
        <AnimatePresence mode="wait">
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <Alert
                variant="destructive"
                className="rounded-2xl border-destructive/40 bg-destructive/5 text-destructive"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-xs font-semibold">Authentication Error</AlertTitle>
                <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
              </Alert>
            </motion.div>
          )}

          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <Alert className="rounded-2xl border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <AlertTitle className="text-xs font-semibold">Success</AlertTitle>
                <AlertDescription className="text-xs">{successMessage}</AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab !== "forgot" ? (
          <Tabs
            value={activeTab}
            onValueChange={(val) => {
              setActiveTab(val as "signin" | "signup");
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-secondary/80 p-1 mb-5">
              <TabsTrigger
                id="auth-tab-signin"
                value="signin"
                className="rounded-xl py-2 text-xs sm:text-sm font-semibold transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs"
              >
                Sign In
              </TabsTrigger>
              <TabsTrigger
                id="auth-tab-signup"
                value="signup"
                className="rounded-xl py-2 text-xs sm:text-sm font-semibold transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs"
              >
                Sign Up
              </TabsTrigger>
            </TabsList>

            {/* ======================= SIGN IN TAB ======================= */}
            <TabsContent value="signin" className="mt-0 space-y-4">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <Label htmlFor="signin-email" className="text-xs font-semibold text-foreground">
                    Email address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="signin-email"
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      className="pl-10 rounded-2xl py-5 text-sm bg-background border-border/80 focus-visible:ring-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="signin-password"
                      className="text-xs font-semibold text-foreground"
                    >
                      Password
                    </Label>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("forgot");
                        setResetEmail(signInEmail);
                        setErrorMessage(null);
                      }}
                      className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="signin-password"
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      className="pl-10 pr-10 rounded-2xl py-5 text-sm bg-background border-border/80 focus-visible:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  id="auth-submit-signin-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full py-5 text-sm font-semibold tracking-wide transition-all active:scale-[0.99] shadow-xs cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* ======================= SIGN UP TAB ======================= */}
            <TabsContent value="signup" className="mt-0 space-y-4">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <Label htmlFor="signup-name" className="text-xs font-semibold text-foreground">
                    Full name
                  </Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Jane Doe"
                      value={signUpName}
                      onChange={(e) => setSignUpName(e.target.value)}
                      className="pl-10 rounded-2xl py-5 text-sm bg-background border-border/80 focus-visible:ring-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <Label htmlFor="signup-email" className="text-xs font-semibold text-foreground">
                    Email address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="signup-email"
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      className="pl-10 rounded-2xl py-5 text-sm bg-background border-border/80 focus-visible:ring-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <Label
                    htmlFor="signup-password"
                    className="text-xs font-semibold text-foreground"
                  >
                    Password (min. 6 characters)
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      className="pl-10 pr-10 rounded-2xl py-5 text-sm bg-background border-border/80 focus-visible:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <Label
                    htmlFor="signup-confirm-password"
                    className="text-xs font-semibold text-foreground"
                  >
                    Confirm password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="signup-confirm-password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={signUpConfirmPassword}
                      onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                      className="pl-10 rounded-2xl py-5 text-sm bg-background border-border/80 focus-visible:ring-primary"
                    />
                  </div>
                </div>

                <Button
                  id="auth-submit-signup-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full py-5 text-sm font-semibold tracking-wide transition-all active:scale-[0.99] shadow-xs cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    <>
                      <span>Create Account</span>
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        ) : (
          /* ======================= FORGOT PASSWORD VIEW ======================= */
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <Label htmlFor="reset-email" className="text-xs font-semibold text-foreground">
                Account email address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="reset-email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="pl-10 rounded-2xl py-5 text-sm bg-background border-border/80 focus-visible:ring-primary"
                />
              </div>
            </div>

            <Button
              id="auth-submit-reset-btn"
              type="submit"
              disabled={loading}
              className="w-full rounded-full py-5 text-sm font-semibold shadow-xs cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending link...
                </>
              ) : (
                <span>Send Password Reset Link</span>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setActiveTab("signin");
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className="w-full rounded-full text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              &larr; Back to Sign In
            </Button>
          </form>
        )}
      </CardContent>

      <CardFooter className="pt-0 pb-5 px-6 border-t border-border/40 flex flex-col items-center justify-center text-center">
        <p className="text-[11px] text-muted-foreground mt-3">
          Powered by Supabase Authentication. Your data is encrypted and protected.
        </p>
      </CardFooter>
    </Card>
  );
}
