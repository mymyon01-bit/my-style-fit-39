import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const AuthPage = () => {
  const { t } = useI18n();
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (mode === "forgot") {
        const { error } = await resetPassword(email);
        if (error) throw error;
        setMessage("Password reset email sent. Check your inbox.");
        setLoading(false);
        return;
      }

      const { error } = mode === "login"
        ? await signIn(email, password)
        : await signUp(email, password);

      if (error) throw error;

      if (mode === "signup") {
        setMessage("Check your email to confirm your account.");
      } else {
        navigate("/onboarding", { replace: true });
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    const { error } = await signInWithGoogle();
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Back to browsing */}
      <div className="px-4 pt-4">
        <button onClick={() => navigate("/")} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          ← Continue browsing
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          {/* Logo */}
          <div className="text-center">
            <h1 className="font-display text-3xl font-bold tracking-[0.2em] text-foreground">
              WARDROBE
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "login" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset password"}
            </p>
          </div>

          {/* Google — first for conversion */}
          {mode !== "forgot" && (
            <>
              <button
                onClick={handleGoogle}
                disabled={loading}
                className="mt-8 flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-card py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] text-muted-foreground">or continue with email</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email"
                required
                className="w-full rounded-xl border border-border bg-card py-3.5 pl-11 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-accent transition-colors"
              />
            </div>

            {mode !== "forgot" && (
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-border bg-card py-3.5 pl-11 pr-11 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            )}

            {mode === "login" && (
              <button
                type="button"
                onClick={() => { setMode("forgot"); setError(null); setMessage(null); }}
                className="block text-xs font-medium text-accent hover:text-accent/80"
              >
                Forgot password?
              </button>
            )}

            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
            )}
            {message && (
              <p className="rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent">{message}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Switch mode */}
          <p className="mt-6 text-center text-xs text-muted-foreground">
            {mode === "login" ? (
              <>Don't have an account?{" "}
                <button onClick={() => { setMode("signup"); setError(null); setMessage(null); }} className="font-medium text-accent">
                  Sign up
                </button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button onClick={() => { setMode("login"); setError(null); setMessage(null); }} className="font-medium text-accent">
                  Sign in
                </button>
              </>
            )}
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default AuthPage;
