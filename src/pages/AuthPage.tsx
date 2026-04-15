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
      const { error } = mode === "login" ? await signIn(email, password) : await signUp(email, password);
      if (error) throw error;
      if (mode === "signup") setMessage("Check your email to confirm your account.");
      else navigate("/onboarding", { replace: true });
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
      <div className="px-8 pt-8">
        <button onClick={() => navigate("/")} className="text-[9px] font-medium tracking-[0.2em] text-foreground/20 hover:text-foreground/35 transition-colors">
          ← BACK
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-12">
            <h1 className="font-display text-2xl font-light tracking-[0.25em] text-foreground/80">WARDROBE</h1>
            <p className="mt-3 text-[11px] text-foreground/25">
              {mode === "login" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset password"}
            </p>
          </div>

          {/* Google */}
          {mode !== "forgot" && (
            <>
              <button
                onClick={handleGoogle}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2.5 py-3.5 text-[11px] font-medium text-foreground/50 transition-colors hover:text-foreground/70 disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>

              <div className="my-8 flex items-center gap-4">
                <div className="h-px flex-1 bg-foreground/[0.04]" />
                <span className="text-[9px] text-foreground/15">or</span>
                <div className="h-px flex-1 bg-foreground/[0.04]" />
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email"
                required
                className="w-full bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-foreground/20 border-b border-foreground/[0.06] focus:border-foreground/15 transition-colors"
              />
            </div>

            {mode !== "forgot" && (
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  minLength={6}
                  className="w-full bg-transparent py-3 pr-10 text-sm text-foreground outline-none placeholder:text-foreground/20 border-b border-foreground/[0.06] focus:border-foreground/15 transition-colors"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-0 top-1/2 -translate-y-1/2 text-foreground/15">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            )}

            {mode === "login" && (
              <button type="button" onClick={() => { setMode("forgot"); setError(null); setMessage(null); }} className="text-[10px] text-accent/50 hover:text-accent">
                Forgot password?
              </button>
            )}

            {error && <p className="text-[11px] text-destructive/70">{error}</p>}
            {message && <p className="text-[11px] text-accent/60">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 py-3.5 text-[10px] font-semibold tracking-[0.15em] text-foreground/60 transition-colors hover:text-foreground disabled:opacity-50 mt-6"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {mode === "login" ? "SIGN IN" : mode === "signup" ? "CREATE ACCOUNT" : "SEND RESET LINK"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>

          <p className="mt-10 text-center text-[10px] text-foreground/20">
            {mode === "login" ? (
              <>No account?{" "}
                <button onClick={() => { setMode("signup"); setError(null); setMessage(null); }} className="text-accent/50 hover:text-accent">Sign up</button>
              </>
            ) : (
              <>Have an account?{" "}
                <button onClick={() => { setMode("login"); setError(null); setMessage(null); }} className="text-accent/50 hover:text-accent">Sign in</button>
              </>
            )}
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default AuthPage;
