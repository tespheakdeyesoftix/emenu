import QRCode from "qrcode";
import { defaultQrFooterText } from "../../../../shared/qrDesign";
import type { Business } from "../stores/admin";
import type { QrDesign, RestaurantTable, TableGroup } from "../types/qrDesign";
import { presetFor } from "../types/qrDesign";
import { menuLink } from "../types/menu";

export type QrRenderInput = {
  design: QrDesign;
  business: Business;
  menuUrl: string;
  branchSlug?: string;
  table?: RestaurantTable;
  group?: TableGroup;
};

export type ExportFormat = "png" | "pdf";
export type PrintMode = "home" | "print-shop";

const mmToPx = (mm: number, dpi: number) =>
  Math.max(1, Math.round((mm / 25.4) * dpi));
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";

function hexRgb(hex: string) {
  const value = hex.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function luminance(hex: string) {
  const { r, g, b } = hexRgb(hex);
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function qrContrastRatio(dark: string, light: string) {
  const darker = Math.min(luminance(dark), luminance(light));
  const lighter = Math.max(luminance(dark), luminance(light));
  return (lighter + 0.05) / (darker + 0.05);
}

function qrSize(width: number, height: number, scale: number) {
  return Math.min(width * (scale / 100), height * 0.43);
}

export function qrPrintWarning(design: QrDesign) {
  if (
    qrContrastRatio(
      design.config.qrDarkColor,
      design.config.qrLightColor,
    ) < 4.5
  )
    return {
      message: "សូមបង្កើនភាពខុសគ្នារវាងពណ៌ QR ខាងមុខ និងផ្ទៃខាងក្រោយ។",
      blocksExport: true,
    };
  const dimensions = designDimensions(design);
  const faceWidth =
    design.presetKey === "table-tent"
      ? dimensions.widthMm / 2
      : dimensions.widthMm;
  if (qrSize(faceWidth, dimensions.heightMm, design.config.qrScale) < 25)
    return {
      message: "សម្រាប់ការបោះពុម្ព គួរបង្កើនទំហំ QR ឱ្យបានយ៉ាងតិច 25 mm។",
      blocksExport: false,
    };
  return null;
}

export function designDimensions(design: QrDesign) {
  if (design.presetKey === "table-tent") {
    return { widthMm: 297, heightMm: 210 };
  }
  const preset = presetFor(design.presetKey);
  return {
    widthMm: clamp(
      Number(design.config.customWidthMm) || preset.widthMm,
      50,
      420,
    ),
    heightMm: clamp(
      Number(design.config.customHeightMm) || preset.heightMm,
      50,
      420,
    ),
  };
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("មិនអាចផ្ទុករូបភាពការរចនាបានទេ"));
    image.src = url;
  });
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  positionX: number,
  positionY: number,
) {
  const scale = Math.max(
    width / image.naturalWidth,
    height / image.naturalHeight,
  );
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) * (positionX / 100);
  const sourceY = (image.naturalHeight - sourceHeight) * (positionY / 100);
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function fitLine(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
) {
  if (context.measureText(value).width <= maxWidth) return value;
  let next = value;
  while (next.length > 2 && context.measureText(`${next}…`).width > maxWidth)
    next = next.slice(0, -1);
  return `${next.trim()}…`;
}

function fitLabelWithPrefix(
  context: CanvasRenderingContext2D,
  prefix: string,
  separator: string,
  label: string,
  maxWidth: number,
) {
  if (!prefix) return label;
  const prefixWidth = maxWidth - context.measureText(separator + label).width;
  if (prefixWidth <= 0) return label;
  const fittedPrefix = fitLine(context, prefix, prefixWidth);
  return context.measureText(fittedPrefix).width <= prefixWidth
    ? fittedPrefix + separator + label
    : label;
}

function resolveText(input: QrRenderInput) {
  const config = input.design.config;
  return {
    name:
      config.businessNameMode === "custom" && config.customBusinessName
        ? config.customBusinessName
        : input.business.name,
    tagline:
      config.taglineMode === "custom"
        ? config.customTagline
        : input.business.tagline,
  };
}

