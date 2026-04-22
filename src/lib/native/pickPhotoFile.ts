/**
 * Shared helper that lets photo-picking components keep a single code path:
 *   const file = await pickPhotoFile();
 *   if (file) { /* native picked it *\/ } else { /* fall back to <input> *\/ }
 *
 * On native iOS/Android, opens the system camera/library via Capacitor and
 * returns a real File suitable for the existing upload pipeline.
 * On web, returns null so the caller can trigger its hidden <input type="file">.
 */
import { pickPhoto } from "./camera";
import { isNativeApp } from "./platform";

const dataUrlToFile = (dataUrl: string, name: string): File => {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(meta)?.[1] ?? "image/jpeg";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mime });
};

export interface PickPhotoFileOptions {
  source?: "camera" | "library" | "prompt";
  filename?: string;
}

export const pickPhotoFile = async (
  options: PickPhotoFileOptions = {},
): Promise<File | null> => {
  if (!isNativeApp()) return null;
  const dataUrl = await pickPhoto({ source: options.source ?? "prompt" });
  if (!dataUrl) return null;
  const ext = /image\/(\w+)/.exec(dataUrl)?.[1] ?? "jpg";
  const name = options.filename ?? `photo-${Date.now()}.${ext}`;
  return dataUrlToFile(dataUrl, name);
};
