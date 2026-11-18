import {
  emptyPosReceiptDefaults,
  posQrTargets,
  posReceiptAlignments,
  posReceiptFields,
  posReceiptLanguages,
  posReceiptLimits,
  posReceiptTextSizes,
  posReceiptTypes,
  type PosReceiptDefaults,
  type PosReceiptField,
  type PosReceiptSettings,
  type PosReceiptTemplate,
} from "../../../shared/posReceipts";
import { choice, integer, invalid, object, optionalText, recordId, string } from "./posApiCore";

function readTemplate(value: unknown): PosReceiptTemplate {
  const row = object(value);
  const type = choice(row.type, "receipt template type", posReceiptTypes);
  if (!Array.isArray(row.fields)) invalid("Receipt template fields must be an array");
  const fields = row.fields.map((field) =>
    choice<PosReceiptField>(field, "receipt template field", posReceiptFields[type]),
  );
  if (new Set(fields).size !== fields.length) invalid("Receipt template fields must be unique");
  const limits = posReceiptLimits;
  const base = {
    id: recordId(row.id, "receipt template ID"),
    name: string(row.name, "receipt template name"),
    language: choice(row.language, "receipt language", posReceiptLanguages),
    paper_width_mm: integer(row.paper_width_mm, "paper width", limits.width.min, limits.width.max),
    print_copies: integer(row.print_copies, "print copies", limits.copies.min, limits.copies.max),
    title: optionalText(row.title, "receipt title", 120) ?? "",
    footer: optionalText(row.footer, "receipt footer", 500) ?? "",
    text_size: choice(row.text_size, "receipt text size", posReceiptTextSizes),
    heading_alignment: choice(row.heading_alignment, "receipt heading alignment", posReceiptAlignments),
    fields,
  };
  if (type !== "qr_label") {
    if (row.qr !== undefined) invalid("QR label settings require a QR label template");
    return { ...base, type };
  }

  const qr = object(row.qr);
  const labelHeight = integer(
    qr.label_height_mm, "label height", limits.labelHeight.min, limits.labelHeight.max,
  );
  const size = integer(qr.size_mm, "QR size", limits.qrSize.min, limits.qrSize.max);
  if (size > Math.min(base.paper_width_mm, labelHeight))
    invalid("The QR code must fit the label width and height");
  const target = choice(qr.target, "QR target", posQrTargets);
  const customUrl = optionalText(qr.custom_url, "custom QR URL", 1000) ?? "";
  if (target === "custom_url") {
    let url: URL;
    try {
      url = new URL(customUrl);
    } catch {
      invalid("Enter an absolute HTTP or HTTPS URL for the QR label");
    }
    if (!/^https?:\/\//i.test(customUrl) || !["http:", "https:"].includes(url.protocol))
      invalid("Enter an absolute HTTP or HTTPS URL for the QR label");
  }
  return {
    ...base,
    type,
    qr: {
      label_height_mm: labelHeight,
      size_mm: size,
      target,
      custom_url: customUrl,
      caption: optionalText(qr.caption, "QR caption", 120) ?? "",
    },
  };
}

export function readReceiptSettings(
  input: Record<string, unknown>,
  saved?: PosReceiptSettings,
): PosReceiptSettings {
  let templates = saved?.receipt_templates ?? [];
  if (input.receipt_templates !== undefined) {
    if (!Array.isArray(input.receipt_templates)) invalid("receipt_templates must be an array");
    templates = input.receipt_templates.map(readTemplate);
  }
  const byId = new Map(templates.map((template) => [template.id, template]));
  if (byId.size !== templates.length) invalid("Receipt template IDs must be unique within the profile");

  const requested = input.default_receipt_templates === undefined
    ? {}
    : object(input.default_receipt_templates);
  for (const key of Object.keys(requested))
    choice(key, "receipt default type", posReceiptTypes);
  const defaults: PosReceiptDefaults = { ...emptyPosReceiptDefaults };
  for (const type of posReceiptTypes) {
    const value = requested[type];
    const id = value === undefined
      ? saved?.default_receipt_templates?.[type]
      : value === null ? null : recordId(value, "default receipt template ID");
    const template = id ? byId.get(id) : undefined;
    if (value != null && template?.type !== type)
      invalid("Choose a receipt template of the matching type from this profile");
    defaults[type] = template?.type === type ? template.id : null;
  }
  return { receipt_templates: templates, default_receipt_templates: defaults };
}
