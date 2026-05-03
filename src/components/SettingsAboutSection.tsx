/**
 * Settings → About & Updates section.
 *
 * Shows the running app's version, signing SHA-1 (for Google OAuth setup),
 * and lets the user manually trigger an update check.
 */
import { useState } from "react";
import { Loader2, RefreshCw, Copy, Smartphone, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";
import { useAppInfo } from "@/lib/native/appInfo";
import { checkForUpdate, installUpdate } from "@/lib/native/appUpdate";

const Row = ({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) => {
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="text-[10px] font-semibold tracking-[0.2em] text-foreground/55 shrink-0 pt-0.5">
        {label}
      </span>
      <button
        onClick={copyable ? onCopy : undefined}
        className={`text-right text-[11px] font-mono text-foreground/85 break-all leading-snug ${
          copyable ? "hover:text-accent transition-colors cursor-copy" : ""
        }`}
      >
        {value}
        {copyable && <Copy className="inline h-3 w-3 ml-1 opacity-50 align-text-top" />}
      </button>
    </div>
  );
};

const SettingsAboutSection = () => {
  const info = useAppInfo();
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const res = await checkForUpdate();
      if (res.status === "unavailable") {
        toast.info(info.platform === "android" ? "Could not reach update server" : "Updates only on Android app");
        return;
      }
      if (res.status === "current") {
        toast.success("You're on the latest version");
        return;
      }
      // Available
      const ok = confirm(
        `New version ${res.release.version_name} is available.\n\nInstall now?`,
      );
      if (!ok) return;
      setInstalling(true);
      await installUpdate(res.release);
    } catch (e: any) {
      toast.error(e?.message || "Update check failed");
    } finally {
      setChecking(false);
      setInstalling(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Info className="h-3.5 w-3.5 text-foreground/75" strokeWidth={1.8} />
        <p className="text-[10px] font-semibold tracking-[0.25em] text-foreground/70 md:text-[11px]">
          ABOUT &amp; UPDATES
        </p>
      </div>

      <div className="rounded-xl border border-border/20 bg-card/30 p-5 space-y-1">
        <Row label="PLATFORM" value={info.isNative ? `${info.platform} app` : "web"} />
        <Row label="VERSION" value={`${info.versionName} (${info.versionCode})`} />
        <Row label="BUNDLE" value={info.bundleId} />
        <Row label="COMMIT" value={info.commitSha} copyable />
        <Row label="BUILT" value={info.builtAt} />
        <div className="h-px bg-border/20 my-2" />
        <Row label="SIGNING SHA-1" value={info.signingSha1} copyable />
        <Row label="SIGNING SHA-256" value={info.signingSha256} copyable />
        {info.signingSha1 === "unknown" && (
          <p className="pt-2 text-[10px] leading-relaxed text-foreground/50">
            SHA-1 is injected when the APK is built by CI. The value here will populate after the next signed release build.
          </p>
        )}
      </div>

      <button
        onClick={handleCheck}
        disabled={checking || installing}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-foreground/15 px-5 py-3 text-[11px] font-semibold tracking-[0.2em] text-foreground/80 transition-colors hover:bg-foreground/5 disabled:opacity-50"
      >
        {checking || installing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : info.isNative && info.platform === "android" ? (
          <RefreshCw className="h-3.5 w-3.5" />
        ) : (
          <Smartphone className="h-3.5 w-3.5" />
        )}
        {installing
          ? "INSTALLING…"
          : checking
          ? "CHECKING…"
          : info.isNative && info.platform === "android"
          ? "CHECK FOR UPDATES"
          : "ANDROID APP ONLY"}
      </button>
    </div>
  );
};

export default SettingsAboutSection;
