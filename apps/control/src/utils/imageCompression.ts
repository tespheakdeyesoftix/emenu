const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_OUTPUT_BYTES = 200 * 1024;
const DEFAULT_MAX_WIDTH = 500;
const MIN_QUALITY = 0.35;
const MAX_QUALITY = 0.92;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.decoding = "async";
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("មិនអាចអានរូបភាពនេះបានទេ"));
    };
    image.src = objectUrl;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("មិនអាចបង្រួមរូបភាពនេះបានទេ")),
      "image/webp",
      quality,
    );
  });
}

async function bestCompressedBlob(
  canvas: HTMLCanvasElement,
  maxOutputBytes: number,
) {
  let low = MIN_QUALITY;
  let high = MAX_QUALITY;
  let best: Blob | null = null;

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const quality = (low + high) / 2;
    const blob = await canvasBlob(canvas, quality);
    if (blob.size <= maxOutputBytes) {
      best = blob;
      low = quality;
    } else {
      high = quality;
    }
  }

  return best ?? canvasBlob(canvas, MIN_QUALITY);
}

function drawImage(
  image: HTMLImageElement,
  width: number,
  sourceWidth: number,
  sourceHeight: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.max(1, Math.round((sourceHeight * width) / sourceWidth));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("កម្មវិធីរុករកនេះមិនគាំទ្រការបង្រួមរូបភាពទេ");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function compressImageForUpload(
  file: File,
  profile: "default" | "banner" | "background" | "print" = "default",
) {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("សូមបង្ហោះរូបភាព JPG, PNG ឬ WebP");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("រូបភាពដើមត្រូវមានទំហំ 8 MB ឬតូចជាងនេះ");
  }

  const image = await loadImage(file);
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error("ទំហំរូបភាពនេះមិនត្រឹមត្រូវទេ");
  }

  const maxWidth =
    profile === "print"
      ? 3600
      : profile === "background"
        ? 1920
        : profile === "banner"
          ? 1600
          : DEFAULT_MAX_WIDTH;
  const maxOutputBytes =
    profile === "print"
      ? 4 * 1024 * 1024
      : profile === "background"
        ? 1024 * 1024
        : profile === "banner"
          ? 800 * 1024
          : DEFAULT_MAX_OUTPUT_BYTES;
  let width = Math.min(maxWidth, image.naturalWidth);
  let canvas = drawImage(image, width, image.naturalWidth, image.naturalHeight);
  let blob = await bestCompressedBlob(canvas, maxOutputBytes);
  while (blob.size > maxOutputBytes && width > 160) {
    width = Math.max(160, Math.floor(width * 0.8));
    canvas = drawImage(image, width, image.naturalWidth, image.naturalHeight);
    blob = await bestCompressedBlob(canvas, maxOutputBytes);
  }
  if (blob.size > maxOutputBytes) {
    throw new Error(
      profile === "print"
        ? "មិនអាចកែរូបភាពបោះពុម្ពនេះឱ្យតូចជាង 4 MB បានទេ"
        : profile === "background"
          ? "Could not compress this background below 1 MB."
          : profile === "banner"
            ? "មិនអាចបង្រួមរូបភាពបដានេះឱ្យតូចជាង 800 KB បានទេ"
            : "មិនអាចបង្រួមរូបភាពនេះឱ្យតូចជាង 200 KB បានទេ",
    );
  }
  const baseName = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-");
  return new File([blob], `${baseName || "image"}.webp`, {
    type: "image/webp",
    lastModified: file.lastModified,
  });
}
