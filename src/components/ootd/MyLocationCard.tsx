/**
 * MyLocationCard — compact "내 위치 설정" widget for the OOTD feed.
 * Loads the user's current `profiles.location`, lets them search a new
 * one via Nominatim, and saves it back. Works on web + mobile.
 */
import { useEffect, useState } from "react";
import { MapPin, Pencil, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import LocationSearchInput, { type LocationResult } from "@/components/LocationSearchInput";

const MyLocationCard = () => {
  const { user } = useAuth();
  const [current, setCurrent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<LocationResult | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("location")
        .eq("user_id", user.id)
        .maybeSingle();
      setCurrent(data?.location ?? null);
      setLoading(false);
    })();
  }, [user]);

  const save = async () => {
    if (!user || !pending) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ location: pending.short || pending.display })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Couldn't save location");
      return;
    }
    setCurrent(pending.short || pending.display);
    setPending(null);
    setEditing(false);
    toast.success("Location updated");
  };

  if (!user) return null;

  return (
    <div className="rounded-xl border border-accent/15 bg-accent/[0.04] px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <MapPin className="h-3.5 w-3.5 text-accent/75" />
        <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-accent/75">My Location</span>
      </div>

      {!editing ? (
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <p className="line-clamp-1 text-[12px] text-foreground/80">
            {loading ? "…" : current || "Not set"}
          </p>
          <button
            type="button"
            onClick={() => { setEditing(true); setPending(null); }}
            className="flex items-center gap-1 rounded-full border border-accent/30 px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] text-accent/85 hover:bg-accent/10"
          >
            <Pencil className="h-3 w-3" /> {current ? "CHANGE" : "SET"}
          </button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <LocationSearchInput
            value={pending?.display || ""}
            onSelect={(r) => setPending(r)}
            onClear={() => setPending(null)}
            placeholder="Search city…"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => { setEditing(false); setPending(null); }}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] text-foreground/60 hover:bg-foreground/5"
            >
              <X className="h-3 w-3" /> CANCEL
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!pending || saving}
              className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] text-accent-foreground disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} SAVE
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyLocationCard;
