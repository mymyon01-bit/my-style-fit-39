import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
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
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* Desktop: left editorial panel */}
      <div className="hidden lg:flex lg:w-1/2 lg:flex-col lg:items-center lg:justify-center lg:bg-foreground/[0.02]">
        <div className="max-w-sm text-center space-y-8">
          <h1 className="font-display text-4xl font-light tracking-[0.2em] text-foreground/80">WARDROBE</h1>
          <p className="text-[14px] leading-[2] text-foreground/30">
            Your personal AI stylist.<br />
            Weather-aware. Body-conscious. Always relevant.
          </p>
          <div className="h-px w-14 mx-auto bg-accent/[0.10]" />
          <p className="text-[12px] text-foreground/18">
            3 months of Premium included with every new account.
          </p>
        </div>
      </div>

      {/* Form side */}
      <div className="flex flex-1 flex-col lg:w-1/2">
        <div className="px-8 pt-10 lg:hidden">
          <button onClick={() => navigate("/")} className="text-[10px] font-medium tracking-[0.2em] text-foreground/25 hover:text-foreground/40 transition-colors">
            ← BACK
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-8 md:px-12 lg:px-16">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="w-full max-w-sm md:max-w-md">
            <div className="text-center mb-14 md:mb-16">
              <h1 className="font-display text-[26px] font-light tracking-[0.25em] text-foreground/80 md:text-3xl lg:text-3xl">
                <span className="lg:hidden">WARDROBE</span>
                <span className="hidden lg:inline">
                  {mode === "login" ? "Welcome back" : mode === "signup" ? "Create account" : "Reset password"}
                </span>
              </h1>
              <p className="mt-4 text-[12px] text-foreground/30 md:text-[13px] lg:hidden">
                {mode === "login" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset password"}
              </p>
            </div>

            {/* Google */}
            {mode !== "forgot" && (
              <>
                <button
                  onClick={handleGoogle}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-3 py-4.5 text-[12px] font-medium text-foreground/55 transition-colors hover:text-foreground/70 disabled:opacity-50 md:text-[13px]"
                >
                  <svg className="h-4.5 w-4.5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </button>

                <div className="my-10 flex items-center gap-4">
                  <div className="h-px flex-1 bg-accent/[0.06]" />
                  <span className="text-[10px] text-foreground/18">or</span>
                  <div className="h-px flex-1 bg-accent/[0.06]" />
                </div>
              </>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email"
                required
                className="w-full bg-transparent py-4 text-[14px] text-foreground outline-none placeholder:text-foreground/30 border-b border-accent/[0.08] focus:border-foreground/18 transition-colors md:text-base"
              />

              {mode !== "forgot" && (
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                    minLength={6}
                    className="w-full bg-transparent py-4 pr-10 text-[14px] text-foreground outline-none placeholder:text-foreground/30 border-b border-accent/[0.08] focus:border-foreground/18 transition-colors md:text-base"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-0 top-1/2 -translate-y-1/2 text-foreground/18">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              )}

              {mode === "login" && (
                <button type="button" onClick={() => { setMode("forgot"); setError(null); setMessage(null); }} className="text-[11px] text-accent/50 hover:text-accent">
                  Forgot password?
                </button>
              )}

              {error && <p className="text-[12px] text-destructive/70">{error}</p>}
              {message && <p className="text-[12px] text-accent/60">{message}</p>}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 py-4.5 text-[11px] font-semibold tracking-[0.15em] text-foreground/65 transition-colors hover:text-foreground disabled:opacity-50 mt-8 md:text-[12px]"
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

            <p className="mt-12 text-center text-[11px] text-foreground/28 md:text-[12px]">
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
    </div>
  );
};

export default AuthPage;
