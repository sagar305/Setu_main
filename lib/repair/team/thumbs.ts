// Shrinks intake photos for team sync. Browser only.
//
// The counter keeps its photos at full size (1024px); what travels to the
// rest of the team is enough to see the crack — 360px at quality 0.6, about
// 10–15 KB each instead of 100–150 KB.

const THUMB_EDGE = 360;
const THUMB_QUALITY = 0.6;
/** Already this small: leave it alone (a thumbnail shrunk twice only gets worse). */
const SMALL_ENOUGH = 24_000;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read the photo."));
    image.src = src;
  });
}

export async function shrinkPhoto(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith("data:image/") || dataUrl.length <= SMALL_ENOUGH) return dataUrl;
  try {
    const image = await loadImage(dataUrl);
    const scale = Math.min(1, THUMB_EDGE / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return dataUrl;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const small = canvas.toDataURL("image/jpeg", THUMB_QUALITY);
    return small.length < dataUrl.length ? small : dataUrl;
  } catch {
    return dataUrl;
  }
}

export async function shrinkPhotos(dataUrls: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const url of dataUrls) out.push(await shrinkPhoto(url));
  return out;
}
