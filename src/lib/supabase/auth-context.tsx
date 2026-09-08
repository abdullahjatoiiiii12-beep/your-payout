import { createContext, useContext, useEffect, useState, type ReactNode, useCallback } from "react";
import type { User, Session, AuthError } from "@supabase/supabase-js";
import { supabase } from "./client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (
    email: string,
    password: string,
    fullName?: string,
  ) => Promise<{ error: AuthError | null; user: User | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // Fetch initial session
    supabase.auth
      .getSession()
      .then(({ data: { session }, error: sessionError }) => {
        if (!mounted) return;
        if (sessionError) {
          console.warn("Error getting initial Supabase session:", sessionError.message);
        }
        setSession(session);
        setUser(session?.user ?? null);
      })
      .catch((err) => {
        console.warn("Failed to get initial session:", err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
      return { error };
    }
    setSession(data.session);
    setUser(data.user);
    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || email.split("@")[0],
        },
      },
    });
    if (error) {
      setError(error.message);
      return { error, user: null };
    }
    if (data.session) {
      setSession(data.session);
      setUser(data.user);
    }
    return { error: null, user: data.user };
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setError(error.message);
      return { error };
    }
    setSession(null);
    setUser(null);
    return { error: null };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo:
        typeof window !== "undefined" ? `${window.location.origin}/auth?reset=true` : undefined,
    });
    if (error) {
      setError(error.message);
      return { error };
    }
    return { error: null };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        error,
        signIn,
        signUp,
        signOut,
        resetPassword,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
