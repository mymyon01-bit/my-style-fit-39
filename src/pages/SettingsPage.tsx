import { useState, useRef } from "react";
import Footer from "@/components/Footer";
import { useI18n, type Language } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useTransition, type TransitionStyle } from "@/lib/transition";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Check, Moon, Sun, Monitor, RotateCcw, Shield, Layers,
  User, Globe, Palette, Bell, Lock, Crown, HelpCircle, LogOut,
  CheckCircle, XCircle, Mail, Loader2, Trash2, Type
} from "lucide-react";
import { useFontSize, type FontSize } from "@/lib/fontSize";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const languages: { code: Language; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "ko", label: "Korean", native: "한국어" },
  { code: "it", label: "Italian", native: "Italiano" },
];

const SettingsPage = () => {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { transition, setTransition } = useTransition();
  const { user, signOut } = useAuth();
  const { subscription } = useSubscription();
  const navigate = useNavigate();
  const [resendingVerification, setResendingVerification] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleDeleteAccount = async () => {
    if (!user) return;
    const confirmed = confirm(
      "Permanently delete your account?\n\nThis will remove your profile, posts, messages, and all data. This action cannot be undone.",
    );
    if (!confirmed) return;
    const typed = prompt('Type "DELETE" to confirm');
    if (typed !== "DELETE") {
      toast.error("Account deletion cancelled");
      return;
    }
    setDeletingAccount(true);
    try {
      const { error } = await supabase.functions.invoke("admin-delete-user", {
        body: { user_id: user.id },
      });
      // The edge function requires admin role; fall back to RPC for self-delete.
      if (error) {
        const { error: rpcErr } = await supabase.rpc("delete_my_account" as any);
        if (rpcErr) throw rpcErr;
      }
      toast.success("Account deleted");
      await signOut();
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error("[delete-account]", err);
      toast.error(err.message || "Failed to delete account");
    } finally {
      setDeletingAccount(false);
    }
  };

  const emailVerified = user?.email_confirmed_at != null;

  const handleResendVerification = async () => {
    if (!user?.email) return;
    setResendingVerification(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: user.email });
      if (error) throw error;
      toast.success("Verification email sent! Check your inbox.");
    } catch (err: any) {
      toast.error(err.message || "Failed to send verification email");
    } finally {
      setResendingVerification(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords don't match"); return; }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully");
      setChangingPassword(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSignOut = async () => { await signOut(); navigate("/", { replace: true }); };

  const handleResetProfile = async () => {
    if (!user) return;
    if (!confirm("This will reset your style and body profile. Continue?")) return;
    await Promise.all([
      supabase.from("style_profiles").delete().eq("user_id", user.id),
      supabase.from("body_profiles").delete().eq("user_id", user.id),
      supabase.from("profiles").update({ onboarded: false }).eq("user_id", user.id),
    ]);
    toast.success("Profile reset. You can redo onboarding.");
    navigate("/onboarding");
  };

  const themeOptions = [
    { value: "light" as const, icon: Sun, label: t("light") },
    { value: "dark" as const, icon: Moon, label: t("dark") },
    { value: "system" as const, icon: Monitor, label: t("system") },
  ];

  const transitionOptions: { value: TransitionStyle; label: string; desc: string }[] = [
    { value: "none", label: t("none"), desc: t("noAnimation") },
    { value: "vertical", label: t("vertical"), desc: t("slideFromBottom") },
    { value: "fade", label: t("fade"), desc: t("darkToLight") },
    { value: "split", label: t("split"), desc: t("openFromCenter") },
  ];

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-28 lg:pb-16 lg:pt-24">
      <div className="mx-auto max-w-lg px-8 pt-10 md:max-w-2xl md:px-10 md:pt-10 lg:max-w-3xl lg:px-12">
        <div className="flex items-center gap-4 mb-12 md:mb-14 lg:mb-16">
          <button onClick={() => navigate(-1)} className="hover-burgundy text-foreground/70">
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
          <span className="text-[10px] font-semibold tracking-[0.25em] text-foreground/65 md:text-[11px]">{t("settings").toUpperCase()}</span>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-8 space-y-14 md:max-w-2xl md:px-10 md:space-y-16 lg:max-w-3xl lg:px-12">
        {/* Account & Verification */}
        {user && (
          <>
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-foreground/75" strokeWidth={1.8} />
                <p className="text-[10px] font-semibold tracking-[0.25em] text-foreground/70 md:text-[11px]">{t("account").toUpperCase()}</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] text-foreground/75">{user.email}</p>
                  {emailVerified ? (
                    <span className="flex items-center gap-1 text-[10px] text-green-500/70"><CheckCircle className="h-3.5 w-3.5" /> Verified</span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-orange-400/70"><XCircle className="h-3.5 w-3.5" /> Unverified</span>
                  )}
                </div>
                {!emailVerified && (
                  <button
                    onClick={handleResendVerification}
                    disabled={resendingVerification}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-accent/60 hover:text-accent transition-colors disabled:opacity-50"
                  >
                    {resendingVerification ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                    Resend verification email
                  </button>
                )}
                <button
                  onClick={() => navigate("/profile")}
                  className="text-[11px] font-medium text-accent/60 hover:text-accent transition-colors"
                >
                  {t("viewProfile")} →
                </button>
              </div>
            </div>
            <div className="h-px bg-border/30" />

            {/* Security */}
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-foreground/75" strokeWidth={1.8} />
                <p className="text-[10px] font-semibold tracking-[0.25em] text-foreground/70 md:text-[11px]">SECURITY</p>
              </div>
              {changingPassword ? (
                <div className="space-y-3 rounded-xl border border-border/20 bg-card/30 p-4">
                  <div>
                    <label className="text-[10px] font-medium text-foreground/75">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="mt-1 w-full bg-transparent py-2.5 text-[13px] text-foreground outline-none placeholder:text-foreground/50 border-b border-border/20 focus:border-accent/30"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-foreground/75">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="mt-1 w-full bg-transparent py-2.5 text-[13px] text-foreground outline-none placeholder:text-foreground/50 border-b border-border/20 focus:border-accent/30"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={handleChangePassword} disabled={savingPassword} className="flex items-center gap-1 rounded-lg bg-accent/10 px-4 py-2 text-[11px] font-semibold text-accent/70 disabled:opacity-50">
                      {savingPassword ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      Update
                    </button>
                    <button onClick={() => { setChangingPassword(false); setNewPassword(""); setConfirmPassword(""); }} className="text-[11px] text-foreground/70">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setChangingPassword(true)} className="text-[11px] font-medium text-foreground/70 hover:text-foreground/70 transition-colors">
                  Change password →
                </button>
              )}
            </div>
            <div className="h-px bg-border/30" />
          </>
        )}

        {/* Language */}
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-foreground/75" strokeWidth={1.8} />
            <p className="text-[10px] font-semibold tracking-[0.25em] text-foreground/70 md:text-[11px]">{t("language").toUpperCase()}</p>
          </div>
          <div className="space-y-1">
            {languages.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`hover-burgundy flex w-full items-center justify-between py-4 md:py-5 ${
                  lang === l.code ? "text-foreground" : "text-foreground/70"
                }`}
              >
                <p className="text-[13px] font-medium md:text-[14px]">{l.native}</p>
                {lang === l.code && <Check className="h-4 w-4 text-accent" />}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-border/30" />

        {/* Appearance */}
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <Palette className="h-3.5 w-3.5 text-foreground/75" strokeWidth={1.8} />
            <p className="text-[10px] font-semibold tracking-[0.25em] text-foreground/70 md:text-[11px]">{t("appearance").toUpperCase()}</p>
          </div>
          <div className="flex gap-10 md:gap-12">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`hover-burgundy flex flex-col items-center gap-3 ${
                  theme === opt.value ? "text-foreground" : "text-foreground/75"
                }`}
              >
                <opt.icon className="h-5 w-5 md:h-6 md:w-6" strokeWidth={1.8} />
                <span className="text-[10px] font-semibold md:text-[11px]">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-border/30" />

        {/* Text size — affects OOTD copy + comments globally */}
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <Type className="h-3.5 w-3.5 text-foreground/75" strokeWidth={1.8} />
            <p className="text-[10px] font-semibold tracking-[0.25em] text-foreground/70 md:text-[11px]">TEXT SIZE</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {([
              { v: "small" as FontSize, label: "Small", sample: "Aa", size: "text-[13px]" },
              { v: "medium" as FontSize, label: "Medium", sample: "Aa", size: "text-[15px]" },
              { v: "large" as FontSize, label: "Large", sample: "Aa", size: "text-[18px]" },
            ]).map((opt) => (
              <button
                key={opt.v}
                onClick={() => setFontSize(opt.v)}
                className={`flex flex-col items-center gap-1.5 rounded-lg border py-3 transition-all ${
                  fontSize === opt.v
                    ? "border-accent/50 bg-accent/[0.08] text-foreground"
                    : "border-border/30 text-foreground/60 hover:text-foreground/80"
                }`}
              >
                <span className={`${opt.size} font-semibold`}>{opt.sample}</span>
                <span className="text-[10px] tracking-[0.18em] uppercase">{opt.label}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-foreground/50">Adjusts post captions, comments, and reading copy across the app.</p>
        </div>

        <div className="h-px bg-border/30" />

        {/* Page Transition */}
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-foreground/75" strokeWidth={1.8} />
            <p className="text-[10px] font-semibold tracking-[0.25em] text-foreground/70 md:text-[11px]">{t("pageTransition").toUpperCase()}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {transitionOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTransition(opt.value)}
                className={`hover-burgundy rounded-lg border px-4 py-3.5 text-left transition-all duration-300 ${
                  transition === opt.value
                    ? "border-accent/40 bg-accent/[0.06] text-foreground"
                    : "border-border/30 text-foreground/75"
                }`}
              >
                <p className="text-[12px] font-semibold md:text-[13px]">{opt.label}</p>
                <p className="mt-1 text-[10px] text-foreground/75">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-border/30" />

        {/* Subscription */}
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <Crown className="h-3.5 w-3.5 text-foreground/75" strokeWidth={1.8} />
            <p className="text-[10px] font-semibold tracking-[0.25em] text-foreground/70 md:text-[11px]">{t("subscription").toUpperCase()}</p>
          </div>
          <div className="rounded-xl border border-border/20 bg-card/30 p-5 space-y-2">
            <p className="text-[13px] font-medium text-foreground/65">
              {subscription.isPremium
                ? subscription.plan === "premium_trial"
                  ? t("premiumTrialStatus").replace("{days}", String(subscription.daysRemaining))
                  : t("premiumActive")
                : t("freePlan")}
            </p>
            <p className="text-[11px] text-foreground/75">
              {subscription.isPremium ? t("premiumDesc") : t("upgradeDesc")}
            </p>
          </div>
        </div>

        <div className="h-px bg-border/30" />

        {/* Actions */}
        <div className="space-y-1">
          {user && (
            <button onClick={handleResetProfile} className="hover-burgundy flex w-full items-center gap-4 py-4.5 text-foreground/75 md:py-5">
              <RotateCcw className="h-[18px] w-[18px]" strokeWidth={1.6} />
              <span className="text-[13px] font-medium md:text-[14px]">{t("resetProfile")}</span>
            </button>
          )}
          <button className="hover-burgundy flex w-full items-center gap-4 py-4.5 text-foreground/75 md:py-5">
            <HelpCircle className="h-[18px] w-[18px]" strokeWidth={1.6} />
            <span className="text-[13px] font-medium md:text-[14px]">{t("help")}</span>
          </button>
        </div>

        {/* Sign out + Delete account */}
        {user && (
          <div className="space-y-2 border-t border-border/30 pt-6">
            <button onClick={handleSignOut} className="flex items-center gap-2 py-3 text-[11px] font-medium tracking-[0.1em] text-destructive/40 transition-colors hover:text-destructive/60">
              <LogOut className="h-4 w-4" />
              {t("signOut")}
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={deletingAccount}
              className="flex items-center gap-2 py-3 text-[11px] font-medium tracking-[0.1em] text-destructive/60 transition-colors hover:text-destructive disabled:opacity-50"
            >
              {deletingAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              DELETE ACCOUNT
            </button>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default SettingsPage;
