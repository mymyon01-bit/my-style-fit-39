/**
 * AdminAppReleases — upload & publish Android sideload APKs.
 *
 * Two publish modes:
 *  - GitHub URL  → just point to the latest-apk release asset (default)
 *  - Upload File → drop a local .apk into the app-downloads bucket
 *
 * After publish, every running app picks the new release up on next boot
 * via AppUpdatePrompt.
 */
import { useEffect, useRef, useState } from "react";
import {
  Loader2, Upload, Trash2, CheckCircle2, AlertCircle, Package,
  Sparkles, Link2, FileUp, Zap, ArrowUpRight, ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Release = {
  id: string;
  platform: string;
  version_name: string;
  version_code: number;
  apk_url: string;
  release_notes: string | null;
  is_critical: boolean;
  is_published: boolean;
  released_at: string;
};

const DEFAULT_GITHUB_APK =
  "https://github.com/mymyon01-bit/my-style-fit-39/releases/download/latest-apk/mymyon.apk";

const AdminAppReleases = () => {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [mode, setMode] = useState<"url" | "upload">("url");
  const [file, setFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState(DEFAULT_GITHUB_APK);
  const [versionName, setVersionName] = useState("");
  const [versionCode, setVersionCode] = useState("");
  const [notes, setNotes] = useState("");
  const [critical, setCritical] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_releases")
      .select("*")
      .order("version_code", { ascending: false });
    if (error) {
      toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    } else {
      setReleases((data ?? []) as Release[]);
      if (data && data.length > 0 && !versionCode) {
        setVersionCode(String(data[0].version_code + 1));
      } else if ((!data || data.length === 0) && !versionCode) {
        setVersionCode("1");
      }
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const reset = () => {
    setFile(null);
    setVersionName("");
    setNotes("");
    setCritical(false);
    setProgress(null);
    if (fileRef.current) fileRef.current.value = "";
    void load();
  };

  const handlePublish = async () => {
    const code = parseInt(versionCode, 10);
    if (!Number.isFinite(code) || code < 1) {
      toast({ title: "version_code must be a positive integer", variant: "destructive" });
      return;
    }
    if (!versionName.trim()) {
      toast({ title: "version_name required (e.g. 1.0.1)", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      let apkUrl: string;

      if (mode === "upload") {
        if (!file) {
          toast({ title: "Pick an APK file first", variant: "destructive" });
          setBusy(false);
          return;
        }
        const path = `android/mymyon-v${code}-${Date.now()}.apk`;
        setProgress("Uploading APK…");
        const { error: upErr } = await supabase.storage
          .from("app-downloads")
          .upload(path, file, {
            contentType: "application/vnd.android.package-archive",
            cacheControl: "3600",
            upsert: false,
          });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("app-downloads").getPublicUrl(path);
        apkUrl = urlData.publicUrl;
      } else {
        if (!externalUrl.trim().startsWith("http")) {
          toast({ title: "Enter a valid https:// URL", variant: "destructive" });
          setBusy(false);
          return;
        }
        apkUrl = externalUrl.trim();
      }

      setProgress("Publishing release…");
      const { error: insErr } = await supabase.from("app_releases").insert({
        platform: "android",
        version_name: versionName.trim(),
        version_code: code,
        apk_url: apkUrl,
        release_notes: notes.trim() || null,
        is_critical: critical,
        is_published: true,
      });
      if (insErr) throw insErr;

      toast({ title: "Released ✓", description: `v${versionName} (code ${code}) is live` });
      reset();
    } catch (e: any) {
      toast({ title: "Publish failed", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const togglePublished = async (r: Release) => {
    const { error } = await supabase
      .from("app_releases")
      .update({ is_published: !r.is_published })
      .eq("id", r.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      void load();
    }
  };

  const remove = async (r: Release) => {
    if (!confirm(`Delete release v${r.version_name} (code ${r.version_code})?`)) return;
    const { error } = await supabase.from("app_releases").delete().eq("id", r.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted" });
      void load();
    }
  };

  const liveRelease = releases.find((r) => r.is_published);

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      {/* ───── Header ───── */}
      <div>
        <p className="text-[10px] font-bold tracking-[0.3em] text-accent/80">RELEASES</p>
        <h1 className="mt-2 font-display text-3xl font-medium italic text-foreground md:text-4xl">
          App Distribution
        </h1>
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-foreground/55 md:text-[13px]">
          Push a new Android APK live. Every installed app prompts to update on the next launch.
          Keystore must match across releases — otherwise users have to uninstall.
        </p>

        {/* Live release pill */}
        {liveRelease && (
          <div className="mt-5 inline-flex items-center gap-3 rounded-full border border-emerald-500/30 bg-emerald-500/[0.06] py-2 pl-3 pr-5 text-[11px]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="font-medium text-emerald-300/90">Live</span>
            <span className="text-foreground/40">·</span>
            <span className="font-mono text-foreground/75">v{liveRelease.version_name}</span>
            <span className="text-foreground/35 text-[10px]">(code {liveRelease.version_code})</span>
          </div>
        )}
      </div>

      {/* ───── Publish form ───── */}
      <section className="relative overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br from-card/60 via-card/40 to-card/20 p-6 backdrop-blur md:p-8">
        {/* Decorative glow */}
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-medium italic text-foreground">
                Publish a new release
              </h2>
              <p className="text-[11px] text-foreground/50">
                Bump version_code, choose a source, add notes. Done in 30 seconds.
              </p>
            </div>
          </div>

          {/* Mode toggle — segmented control */}
          <div className="inline-flex items-center gap-1 rounded-2xl border border-border/40 bg-background/60 p-1">
            <button
              onClick={() => setMode("url")}
              disabled={busy}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[11px] font-semibold tracking-wide transition-all ${
                mode === "url"
                  ? "bg-accent text-accent-foreground shadow-lg shadow-accent/20"
                  : "text-foreground/60 hover:text-foreground/85"
              }`}
            >
              <Link2 className="h-3.5 w-3.5" /> GitHub URL
            </button>
            <button
              onClick={() => setMode("upload")}
              disabled={busy}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[11px] font-semibold tracking-wide transition-all ${
                mode === "upload"
                  ? "bg-accent text-accent-foreground shadow-lg shadow-accent/20"
                  : "text-foreground/60 hover:text-foreground/85"
              }`}
            >
              <FileUp className="h-3.5 w-3.5" /> Upload File
            </button>
          </div>

          {/* Source input */}
          {mode === "url" ? (
            <div className="space-y-2">
              <label className="block text-[10px] font-bold tracking-[0.2em] text-foreground/55">
                APK URL
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://github.com/.../mymyon.apk"
                  disabled={busy}
                  className="w-full rounded-xl border border-border/40 bg-background/70 px-4 py-3 pr-24 font-mono text-[11px] text-foreground transition-colors focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/30"
                />
                <button
                  type="button"
                  onClick={() => setExternalUrl(DEFAULT_GITHUB_APK)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-accent/10 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-accent transition-colors hover:bg-accent/20"
                >
                  Default
                </button>
              </div>
              <p className="text-[10px] leading-relaxed text-foreground/50">
                💡 GitHub Actions가 매 push마다 새 APK를 위 URL에 덮어써요. version_code만 올리면 끝.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-[10px] font-bold tracking-[0.2em] text-foreground/55">
                APK File
              </label>
              <label
                htmlFor="apk-input"
                className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/40 bg-background/40 px-6 py-10 text-center transition-colors hover:border-accent/40 hover:bg-accent/[0.03] ${
                  busy ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <FileUp className="h-6 w-6" />
                </div>
                {file ? (
                  <div>
                    <p className="text-[12px] font-medium text-foreground">{file.name}</p>
                    <p className="mt-1 text-[10px] text-foreground/50">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-[12px] font-medium text-foreground/85">
                      Drop your APK or click to browse
                    </p>
                    <p className="mt-1 text-[10px] text-foreground/50">
                      .apk · max ~100MB
                    </p>
                  </div>
                )}
                <input
                  id="apk-input"
                  ref={fileRef}
                  type="file"
                  accept=".apk,application/vnd.android.package-archive"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  disabled={busy}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Version row */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-[10px] font-bold tracking-[0.2em] text-foreground/55">
                version_code
              </label>
              <input
                type="number"
                value={versionCode}
                onChange={(e) => setVersionCode(e.target.value)}
                placeholder="2"
                disabled={busy}
                className="w-full rounded-xl border border-border/40 bg-background/70 px-4 py-3 font-mono text-[13px] text-foreground transition-colors focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/30"
              />
              <p className="text-[10px] text-foreground/45">Integer · must increase every release</p>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-bold tracking-[0.2em] text-foreground/55">
                version_name
              </label>
              <input
                type="text"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                placeholder="1.0.1"
                disabled={busy}
                className="w-full rounded-xl border border-border/40 bg-background/70 px-4 py-3 font-mono text-[13px] text-foreground transition-colors focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/30"
              />
              <p className="text-[10px] text-foreground/45">Shown to users in the update prompt</p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold tracking-[0.2em] text-foreground/55">
              Release notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="• Faster image loading&#10;• Fixed Google sign-in"
              rows={4}
              disabled={busy}
              className="w-full rounded-xl border border-border/40 bg-background/70 px-4 py-3 text-[12px] text-foreground transition-colors focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/30"
            />
          </div>

          {/* Critical toggle */}
          <button
            type="button"
            onClick={() => setCritical(!critical)}
            disabled={busy}
            className={`group flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-left transition-all ${
              critical
                ? "border-red-500/40 bg-red-500/[0.06]"
                : "border-border/40 bg-background/40 hover:border-border/60"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                  critical ? "bg-red-500/15 text-red-400" : "bg-foreground/5 text-foreground/50"
                }`}
              >
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[12px] font-semibold text-foreground/85">Critical update</p>
                <p className="text-[10px] text-foreground/50">User can't dismiss the prompt</p>
              </div>
            </div>
            <div
              className={`h-6 w-11 rounded-full p-0.5 transition-colors ${
                critical ? "bg-red-500/60" : "bg-foreground/15"
              }`}
            >
              <div
                className={`h-5 w-5 rounded-full bg-white transition-transform ${
                  critical ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </div>
          </button>

          {/* CTA */}
          <button
            onClick={handlePublish}
            disabled={busy || (mode === "upload" && !file) || (mode === "url" && !externalUrl.trim())}
            className="group inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-accent to-accent/85 px-8 py-4 text-[12px] font-bold tracking-[0.2em] text-accent-foreground shadow-lg shadow-accent/20 transition-all hover:shadow-xl hover:shadow-accent/30 disabled:opacity-30 disabled:shadow-none md:w-auto"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 transition-transform group-hover:rotate-12" />
            )}
            {progress ?? "PUBLISH RELEASE"}
          </button>
        </div>
      </section>

      {/* ───── Release history ───── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-foreground/80">
            <Package className="h-4 w-4 text-accent" />
            <h2 className="text-[13px] font-semibold tracking-wide">Release history</h2>
            <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] text-foreground/55">
              {releases.length}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
          </div>
        ) : releases.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/40 bg-card/20 py-16 text-center">
            <Package className="mx-auto mb-3 h-8 w-8 text-foreground/30" />
            <p className="text-[12px] text-foreground/55">No releases published yet.</p>
            <p className="mt-1 text-[11px] text-foreground/40">
              Use the form above to push your first build.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {releases.map((r, idx) => {
              const isExpanded = expanded === r.id;
              const isLatest = idx === 0;
              return (
                <div
                  key={r.id}
                  className={`overflow-hidden rounded-2xl border transition-all ${
                    isLatest
                      ? "border-accent/30 bg-gradient-to-br from-accent/[0.04] to-transparent"
                      : "border-border/30 bg-card/30"
                  }`}
                >
                  {/* Row header */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : r.id)}
                    className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-foreground/[0.02]"
                  >
                    {/* Version block */}
                    <div className="shrink-0">
                      <p className="font-mono text-[15px] font-semibold text-foreground">
                        v{r.version_name}
                      </p>
                      <p className="mt-0.5 text-[10px] text-foreground/45">
                        code {r.version_code}
                      </p>
                    </div>

                    {/* Status pills */}
                    <div className="flex flex-1 items-center gap-2 flex-wrap">
                      {isLatest && r.is_published && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-[9px] font-bold tracking-[0.15em] text-accent">
                          LATEST
                        </span>
                      )}
                      {r.is_critical && (
                        <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-[9px] font-bold tracking-[0.15em] text-red-400">
                          CRITICAL
                        </span>
                      )}
                      {r.is_published ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[9px] font-bold tracking-[0.15em] text-emerald-400">
                          <CheckCircle2 className="h-2.5 w-2.5" /> LIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-foreground/10 px-2.5 py-0.5 text-[9px] font-bold tracking-[0.15em] text-foreground/55">
                          <AlertCircle className="h-2.5 w-2.5" /> DRAFT
                        </span>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-[10px] text-foreground/50">
                        {new Date(r.released_at).toLocaleDateString()}
                      </p>
                      <p className="text-[10px] text-foreground/35">
                        {new Date(r.released_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-foreground/40 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Expanded panel */}
                  {isExpanded && (
                    <div className="border-t border-border/20 bg-background/30 px-5 py-4 space-y-4">
                      {r.release_notes && (
                        <div>
                          <p className="mb-1.5 text-[10px] font-bold tracking-[0.2em] text-foreground/50">
                            NOTES
                          </p>
                          <p className="whitespace-pre-line text-[12px] leading-relaxed text-foreground/75">
                            {r.release_notes}
                          </p>
                        </div>
                      )}

                      <div>
                        <p className="mb-1.5 text-[10px] font-bold tracking-[0.2em] text-foreground/50">
                          APK URL
                        </p>
                        <a
                          href={r.apk_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 break-all font-mono text-[10px] text-accent/80 hover:text-accent hover:underline"
                        >
                          {r.apk_url}
                          <ArrowUpRight className="h-3 w-3 shrink-0" />
                        </a>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); togglePublished(r); }}
                          className="rounded-lg border border-border/40 bg-background/50 px-3.5 py-2 text-[10px] font-semibold tracking-wide text-foreground/75 transition-colors hover:bg-foreground/5"
                        >
                          {r.is_published ? "Unpublish" : "Publish"}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); remove(r); }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/[0.04] px-3.5 py-2 text-[10px] font-semibold tracking-wide text-red-400 transition-colors hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminAppReleases;