export function qrUrl(input: QrRenderInput) {
  const branchSlug = input.branchSlug ?? input.design.config.branchSlug;
  const menuSlug = input.design.config.menuSlug;
  if (!input.table && !branchSlug && !menuSlug) return input.menuUrl;
  const url = menuLink(input.menuUrl, branchSlug, menuSlug);
  if (input.table) {
    url.searchParams.set("table", input.table.publicToken);
    url.searchParams.set("table_id", input.table.id);
  }
  return url.toString();
}

async function drawFace(
  context: CanvasRenderingContext2D,
  input: QrRenderInput,
  x: number,
  y: number,
  width: number,
  height: number,
  rotate = false,
) {
  const config = input.design.config;
  context.save();
  if (rotate) {
    context.translate(x + width, y + height);
    context.rotate(Math.PI);
    x = 0;
    y = 0;
  }

  context.fillStyle = config.backgroundColor;
  context.fillRect(x, y, width, height);
  if (config.backgroundType === "image" && config.backgroundImageUrl) {
    try {
      const background = await loadImage(config.backgroundImageUrl);
      drawCover(
        context,
        background,
        x,
        y,
        width,
        height,
        config.backgroundPositionX,
        config.backgroundPositionY,
      );
      const overlay = hexRgb(config.overlayColor);
      context.fillStyle = `rgba(${overlay.r},${overlay.g},${overlay.b},${config.overlayOpacity / 100})`;
      context.fillRect(x, y, width, height);
    } catch {
      // The solid background remains a safe fallback.
    }
  }

  const padding = width * 0.09;
  const centerX = x + width / 2;
  const { name, tagline } = resolveText(input);
  const align = config.alignment;
  context.textAlign = align;
  const textX =
    align === "left"
      ? x + padding
      : align === "right"
        ? x + width - padding
        : centerX;
  context.textBaseline = "middle";

  let cursorY = y + height * 0.1;
  if (config.showLogo && input.business.logoUrl) {
    try {
      const logoUrl = input.business.logoMediaId
        ? `${API.replace(/\/$/, "")}/media/${encodeURIComponent(input.business.logoMediaId)}`
        : input.business.logoUrl;
      const logo = await loadImage(logoUrl);
      const maxSize = width * (config.logoScale / 100);
      const scale = Math.min(
        maxSize / logo.naturalWidth,
        maxSize / logo.naturalHeight,
      );
      const logoWidth = logo.naturalWidth * scale;
      const logoHeight = logo.naturalHeight * scale;
      context.save();
      context.beginPath();
      context.roundRect(
        centerX - logoWidth / 2,
        cursorY,
        logoWidth,
        logoHeight,
        maxSize * 0.16,
      );
      context.clip();
      context.drawImage(
        logo,
        centerX - logoWidth / 2,
        cursorY,
        logoWidth,
        logoHeight,
      );
      context.restore();
      cursorY += logoHeight + height * 0.035;
    } catch {
      // Keep the business name when a logo cannot be loaded.
    }
  }

  context.fillStyle = config.textColor;
  if (config.showBusinessName) {
    context.font = `800 ${Math.max(16, width * (config.headingSize / 430))}px "${config.fontFamily}", "Noto Sans Khmer", sans-serif`;
    context.fillText(
      fitLine(context, name, width - padding * 2),
      textX,
      cursorY + width * 0.04,
    );
    cursorY += width * 0.12;
  }

  if (tagline) {
    context.globalAlpha = 0.78;
    context.font = `600 ${Math.max(10, width * (config.taglineSize / 520))}px "${config.fontFamily}", "Noto Sans Khmer", sans-serif`;
    context.fillText(
      fitLine(context, tagline, width - padding * 2),
      textX,
      cursorY,
    );
    context.globalAlpha = 1;
  }

  const side = qrSize(width, height, config.qrScale);
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, qrUrl(input), {
    width: Math.round(side),
    margin: 4,
    errorCorrectionLevel: "H",
    color: { dark: config.qrDarkColor, light: config.qrLightColor },
  });
  const qrX = centerX - side / 2;
  const qrY = y + height * (config.qrPositionY / 100) - side / 2;
  context.fillStyle = config.qrLightColor;
  roundedRect(
    context,
    qrX - side * 0.035,
    qrY - side * 0.035,
    side * 1.07,
    side * 1.07,
    side * 0.07,
  );
  context.drawImage(qrCanvas, qrX, qrY, side, side);

  if (input.table) {
    const groupName =
      config.showTableGroup === false
        ? ""
        : input.group?.name || input.table.groupName;
    const prefix = config.tablePrefix?.trim() ?? "";
    const maxTextWidth = width - padding * 2 - width * 0.08;
    context.font = `800 ${Math.max(10, width * 0.045)}px "${config.fontFamily}", "Noto Sans Khmer", sans-serif`;
    const tableLabel = fitLine(context, input.table.label, maxTextWidth);
    const prefixSeparator = /[-/#–—]$/.test(prefix) ? "" : " ";
    const prefixedLabel = fitLabelWithPrefix(
      context,
      prefix,
      prefixSeparator,
      tableLabel,
      maxTextWidth,
    );
    const tableText = fitLabelWithPrefix(
      context,
      groupName,
      " · ",
      prefixedLabel,
      maxTextWidth,
    );
    const pillWidth = Math.min(
      width - padding * 2,
      context.measureText(tableText).width + width * 0.12,
    );
    const pillHeight = width * 0.1;
    context.fillStyle = config.accentColor;
    roundedRect(
      context,
      centerX - pillWidth / 2,
      y + height * 0.72,
      pillWidth,
      pillHeight,
      pillHeight / 2,
    );
    context.fillStyle = config.qrDarkColor;
    context.textAlign = "center";
    context.fillText(
      tableText,
      centerX,
      y + height * 0.72 + pillHeight / 2,
    );
  }

  context.fillStyle = config.textColor;
  context.textAlign = "center";
  context.font = `800 ${Math.max(11, width * (config.ctaSize / 480))}px "${config.fontFamily}", "Noto Sans Khmer", sans-serif`;
  context.fillText(
    fitLine(context, config.ctaText, width - padding * 2),
    centerX,
    y + height * 0.88,
  );
  const footerText = (config.footerText ?? defaultQrFooterText).trim();
  if (config.showFooterText !== false && footerText) {
    context.globalAlpha = 0.62;
    context.font = `600 ${Math.max(8, width * 0.028)}px "${config.fontFamily}", sans-serif`;
    context.fillText(
      fitLine(context, footerText, width - padding * 2),
      centerX,
      y + height * 0.93,
    );
  }
  context.restore();
}

