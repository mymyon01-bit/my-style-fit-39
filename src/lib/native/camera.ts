/**
 * Native camera helper. On native iOS/Android, opens the device camera or
 * photo library via Capacitor. On web, returns null so the caller can fall
 * back to the existing <input type="file"> flow.
 *
 * Usage:
 *   const dataUrl = await pickPhoto({ source: "camera" });
 *   if (!dataUrl) { /* fall back to file input *\/ }
 */
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { isNativeApp } from "./platform";

interface PickPhotoOptions {
  source?: "camera" | "library" | "prompt";
  quality?: number;
}

export const pickPhoto = async (
  options: PickPhotoOptions = {}
): Promise<string | null> => {
  if (!isNativeApp()) return null;

  const sourceMap = {
    camera: CameraSource.Camera,
    library: CameraSource.Photos,
    prompt: CameraSource.Prompt,
  } as const;

  try {
    const photo = await Camera.getPhoto({
      quality: options.quality ?? 85,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: sourceMap[options.source ?? "prompt"],
    });
    return photo.dataUrl ?? null;
  } catch {
    // user cancelled or denied permission
    return null;
  }
};
