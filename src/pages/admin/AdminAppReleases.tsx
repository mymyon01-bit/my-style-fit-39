/**
 * AdminAppReleases — upload & publish Android sideload APKs.
 *
 * Flow:
 *   1. Admin picks an .apk file
 *   2. Page uploads it to the public `app-downloads` bucket
 *   3. Admin fills version_code / version_name / release notes
 *   4. "Publish" inserts a row into `app_releases`
 *   5. Every running app picks it up on next boot via AppUpdatePrompt
 */
import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, Trash2, CheckCircle2, AlertCircle, Package } from "lucide-react";
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

const AdminAppReleases = () => {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [mode, setMode] = useState<"upload" | "url">("url");
  const [file, setFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState(
    "https://github.com/mymyon01-bit/my-style-fit-39/releases/download/latest-apk/mymyon.apk"
  );
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
      // Pre-fill the next version_code suggestion
      if (data && data.length > 0 && !versionCode) {
        setVersionCode(String(data[0].version_code + 1));
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

      // Insert release row
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

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-medium italic text-foreground">App Releases</h1>
        <p className="mt-1 text-[12px] text-foreground/60">
          Upload a new Android APK and all installed apps will prompt to update on next launch.
          Remember: every APK must be signed with the SAME keystore as the previous release.
        </p>
      </div>

      {/* Upload form */}
      <div className="rounded-2xl border border-border/40 bg-card/40 p-6 space-y-5">
        <div className="flex items-center gap-2 text-foreground/80">
          <Upload className="h-4 w-4 text-accent" />
          <h2 className="text-[13px] font-semibold tracking-wide">Publish new release</h2>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-foreground/70 mb-2">APK File</label>
          <input
            ref={fileRef}
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={busy}
            className="block w-full text-[12px] text-foreground/80 file:mr-4 file:rounded-md file:border-0 file:bg-accent/10 file:px-3 file:py-2 file:text-[11px] file:font-medium file:text-accent hover:file:bg-accent/20"
          />
          {file && (
            <p className="mt-2 text-[11px] text-foreground/60">
              {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-medium text-foreground/70 mb-2">
              version_code <span className="text-foreground/40">(integer, must increase)</span>
            </label>
            <input
              type="number"
              value={versionCode}
              onChange={(e) => setVersionCode(e.target.value)}
              placeholder="2"
              disabled={busy}
              className="w-full rounded-md border border-border/40 bg-background px-3 py-2 text-[12px] text-foreground"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-foreground/70 mb-2">
              version_name <span className="text-foreground/40">(e.g. 1.0.1)</span>
            </label>
            <input
              type="text"
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              placeholder="1.0.1"
              disabled={busy}
              className="w-full rounded-md border border-border/40 bg-background px-3 py-2 text-[12px] text-foreground"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-foreground/70 mb-2">
            Release notes <span className="text-foreground/40">(shown in update prompt)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="• Faster image loading&#10;• Fixed Google sign-in"
            rows={4}
            disabled={busy}
            className="w-full rounded-md border border-border/40 bg-background px-3 py-2 text-[12px] text-foreground"
          />
        </div>

        <label className="flex items-center gap-2 text-[12px] text-foreground/75">
          <input
            type="checkbox"
            checked={critical}
            onChange={(e) => setCritical(e.target.checked)}
            disabled={busy}
            className="h-4 w-4 accent-accent"
          />
          Critical update <span className="text-foreground/50">(user can't dismiss the prompt)</span>
        </label>

        <button
          onClick={handlePublish}
          disabled={busy || !file}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-[11px] font-bold tracking-[0.2em] text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {progress ?? "Upload & Publish"}
        </button>
      </div>

      {/* Existing releases */}
      <div className="rounded-2xl border border-border/40 bg-card/40 p-6">
        <div className="flex items-center gap-2 text-foreground/80 mb-4">
          <Package className="h-4 w-4 text-accent" />
          <h2 className="text-[13px] font-semibold tracking-wide">Published releases</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>
        ) : releases.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-foreground/55">No releases yet.</p>
        ) : (
          <div className="space-y-2">
            {releases.map((r) => (
              <div key={r.id} className="flex items-start gap-4 rounded-lg border border-border/30 bg-background/50 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[13px] font-semibold text-foreground">
                      v{r.version_name}
                    </span>
                    <span className="text-[10px] text-foreground/50">code {r.version_code}</span>
                    {r.is_critical && (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[9px] font-semibold tracking-wider text-red-400">
                        CRITICAL
                      </span>
                    )}
                    {r.is_published ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold tracking-wider text-emerald-400">
                        <CheckCircle2 className="h-2.5 w-2.5" /> LIVE
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-foreground/10 px-2 py-0.5 text-[9px] font-semibold tracking-wider text-foreground/60">
                        <AlertCircle className="h-2.5 w-2.5" /> DRAFT
                      </span>
                    )}
                  </div>
                  {r.release_notes && (
                    <p className="mt-1 whitespace-pre-line text-[11px] text-foreground/65">{r.release_notes}</p>
                  )}
                  <a
                    href={r.apk_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block truncate text-[10px] text-accent/80 hover:underline"
                  >
                    {r.apk_url}
                  </a>
                  <p className="mt-1 text-[10px] text-foreground/45">
                    {new Date(r.released_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => togglePublished(r)}
                    className="rounded border border-border/40 px-3 py-1 text-[10px] font-medium text-foreground/75 hover:bg-foreground/5"
                  >
                    {r.is_published ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    onClick={() => remove(r)}
                    className="inline-flex items-center justify-center gap-1 rounded border border-red-500/30 px-3 py-1 text-[10px] font-medium text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAppReleases;
