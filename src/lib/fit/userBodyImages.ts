// ─── USER BODY IMAGE LIBRARY ────────────────────────────────────────────────
// Per-user reusable body photos. Hash-based dedup so the same file uploaded
// twice resolves to the existing row instead of creating a duplicate.
//
// Flow:
//   1. user picks a File
//   2. computeImageHash() → SHA-256 of file bytes
//   3. findExistingByHash() → if hit, return that row (no upload, no insert)
//   4. otherwise upload to user-body-images/{user_id}/{hash}.{ext}
//      and insert a new row
//
// Reads/writes go through RLS (auth.uid() = user_id), so users can never see
// or touch another user's library.

import { supabase } from "@/integrations/supabase/client";

const BUCKET = "user-body-images";

export interface UserBodyImage {
  id: string;
  user_id: string;
  storage_path: string;
  storage_bucket: string;
  public_url: string | null;
  image_hash: string;
  width: number | null;
  height: number | null;
  is_active: boolean;
  label: string | null;
  source: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function computeImageHash(file: File | Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

export async function listUserBodyImages(userId: string): Promise<UserBodyImage[]> {
  const { data, error } = await supabase
    .from("user_body_images")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[userBodyImages] list failed", error.message);
    return [];
  }
  return (data ?? []) as UserBodyImage[];
}

export async function findExistingByHash(
  userId: string,
  hash: string
): Promise<UserBodyImage | null> {
  const { data } = await supabase
    .from("user_body_images")
    .select("*")
    .eq("user_id", userId)
    .eq("image_hash", hash)
    .eq("is_active", true)
    .maybeSingle();
  return (data as UserBodyImage | null) ?? null;
}

async function getSignedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 6);
  return data?.signedUrl ?? null;
}

/**
 * Resolve a viewable URL for a body image record. Public URL (legacy
 * body-scans bucket) is returned as-is; for the private user-body-images
 * bucket we issue a 6h signed URL.
 */
export async function resolveBodyImageUrl(img: UserBodyImage): Promise<string | null> {
  if (img.storage_bucket !== BUCKET) {
    return img.public_url || null;
  }
  return await getSignedUrl(img.storage_path);
}

export interface UploadResult {
  image: UserBodyImage;
  reused: boolean;
  url: string | null;
}

/**
 * Upload-or-reuse. Computes hash, dedups per user, returns the canonical
 * record + a usable URL.
 */
export async function uploadOrReuseBodyImage(
  userId: string,
  file: File,
  opts?: { label?: string; width?: number; height?: number }
): Promise<UploadResult> {
  const hash = await computeImageHash(file);

  // Dedup
  const existing = await findExistingByHash(userId, hash);
  if (existing) {
    const url = await resolveBodyImageUrl(existing);
    return { image: existing, reused: true, url };
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/${hash}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type || "image/jpeg" });
  if (upErr) {
    throw new Error(`upload_failed: ${upErr.message}`);
  }

  const { data: inserted, error: insErr } = await supabase
    .from("user_body_images")
    .insert({
      user_id: userId,
      storage_path: path,
      storage_bucket: BUCKET,
      image_hash: hash,
      width: opts?.width ?? null,
      height: opts?.height ?? null,
      label: opts?.label ?? null,
      source: "upload",
      metadata: { uploaded_at: new Date().toISOString() },
    })
    .select("*")
    .single();

  if (insErr || !inserted) {
    // Race: another tab may have inserted the same hash. Re-fetch.
    const fallback = await findExistingByHash(userId, hash);
    if (fallback) {
      const url = await resolveBodyImageUrl(fallback);
      return { image: fallback, reused: true, url };
    }
    throw new Error(`insert_failed: ${insErr?.message || "unknown"}`);
  }

  const url = await resolveBodyImageUrl(inserted as UserBodyImage);
  return { image: inserted as UserBodyImage, reused: false, url };
}

/**
 * Soft-delete from library view. If the file is in the user-body-images
 * bucket and not referenced by any fit_tryons row, also remove the storage
 * object. Legacy bucket files (body-scans) are never deleted from storage.
 */
export async function removeBodyImage(userId: string, image: UserBodyImage): Promise<void> {
  // Mark inactive first so library hides it immediately even if storage delete fails.
  await supabase
    .from("user_body_images")
    .update({ is_active: false })
    .eq("id", image.id)
    .eq("user_id", userId);

  if (image.storage_bucket !== BUCKET) return;

  // Reference check
  const { count } = await supabase
    .from("fit_tryons")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("body_image_hash", image.image_hash);

  if ((count ?? 0) > 0) return; // keep file, library row already hidden

  await supabase.storage.from(BUCKET).remove([image.storage_path]).catch(() => {});
}