export async function renderQrCanvas(
  input: QrRenderInput,
  options: { dpi?: number; bleedMm?: number } = {},
) {
  await document.fonts?.ready;
  const dpi = options.dpi || 150;
  const bleedMm = options.bleedMm || 0;
  const { widthMm, heightMm } = designDimensions(input.design);
  const bleedPx = bleedMm ? mmToPx(bleedMm, dpi) : 0;
  const canvas = document.createElement("canvas");
  canvas.width = mmToPx(widthMm + bleedMm * 2, dpi);
  canvas.height = mmToPx(heightMm + bleedMm * 2, dpi);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("កម្មវិធីរុករកនេះមិនគាំទ្រការបង្ហាញ Canvas ទេ");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = input.design.config.backgroundColor;
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (
    bleedPx &&
    input.design.config.backgroundType === "image" &&
    input.design.config.backgroundImageUrl
  ) {
    try {
      const background = await loadImage(
        input.design.config.backgroundImageUrl,
      );
      drawCover(
        context,
        background,
        0,
        0,
        canvas.width,
        canvas.height,
        input.design.config.backgroundPositionX,
        input.design.config.backgroundPositionY,
      );
    } catch {
      // The background colour remains a printable bleed fallback.
    }
  }
  const contentWidth = mmToPx(widthMm, dpi);
  const contentHeight = mmToPx(heightMm, dpi);
  if (input.design.presetKey === "table-tent") {
    const faceWidth = contentWidth / 2;
    await drawFace(
      context,
      input,
      bleedPx,
      bleedPx,
      faceWidth,
      contentHeight,
      true,
    );
    await drawFace(
      context,
      input,
      bleedPx + faceWidth,
      bleedPx,
      faceWidth,
      contentHeight,
    );
    context.save();
    context.strokeStyle = "rgba(0,0,0,.35)";
    context.setLineDash([mmToPx(2, dpi), mmToPx(2, dpi)]);
    context.lineWidth = Math.max(1, mmToPx(0.2, dpi));
    context.beginPath();
    context.moveTo(bleedPx + faceWidth, bleedPx);
    context.lineTo(bleedPx + faceWidth, bleedPx + contentHeight);
    context.stroke();
    context.restore();
  } else {
    await drawFace(
      context,
      input,
      bleedPx,
      bleedPx,
      contentWidth,
      contentHeight,
    );
  }
  if (bleedPx) {
    context.save();
    context.strokeStyle = "#111111";
    context.lineWidth = Math.max(1, mmToPx(0.2, dpi));
    const mark = mmToPx(2, dpi);
    const x1 = bleedPx;
    const y1 = bleedPx;
    const x2 = bleedPx + contentWidth;
    const y2 = bleedPx + contentHeight;
    for (const [ax, ay, bx, by] of [
      [x1 - mark, y1, x1 + mark, y1],
      [x1, y1 - mark, x1, y1 + mark],
      [x2 - mark, y1, x2 + mark, y1],
      [x2, y1 - mark, x2, y1 + mark],
      [x1 - mark, y2, x1 + mark, y2],
      [x1, y2 - mark, x1, y2 + mark],
      [x2 - mark, y2, x2 + mark, y2],
      [x2, y2 - mark, x2, y2 + mark],
    ]) {
      context.beginPath();
      context.moveTo(ax, ay);
      context.lineTo(bx, by);
      context.stroke();
    }
    context.restore();
  }
  return canvas;
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("មិនអាចបង្កើតឯកសារសម្រាប់ទាញយកបានទេ")),
      type,
      quality,
    ),
  );
}

