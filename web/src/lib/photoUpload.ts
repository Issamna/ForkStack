import { api } from "./api";

/** Longest edge after downscaling. Tiles render at ~300px, detail at ~800px. */
const MAX_EDGE = 1200;
const JPEG_QUALITY = 0.82;

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file could not be read as an image."));
    };
    img.src = url;
  });
}

/**
 * Shrink to at most MAX_EDGE and re-encode as JPEG.
 *
 * Phone cameras produce 3-8 MB files, which would blow the 5 MB cap the
 * presigned POST enforces and cost far more to store than a recipe tile needs.
 * Always re-encodes to JPEG, so the upload type is predictable.
 */
async function downscale(file: File): Promise<Blob> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the image in this browser.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) throw new Error("Could not process the image in this browser.");
  return blob;
}

/**
 * Downscale, upload straight to S3 with a presigned POST, return the object key
 * to store on the recipe. Bytes never pass through the API.
 */
export async function uploadRecipePhoto(file: File): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error("Please choose a JPEG, PNG, or WebP image.");
  }

  const blob = await downscale(file);
  const { image_key, url, fields } = await api.recipes.photoUpload("image/jpeg");

  // Order matters: S3 ignores any field that arrives after the file part.
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));
  form.append("file", blob);

  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) throw new Error("Upload failed. Please try again.");
  return image_key;
}