function requireTable(input: QrRenderInput) {
  if (input.design.targetType === "table" && (!input.table?.id || !input.table.publicToken))
    throw new Error("សូមជ្រើសរើសតុដែលកំពុងប្រើ មុននឹងទាញយក QR។");
}

export async function createQrExport(
  input: QrRenderInput,
  format: ExportFormat,
  mode: PrintMode,
) {
  if (format === "pdf" && input.design.targetType === "table")
    return createTableQrPdf([input], mode);
  requireTable(input);
  const bleed = format === "pdf" && mode === "print-shop" ? 3 : 0;
  const canvas = await renderQrCanvas(input, { dpi: 300, bleedMm: bleed });
  if (format === "png") return canvasBlob(canvas, "image/png");
  const { jsPDF } = await import("jspdf");
  const { widthMm, heightMm } = designDimensions(input.design);
  const pageWidth = widthMm + bleed * 2;
  const pageHeight = heightMm + bleed * 2;
  const pdf = new jsPDF({
    orientation: pageWidth > pageHeight ? "landscape" : "portrait",
    unit: "mm",
    format: [pageWidth, pageHeight],
    compress: true,
  });
  pdf.addImage(
    canvas.toDataURL("image/png"),
    "PNG",
    0,
    0,
    pageWidth,
    pageHeight,
    undefined,
    "FAST",
  );
  return pdf.output("blob");
}

const A4_SHORT_MM = 210;
const A4_LONG_MM = 297;
const A4_MARGIN_MM = 5;
const A4_CARD_GAP_MM = 4;

function a4TableLayout(
  width: number,
  height: number,
  tableCount: number,
) {
  function layout(orientation: "portrait" | "landscape") {
    const landscape = orientation === "landscape";
    const pageWidth = landscape ? A4_LONG_MM : A4_SHORT_MM;
    const pageHeight = landscape ? A4_SHORT_MM : A4_LONG_MM;
    const margin = width === pageWidth && height === pageHeight ? 0 : A4_MARGIN_MM;
    const printableWidth = pageWidth - margin * 2;
    const printableHeight = pageHeight - margin * 2;
    const scale = Math.min(1, printableWidth / width, printableHeight / height);
    const cardWidth = width * scale;
    const cardHeight = height * scale;
    const gap = A4_CARD_GAP_MM;
    const columns = Math.max(1, Math.floor((printableWidth + gap) / (cardWidth + gap)));
    const rows = Math.max(1, Math.floor((printableHeight + gap) / (cardHeight + gap)));
    return { orientation, pageWidth, pageHeight, cardWidth, cardHeight, scale, columns, capacity: columns * rows };
  }
  const preferred = width > height ? "landscape" : "portrait";
  const normal = layout(preferred);
  const rotated = layout(preferred === "portrait" ? "landscape" : "portrait");
  if (
    rotated.scale > normal.scale ||
    (rotated.scale === normal.scale &&
      Math.min(tableCount, rotated.capacity) > Math.min(tableCount, normal.capacity))
  ) {
    return rotated;
  }
  return normal;
}

export async function createTableQrPdf(
  inputs: QrRenderInput[],
  mode: PrintMode,
  onProgress?: (completed: number, total: number) => void,
) {
  if (!inputs.length)
    throw new Error("សូមជ្រើសរើសតុដែលកំពុងប្រើ មុននឹងទាញយក QR។");
  const { jsPDF } = await import("jspdf");
  const bleed = mode === "print-shop" ? 3 : 0;
  const { widthMm, heightMm } = designDimensions(inputs[0].design);
  const { orientation, pageWidth, pageHeight, cardWidth, cardHeight, scale, columns, capacity } =
    a4TableLayout(widthMm + bleed * 2, heightMm + bleed * 2, inputs.length);
  const pdf = new jsPDF({ orientation, unit: "mm", format: "a4", compress: true });
  const gap = A4_CARD_GAP_MM;

  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index];
    requireTable(input);
    const position = index % capacity;
    if (index > 0 && position === 0) pdf.addPage("a4", orientation);

    const cardsOnPage = Math.min(inputs.length - index + position, capacity);
    const row = Math.floor(position / columns);
    const rowsOnPage = Math.ceil(cardsOnPage / columns);
    const cardsInRow = Math.min(columns, cardsOnPage - row * columns);
    const rowWidth = cardsInRow * cardWidth + (cardsInRow - 1) * gap;
    const gridHeight = rowsOnPage * cardHeight + (rowsOnPage - 1) * gap;
    const x = (pageWidth - rowWidth) / 2 + (position % columns) * (cardWidth + gap);
    const y = (pageHeight - gridHeight) / 2 + row * (cardHeight + gap);
    const canvas = await renderQrCanvas(input, { dpi: 300 * scale, bleedMm: bleed });
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", x, y, cardWidth, cardHeight, undefined, "FAST");
    onProgress?.(index + 1, inputs.length);
  }
  return pdf.output("blob");
}

export function safeFileName(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "qr-menu"
  );
}

export function exportFileName(input: QrRenderInput, format: ExportFormat) {
  const { widthMm, heightMm } = designDimensions(input.design);
  const table = input.table ? `-${safeFileName(input.table.code)}` : "";
  const size = input.table && format === "pdf" ? "a4" : `${widthMm}x${heightMm}mm`;
  return `${safeFileName(input.business.name)}-${safeFileName(input.design.name)}${table}-${size}.${format}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function createBulkQrZip(
  inputs: QrRenderInput[],
  format: ExportFormat,
  mode: PrintMode,
  onProgress?: (completed: number, total: number) => void,
) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index];
    const blob = await createQrExport(input, format, mode);
    const folder = [input.branchSlug, input.group?.name || input.table?.groupName || "tables"]
      .filter((name): name is string => Boolean(name))
      .map(safeFileName)
      .join("/");
    const stem = exportFileName(input, format).slice(0, -(format.length + 1));
    let path = `${folder}/${stem}.${format}`;
    for (let suffix = 2; zip.file(path); suffix += 1)
      path = `${folder}/${stem}-${suffix}.${format}`;
    zip.file(path, blob);
    onProgress?.(index + 1, inputs.length);
  }
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}
