import { WorkerEntrypoint } from "cloudflare:workers";
import {
  catalogReaderPages,
  controlPageIds,
  priceListReaderPages,
  sellingControlPages,
  type ControlPage,
} from "../../../shared/controlPages";
import { distanceMeters } from "../../../shared/distanceMeters";
import { defaultMenuKhmerFont, menuKhmerFonts } from "../../../shared/menuFonts";
import {
  defaultQrFooterText,
  maxQrFooterTextLength,
  maxQrTablePrefixLength,
} from "../../../shared/qrDesign";
import { MAX_DAILY_ORDERS, type ManagedPlan } from "../../../shared/subscriptionPlans";
import {
  branchOrderColumns, branchOrderOverrides, branchOrderPolicy, findBranch, findMenuRoot, firstActiveMenuRoot, listBranches, orderMenuSections, ownsPortionBranches,
  visibleMenuAssignments, visibleMenuIds, type Branch, type MenuRoot,
} from "./catalogScope";
import { isOrderStatusUpdate, updateOrderStatus } from "./orderStatus";
import { connectPosOrderEvents, OrderEvents } from "./orderEvents";
import { handlePosOrders } from "./posOrders";
import { handlePosApi } from "./posApi";
import { isPosAdminPath, isPosApiPath, posAdminPath } from "./posApiCore";
import { handlePosSetup } from "./posApiSetup";
import { adminBookings, publicBookings } from "./bookings";
import { resetBusinessData } from "./businessReset";
import { clearWebhookHistory, manageBranchWebhooks, type WebhookAdminAction } from "./webhookAdmin";
import { runBranchWebhookScheduler, scheduleBranchWebhooks } from "./webhookDelivery";
import { captureWebhook } from "./webhookEvents";
import { bookingWorkspaceAccess, manageBookingSettings } from "./bookingSettings";
import { retryBookingAlerts } from "./bookingTelegram";
import { adminTelegramNotifications, canManageTelegramNotifications, deliverTelegramNotifications, telegramDeliveryExpiresAt } from "./telegramNotifications";
import {
  DEFAULT_PLAN_ID, parsePlanLimits, parsePlanPos, planFeatures, planLimitError, planOfferFields, planOfferJoin, publicPlans,
  selectedPlan, serializePlan, type PlanOfferRow,
} from "./subscriptionPlans";
import { deliverTelegramOrder, retryTelegramOrders } from "./telegramOrders";
import {
  getPosIntegration,
  handlePosIntegration,
  handlePosSync,
  issuePosApiKey,
  revokePosIntegration,
} from "./posSync";

export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  ALLOWED_ORIGINS: string;
  POS_ALLOWED_ORIGINS?: string;
  PUBLIC_ASSET_BASE: string;
  PUBLIC_MEDIA_BASE?: string;
  AUTH_PEPPER: string;
  PASSWORD_RESET_KEY?: string;
  WEBHOOK_ALLOW_LOCAL_HTTP?: string;
  ADMIN_APP_URL?: string;
  CATALOG_CACHE: KVNamespace;
  ORDER_EVENTS?: DurableObjectNamespace<OrderEvents>;
}

export { OrderEvents };

type Json = Record<string, unknown>;
type SessionContext = {
  userId: string;
  businessId: string;
  role: string;
  sessionType: string;
  actorEmail: string | null;
  expiresAt: string;
  timezone: string;
  disabledControlPagesJson: string;
  canViewBookings: number;
  subscriptionFeaturesJson: string | null;
  posEnabled: number;
  subscriptionPlanCode: string | null;
  subscriptionPlanName: string | null;
  subscriptionSource: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEndAt: string | null;
};
type SubscriptionRow = {
  subscriptionPlanCode?: string | null;
  subscriptionPlanName?: string | null;
  subscriptionSource?: string | null;
  subscriptionStatus?: string | null;
  trialEndsAt?: string | null;
  currentPeriodEndAt?: string | null;
};
type SubscriptionSummary = {
  planCode: string;
  planName: string;
  source: string;
  status: "trialing" | "active" | "expired" | "unlimited";
  expiresAt: string | null;
  expiresOn: string | null;
  daysRemaining: number | null;
  readOnly: boolean;
};
type PriceEntryInput = {
  priceListId: string;
  targetKey: string;
  priceCents: number | null;
};

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
const recordSlug = (value: string, fallback: string, recordId: string) =>
  `${slugify(value) || fallback}-${recordId.slice(-8)}`;
const catalogCacheKey = (
  slug: string,
  version: number,
  priceListId: string,
  bannerState: string,
  env: Env,
) => {
  const mediaBase =
    env.PUBLIC_MEDIA_BASE?.trim().replace(/\/$/, "") || "worker";
  return `catalog:v13:${mediaBase}:${slug}:${version}:${priceListId}:${bannerState}`;
};
const workerMediaUrl = (env: Env, mediaId: string) =>
  `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${mediaId}`;
const mediaUrl = (env: Env, objectKey: unknown, fallback = "") => {
  const publicBase = env.PUBLIC_MEDIA_BASE?.trim().replace(/\/$/, "");
  if (!publicBase || !objectKey) return fallback;
  const encodedKey = String(objectKey)
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return `${publicBase}/${encodedKey}`;
};
const id = (prefix: string) =>
  `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
const RECORD_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const PRODUCT_OPTION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;
const visibleCategoryIds = `WITH RECURSIVE visible_category_ids(id) AS (
  SELECT id FROM categories
  WHERE business_id = ? AND is_active = 1 AND parent_id IS NULL
  UNION ALL
  SELECT child.id FROM categories child
  JOIN visible_category_ids parent ON child.parent_id = parent.id
  WHERE child.business_id = ? AND child.is_active = 1
)`;
const LOCAL_DATE_TIME_PATTERN =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d$/;
const bytesToHex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
const hexToBytes = (hex: string) =>
  new Uint8Array(hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? []);

const AUTH_SCHEME = "client-pbkdf2-sha256-v1";
const PASSWORD_PROOF_PATTERN = /^[a-f0-9]{64}$/;
const BUSINESS_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const businessSlugOwner = (db: D1Database, slug: string) => db.prepare(
  `SELECT id FROM businesses WHERE slug=?1
   UNION ALL SELECT business_id AS id FROM business_slug_aliases WHERE slug=?1`,
).bind(slug).first<{ id: string }>();
const businessSlugConflict = (error: unknown) =>
  /BUSINESS_SLUG_IN_USE|UNIQUE constraint failed: businesses\.slug/.test(String(error));
const LOCAL_DATE_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const ANALYTICS_EVENT_TYPES = new Set([
  "menu_open",
  "product_view",
  "favourite_add",
  "favourite_remove",
  "category_select",
  "search",
  "banner_impression",
  "banner_open",
  "banner_cta_click",
  "contact_click",
  "language_change",
]);
const ANALYTICS_LANGUAGES = new Set(["km", "en", "zh"]);
const ANALYTICS_ACTIONS = new Set([
  "phone",
  "email",
  "website",
  "map",
  "social",
  "wifi",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function localDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

function endOfLocalDateUtc(value: string, timeZone: string) {
  if (!LOCAL_DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  )
    return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(parsed);
  } catch {
    return null;
  }
  const target = Date.UTC(year, month - 1, day + 1);
  let guess = target;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(guess))
        .map((part) => [part.type, part.value]),
    );
    const rendered = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    guess += target - rendered;
  }
  return new Date(guess).toISOString();
}

function subscriptionSummary(
  row: SubscriptionRow,
  timeZone = "UTC",
  now = Date.now(),
): SubscriptionSummary {
  const expiresAt = row.currentPeriodEndAt || null;
  const end = expiresAt ? Date.parse(expiresAt) : Number.POSITIVE_INFINITY;
  const lifecycleBlocked = ["past_due", "canceled"].includes(
    String(row.subscriptionStatus || "active"),
  );
  const expired = lifecycleBlocked || Number.isNaN(end) || end <= now;
  const status = expired
    ? "expired"
    : !expiresAt
      ? "unlimited"
      : row.subscriptionStatus === "trialing"
        ? "trialing"
        : "active";
  let expiresOn: string | null = null;
  if (expiresAt && !Number.isNaN(end)) {
    try {
      expiresOn = localDateKey(new Date(end - 1), timeZone);
    } catch {
      expiresOn = expiresAt.slice(0, 10);
    }
  }
  return {
    planCode: row.subscriptionPlanCode || "standard",
    planName: row.subscriptionPlanName || "Standard",
    source: row.subscriptionSource || "manual",
    status,
    expiresAt,
    expiresOn,
    daysRemaining:
      expiresAt && !Number.isNaN(end)
        ? Math.max(0, Math.ceil((end - now) / 864e5))
        : null,
    readOnly: expired,
  };
}
const QR_PRESETS = new Set([
  "table-card",
  "table-tent",
  "acrylic-stand",
  "a4-poster",
]);
const QR_FONTS = new Set([
  "Manrope",
  "DM Sans",
  "Noto Sans Khmer",
  "Noto Sans SC",
]);
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const blendHexColors = (
  foreground: string,
  background: string,
  opacity = 0.5,
) => {
  const channel = (hex: string, offset: number) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16);
  return `#${[1, 3, 5]
    .map((offset) =>
      Math.round(
        channel(foreground, offset) * opacity +
          channel(background, offset) * (1 - opacity),
      )
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
};
const relativeLuminance = (hex: string) => {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const colorContrastRatio = (first: string, second: string) => {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
};
const readableColor = (background: string) =>
  relativeLuminance(background) > 0.42 ? "#111111" : "#ffffff";
const MENU_THEME_PRESETS = new Set(["warm", "minimal", "garden", "elegant"]);
const MENU_THEME_MODES = new Set(["light", "dark"]);
const MENU_THEME_FONTS = new Set([
  "Manrope",
  "DM Sans",
  "Noto Sans Khmer",
  "Noto Sans SC",
  "System UI",
]);
const MENU_THEME_KHMER_FONTS = new Set<string>(menuKhmerFonts);
const MENU_CARD_STYLES = new Set(["flat", "bordered", "shadow"]);
const MENU_CORNER_STYLES = new Set(["square", "soft", "rounded"]);
const MENU_IMAGE_RATIOS = new Set(["square", "landscape", "portrait"]);
const MENU_PRODUCT_VIEWS = new Set(["grid", "list"]);
const MENU_BOTTOM_NAV_STYLES = new Set([
  "simple",
  "modern",
  "floating",
  "glass",
]);
const MENU_HEADER_STYLES = new Set(["banner", "solid", "minimal"]);
const MENU_CATEGORY_STYLES = new Set(["pills", "underline", "images"]);
const MENU_BACKGROUND_TYPES = new Set(["color", "pattern", "image"]);
const MENU_BACKGROUND_PATTERNS = new Set([
  "dots",
  "waves",
  "grid",
  "khmer-diamond",
  "terrazzo",
  "paper",
  "khmer-new-year",
  "pchum-ben",
  "water-festival",
  "visak-bochea",
  "rice-harvest",
  "khmer-heritage",
]);
const MENU_BACKGROUND_FITS = new Set(["cover", "tile"]);
const menuThemeImageFields = [
  {
    mediaId: "backgroundImageMediaId",
    url: "backgroundImageUrl",
    missingMessage: "Background image was not found",
  },
  {
    mediaId: "productPlaceholderMediaId",
    url: "productPlaceholderUrl",
    missingMessage: "Product photo placeholder was not found",
  },
] as const;

const defaultMenuTheme = (primaryColor = "#e84231") => ({
  version: 1,
  preset: "warm",
  mode: "light",
  primaryColor: HEX_COLOR.test(primaryColor)
    ? primaryColor.toLowerCase()
    : "#e84231",
  accentColor: "#b7e46c",
  backgroundColor: "#faf8f2",
  surfaceColor: "#ffffff",
  textColor: "#1b1b19",
  businessNameColor: "#1b1b19",
  businessNameFontSize: 24,
  menuItemTitleColor: "#1b1b19",
  menuItemTitleFontSize: 16,
  categoryTitleColor: "#1b1b19",
  categoryTitleFontSize: 30,
  categoryFilterColor: "#1b1b19",
  categoryFilterFontSize: 14,
  descriptionColor: "#8d8d8c",
  descriptionFontSize: 14,
  primaryPriceColor: HEX_COLOR.test(primaryColor)
    ? primaryColor.toLowerCase()
    : "#e84231",
  primaryPriceFontSize: 16,
  secondaryPriceColor: HEX_COLOR.test(primaryColor)
    ? primaryColor.toLowerCase()
    : "#e84231",
  secondaryPriceFontSize: 12,
  headingFont: "Manrope",
  bodyFont: "DM Sans",
  khmerFont: defaultMenuKhmerFont,
  cardStyle: "shadow",
  cornerStyle: "rounded",
  imageRatio: "landscape",
  productPlaceholderMediaId: "",
  productPlaceholderUrl: "",
  defaultProductView: "grid",
  showItemCode: false,
  itemCodeColor: "#8d8d8c",
  itemCodeFontSize: 10,
  showBottomNav: true,
  showSearchNav: true,
  bottomNavStyle: "modern",
  bottomNavBackgroundColor: "#ffffff",
  bottomNavTextColor: "#666660",
  bottomNavActiveColor: HEX_COLOR.test(primaryColor)
    ? primaryColor.toLowerCase()
    : "#e84231",
  bottomNavFontSize: 13,
  headerStyle: "banner",
  categoryStyle: "images",
  backgroundType: "color",
  backgroundPattern: "paper",
  backgroundPatternColor: HEX_COLOR.test(primaryColor)
    ? primaryColor.toLowerCase()
    : "#e84231",
  backgroundPatternOpacity: 8,
  backgroundImageMediaId: "",
  backgroundImageUrl: "",
  backgroundImageFit: "cover",
  backgroundImagePositionX: 50,
  backgroundImagePositionY: 50,
  backgroundOverlayColor: "#1b1b19",
  backgroundOverlayOpacity: 20,
});

function menuTheme(value: unknown, legacyPrimary = "#e84231") {
  const input = (value && typeof value === "object" ? value : {}) as Record<
    string,
    unknown
  >;
  const base = defaultMenuTheme(legacyPrimary);
  const choice = (key: string, allowed: Set<string>, fallback: string) => {
    const candidate = String(input[key] ?? "");
    return allowed.has(candidate) ? candidate : fallback;
  };
  const color = (key: string, fallback: string) => {
    const candidate = String(input[key] ?? "");
    return HEX_COLOR.test(candidate) ? candidate.toLowerCase() : fallback;
  };
  const number = (key: string, fallback: number, min: number, max: number) => {
    const candidate = Number(input[key]);
    return Number.isFinite(candidate) && candidate >= min && candidate <= max
      ? Math.round(candidate)
      : fallback;
  };
  const clampedNumber = (
    key: string,
    fallback: number,
    min: number,
    max: number,
  ) => {
    const candidate = Number(input[key]);
    return Number.isFinite(candidate)
      ? Math.min(max, Math.max(min, Math.round(candidate)))
      : fallback;
  };
  const mediaId = String(input.backgroundImageMediaId ?? "").trim();
  const placeholderId = String(input.productPlaceholderMediaId ?? "").trim();
  const storedImageUrl = String(input.backgroundImageUrl ?? "")
    .trim()
    .slice(0, 1000);
  const resolvedTextColor = color("textColor", base.textColor);
  const resolvedSurfaceColor = color("surfaceColor", base.surfaceColor);
  const resolvedDescriptionColor = color(
    "descriptionColor",
    blendHexColors(resolvedTextColor, resolvedSurfaceColor),
  );
  const resolvedPrimaryColor = color("primaryColor", base.primaryColor);
  const resolvedAccentColor = color("accentColor", base.accentColor);
  const legacyBottomNavTextColor = blendHexColors(
    readableColor(resolvedSurfaceColor),
    resolvedSurfaceColor,
    0.58,
  );
  const legacyBottomNavActiveColor =
    [resolvedPrimaryColor, resolvedAccentColor, resolvedTextColor].find(
      (candidate) => colorContrastRatio(candidate, resolvedSurfaceColor) >= 3,
    ) || readableColor(resolvedSurfaceColor);
  return {
    version: 1,
    preset: choice("preset", MENU_THEME_PRESETS, base.preset),
    mode: choice("mode", MENU_THEME_MODES, base.mode),
    primaryColor: resolvedPrimaryColor,
    accentColor: resolvedAccentColor,
    backgroundColor: color("backgroundColor", base.backgroundColor),
    surfaceColor: resolvedSurfaceColor,
    textColor: resolvedTextColor,
    businessNameColor: color("businessNameColor", resolvedTextColor),
    businessNameFontSize: clampedNumber(
      "businessNameFontSize",
      base.businessNameFontSize,
      18,
      36,
    ),
    menuItemTitleColor: color("menuItemTitleColor", resolvedTextColor),
    menuItemTitleFontSize: clampedNumber(
      "menuItemTitleFontSize",
      base.menuItemTitleFontSize,
      12,
      24,
    ),
    categoryTitleColor: color("categoryTitleColor", resolvedTextColor),
    categoryTitleFontSize: clampedNumber(
      "categoryTitleFontSize",
      base.categoryTitleFontSize,
      20,
      40,
    ),
    categoryFilterColor: color("categoryFilterColor", resolvedTextColor),
    categoryFilterFontSize: clampedNumber(
      "categoryFilterFontSize",
      base.categoryFilterFontSize,
      10,
      20,
    ),
    descriptionColor: resolvedDescriptionColor,
    descriptionFontSize: clampedNumber(
      "descriptionFontSize",
      base.descriptionFontSize,
      11,
      20,
    ),
    primaryPriceColor: color(
      "primaryPriceColor",
      color("primaryColor", base.primaryColor),
    ),
    primaryPriceFontSize: number(
      "primaryPriceFontSize",
      base.primaryPriceFontSize,
      10,
      32,
    ),
    secondaryPriceColor: color(
      "secondaryPriceColor",
      color("primaryColor", base.primaryColor),
    ),
    secondaryPriceFontSize: number(
      "secondaryPriceFontSize",
      base.secondaryPriceFontSize,
      8,
      24,
    ),
    headingFont: choice("headingFont", MENU_THEME_FONTS, base.headingFont),
    bodyFont: choice("bodyFont", MENU_THEME_FONTS, base.bodyFont),
    khmerFont: choice("khmerFont", MENU_THEME_KHMER_FONTS, base.khmerFont),
    cardStyle: choice("cardStyle", MENU_CARD_STYLES, base.cardStyle),
    cornerStyle: choice("cornerStyle", MENU_CORNER_STYLES, base.cornerStyle),
    imageRatio: choice("imageRatio", MENU_IMAGE_RATIOS, base.imageRatio),
    defaultProductView: choice(
      "defaultProductView",
      MENU_PRODUCT_VIEWS,
      base.defaultProductView,
    ),
    showItemCode:
      typeof input.showItemCode === "boolean"
        ? input.showItemCode
        : base.showItemCode,
    itemCodeColor: color("itemCodeColor", resolvedDescriptionColor),
    itemCodeFontSize: clampedNumber(
      "itemCodeFontSize",
      base.itemCodeFontSize,
      8,
      18,
    ),
    showBottomNav:
      typeof input.showBottomNav === "boolean"
        ? input.showBottomNav
        : base.showBottomNav,
    showSearchNav:
      typeof input.showSearchNav === "boolean"
        ? input.showSearchNav
        : base.showSearchNav,
    bottomNavStyle: choice(
      "bottomNavStyle",
      MENU_BOTTOM_NAV_STYLES,
      base.bottomNavStyle,
    ),
    bottomNavBackgroundColor: color(
      "bottomNavBackgroundColor",
      resolvedSurfaceColor,
    ),
    bottomNavTextColor: color("bottomNavTextColor", legacyBottomNavTextColor),
    bottomNavActiveColor: color(
      "bottomNavActiveColor",
      legacyBottomNavActiveColor,
    ),
    bottomNavFontSize: clampedNumber(
      "bottomNavFontSize",
      base.bottomNavFontSize,
      10,
      18,
    ),
    headerStyle: choice("headerStyle", MENU_HEADER_STYLES, base.headerStyle),
    categoryStyle: choice(
      "categoryStyle",
      MENU_CATEGORY_STYLES,
      base.categoryStyle,
    ),
    backgroundType: choice(
      "backgroundType",
      MENU_BACKGROUND_TYPES,
      base.backgroundType,
    ),
    backgroundPattern: choice(
      "backgroundPattern",
      MENU_BACKGROUND_PATTERNS,
      base.backgroundPattern,
    ),
    backgroundPatternColor: color(
      "backgroundPatternColor",
      base.backgroundPatternColor,
    ),
    backgroundPatternOpacity: number(
      "backgroundPatternOpacity",
      base.backgroundPatternOpacity,
      0,
      40,
    ),
    backgroundImageMediaId: RECORD_ID_PATTERN.test(mediaId) ? mediaId : "",
    backgroundImageUrl: storedImageUrl,
    productPlaceholderMediaId: RECORD_ID_PATTERN.test(placeholderId)
      ? placeholderId
      : "",
    productPlaceholderUrl: String(input.productPlaceholderUrl ?? "")
      .trim()
      .slice(0, 1000),
    backgroundImageFit: choice(
      "backgroundImageFit",
      MENU_BACKGROUND_FITS,
      base.backgroundImageFit,
    ),
    backgroundImagePositionX: number(
      "backgroundImagePositionX",
      base.backgroundImagePositionX,
      0,
      100,
    ),
    backgroundImagePositionY: number(
      "backgroundImagePositionY",
      base.backgroundImagePositionY,
      0,
      100,
    ),
    backgroundOverlayColor: color(
      "backgroundOverlayColor",
      base.backgroundOverlayColor,
    ),
    backgroundOverlayOpacity: number(
      "backgroundOverlayOpacity",
      base.backgroundOverlayOpacity,
      0,
      90,
    ),
  };
}

function parseMenuTheme(value: unknown, legacyPrimary: unknown, env: Env) {
  try {
    const theme = menuTheme(
      JSON.parse(String(value || "{}")),
      String(legacyPrimary || "#e84231"),
    );
    theme.productPlaceholderUrl = theme.productPlaceholderMediaId
      ? workerMediaUrl(env, theme.productPlaceholderMediaId)
      : "";
    return theme;
  } catch {
    return defaultMenuTheme(String(legacyPrimary || "#e84231"));
  }
}
const defaultQrConfig = () => ({
  version: 1,
  branchSlug: "",
  menuSlug: "",
  showTableGroup: true,
  tablePrefix: "",
  businessNameMode: "profile",
  taglineMode: "profile",
  customBusinessName: "",
  customTagline: "",
  ctaText: "Scan to view our menu",
  showFooterText: true,
  footerText: defaultQrFooterText,
  showLogo: true,
  showBusinessName: true,
  backgroundType: "color",
  backgroundColor: "#10231d",
  backgroundImageUrl: "",
  backgroundPositionX: 50,
  backgroundPositionY: 50,
  overlayColor: "#10231d",
  overlayOpacity: 20,
  textColor: "#ffffff",
  accentColor: "#a6ef67",
  qrDarkColor: "#10231d",
  qrLightColor: "#ffffff",
  fontFamily: "Manrope",
  headingSize: 34,
  taglineSize: 16,
  ctaSize: 17,
  logoScale: 20,
  qrScale: 46,
  qrPositionY: 46,
  alignment: "center",
  customWidthMm: 100,
  customHeightMm: 150,
});

function qrConfig(value: unknown) {
  const input = (value ?? {}) as Record<string, unknown>;
  const base = defaultQrConfig();
  const text = (key: string, fallback: string, max: number) =>
    String(input[key] ?? fallback)
      .trim()
      .slice(0, max);
  const number = (key: string, fallback: number, min: number, max: number) => {
    const parsed = Number(input[key] ?? fallback);
    return Number.isFinite(parsed) && parsed >= min && parsed <= max
      ? parsed
      : fallback;
  };
  const scopeSlug = (key: "branchSlug" | "menuSlug") => {
    const slug = text(key, "", 80);
    return BUSINESS_SLUG_PATTERN.test(slug) ? slug : "";
  };
  const color = (key: string, fallback: string) => {
    const parsed = String(input[key] ?? fallback);
    return HEX_COLOR.test(parsed) ? parsed.toLowerCase() : fallback;
  };
  const businessNameMode =
    input.businessNameMode === "custom" ? "custom" : "profile";
  const taglineMode = input.taglineMode === "custom" ? "custom" : "profile";
  const backgroundType = input.backgroundType === "image" ? "image" : "color";
  const alignment = ["left", "center", "right"].includes(
    String(input.alignment),
  )
    ? String(input.alignment)
    : base.alignment;
  const fontFamily = QR_FONTS.has(String(input.fontFamily))
    ? String(input.fontFamily)
    : base.fontFamily;
  return {
    version: 1,
    branchSlug: scopeSlug("branchSlug"),
    menuSlug: scopeSlug("menuSlug"),
    showTableGroup: input.showTableGroup !== false,
    tablePrefix: text("tablePrefix", base.tablePrefix, maxQrTablePrefixLength),
    businessNameMode,
    taglineMode,
    customBusinessName: text("customBusinessName", "", 100),
    customTagline: text("customTagline", "", 180),
    ctaText: text("ctaText", base.ctaText, 120),
    showFooterText: input.showFooterText !== false,
    footerText: text("footerText", base.footerText, maxQrFooterTextLength),
    showLogo: input.showLogo !== false,
    showBusinessName: input.showBusinessName !== false,
    backgroundType,
    backgroundColor: color("backgroundColor", base.backgroundColor),
    backgroundImageUrl: text("backgroundImageUrl", "", 1000),
    backgroundPositionX: number("backgroundPositionX", 50, 0, 100),
    backgroundPositionY: number("backgroundPositionY", 50, 0, 100),
    overlayColor: color("overlayColor", base.overlayColor),
    overlayOpacity: number("overlayOpacity", 20, 0, 90),
    textColor: color("textColor", base.textColor),
    accentColor: color("accentColor", base.accentColor),
    qrDarkColor: color("qrDarkColor", base.qrDarkColor),
    qrLightColor: color("qrLightColor", base.qrLightColor),
    fontFamily,
    headingSize: number("headingSize", 34, 16, 72),
    taglineSize: number("taglineSize", 16, 8, 36),
    ctaSize: number("ctaSize", 17, 8, 36),
    logoScale: number("logoScale", 20, 8, 38),
    qrScale: number("qrScale", 46, 28, 62),
    qrPositionY: number("qrPositionY", 46, 42, 60),
    alignment,
    customWidthMm: number("customWidthMm", 100, 50, 420),
    customHeightMm: number("customHeightMm", 150, 50, 420),
  };
}

function hydrateQrDesign(row: Record<string, unknown>, env: Env) {
  const {
    configJson,
    backgroundObjectKey: _backgroundObjectKey,
    ...design
  } = row;
  let config = defaultQrConfig();
  try {
    config = qrConfig(JSON.parse(String(configJson || "{}")));
  } catch {
    // Keep a safe, printable default for malformed legacy rows.
  }
  if (design.backgroundMediaId) {
    config.backgroundImageUrl = `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${design.backgroundMediaId}`;
  }
  return { ...design, config };
}

async function qrCategoryBrowsingEnabled(db: D1Database, businessId: string) {
  const enabled = await db.prepare("SELECT allow_category_browsing FROM businesses WHERE id=?")
    .bind(businessId)
    .first<number>("allow_category_browsing");
  return enabled === 1;
}

async function hashToken(token: string) {
  return bytesToHex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
  );
}

function authConfigured(env: Env) {
  return typeof env.AUTH_PEPPER === "string" && env.AUTH_PEPPER.length >= 32;
}

async function credentialHash(
  passwordProof: string,
  pepper: string,
  storedSalt?: string,
) {
  const saltHex = storedSalt?.startsWith(`${AUTH_SCHEME}$`)
    ? storedSalt.slice(AUTH_SCHEME.length + 1)
    : bytesToHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  if (!/^[a-f0-9]{32}$/.test(saltHex)) throw new Error("Invalid auth salt");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const hash = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${AUTH_SCHEME}:${saltHex}:${passwordProof}`),
  );
  return {
    hash: bytesToHex(hash),
    salt: `${AUTH_SCHEME}$${saltHex}`,
  };
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function verifyAccount(env: Env, email: string, proof: string) {
  const account = await env.DB.prepare(
    "SELECT id,email,display_name AS displayName,password_hash AS passwordHash,password_salt AS passwordSalt FROM users WHERE email=?",
  ).bind(email).first<{ id: string; email: string; displayName: string; passwordHash: string; passwordSalt: string }>();
  if (!account) return { status: "invalid" } as const;
  if (!account.passwordSalt.startsWith(`${AUTH_SCHEME}$`)) return { status: "reset_required" } as const;
  const incoming = await credentialHash(proof, env.AUTH_PEPPER, account.passwordSalt);
  return safeEqual(incoming.hash, account.passwordHash)
    ? { status: "verified", account } as const
    : { status: "invalid" } as const;
}

function cors(request: Request, env: Env): Record<string, string> {
  const path = new URL(request.url).pathname;
  if (path.startsWith("/api/public/")) {
    return { "access-control-allow-origin": "*" };
  }
  const origin = request.headers.get("origin") ?? "";
  if (isPosApiPath(path)) {
    const allowed = (env.POS_ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim());
    return origin && allowed.includes(origin)
      ? { "access-control-allow-origin": origin, vary: "Origin" }
      : { vary: "Origin" };
  }
  const allowed = env.ALLOWED_ORIGINS.split(",").map((x) => x.trim());
  return allowed.includes(origin)
    ? {
        "access-control-allow-origin": origin,
        "access-control-allow-credentials": "true",
        vary: "Origin",
      }
    : {};
}

async function readJson(request: Request): Promise<Json> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new Error("Expected JSON body");
  return request.json() as Promise<Json>;
}

function jsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function localDateTimeNow(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function analyticsLocalNow(timeZone: string) {
  const value = localDateTimeNow(timeZone);
  return {
    localDate: value.slice(0, 10),
    localHour: Number(value.slice(11, 13)),
  };
}

function normalizeSearchTerm(value: unknown) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase()
    .slice(0, 80);
}

function reportDate(value: string) {
  if (!LOCAL_DATE_PATTERN.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
    ? null
    : parsed;
}

function shiftDate(value: string, days: number) {
  const parsed = reportDate(value);
  if (!parsed) return "";
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function analyticsFilter(
  businessId: string,
  from: string,
  to: string,
  language: string,
  tableId: string,
  groupId: string,
  branchId: string,
  alias = "event",
) {
  return {
    sql: `${alias}.business_id=? AND ${alias}.local_date BETWEEN ? AND ?
      AND (?='' OR ${alias}.language=?)
      AND (?='' OR ${alias}.table_id=?)
      AND (?='' OR ${alias}.branch_id=?)
      AND (?='' OR ${alias}.table_id IN (
        SELECT id FROM restaurant_tables
        WHERE business_id=? AND group_id=?
      ))`,
    values: [
      businessId,
      from,
      to,
      language,
      language,
      tableId,
      tableId,
      branchId,
      branchId,
      groupId,
      businessId,
      groupId,
    ],
  };
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvResponse(rows: Array<Record<string, unknown>>, filename: string) {
  const columns = rows.length ? Object.keys(rows[0]) : ["message"];
  const data = rows.length
    ? rows
    : [{ message: "No data for the selected period" }];
  const csv = [
    columns.map(csvCell).join(","),
    ...data.map((row) =>
      columns.map((column) => csvCell(row[column])).join(","),
    ),
  ].join("\r\n");
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}

async function analyticsReport(
  env: Env,
  businessId: string,
  range: {
    from: string;
    to: string;
    previousFrom: string;
    previousTo: string;
    language: string;
    tableId: string;
    groupId: string;
    branchId: string;
  },
) {
  const current = analyticsFilter(
    businessId,
    range.from,
    range.to,
    range.language,
    range.tableId,
    range.groupId,
    range.branchId,
    "event",
  );
  const previous = analyticsFilter(
    businessId,
    range.previousFrom,
    range.previousTo,
    range.language,
    range.tableId,
    range.groupId,
    range.branchId,
    "event",
  );
  const summarySql = (filter: string) => `SELECT
    SUM(CASE WHEN event.event_type='menu_open' THEN 1 ELSE 0 END) AS menuOpens,
    COUNT(DISTINCT CASE WHEN event.event_type='menu_open' THEN event.session_id END) AS menuSessions,
    COUNT(DISTINCT CASE WHEN event.event_type IN
      ('product_view','favourite_add','favourite_remove','category_select','search',
       'banner_open','banner_cta_click','contact_click','language_change')
      THEN event.session_id END) AS engagedSessions,
    SUM(CASE WHEN event.event_type='product_view' THEN 1 ELSE 0 END) AS productViews,
    SUM(CASE WHEN event.event_type='favourite_add' THEN 1 ELSE 0 END) AS favouriteAdds
    FROM analytics_events event WHERE ${filter}`;

  const [
    summaryResult,
    previousResult,
    dailyResult,
    hourlyResult,
    productResult,
    categoryResult,
    tableResult,
    searchResult,
    promotionResult,
    actionResult,
    languageResult,
    sourceResult,
  ] = await Promise.all([
    env.DB.prepare(summarySql(current.sql))
      .bind(...current.values)
      .first(),
    env.DB.prepare(summarySql(previous.sql))
      .bind(...previous.values)
      .first(),
    env.DB.prepare(
      `SELECT event.local_date AS date,
        SUM(CASE WHEN event.event_type='menu_open' THEN 1 ELSE 0 END) AS menuOpens,
        COUNT(DISTINCT CASE WHEN event.event_type='menu_open' THEN event.session_id END) AS menuSessions,
        COUNT(DISTINCT CASE WHEN event.event_type IN
          ('product_view','favourite_add','favourite_remove','category_select','search',
           'banner_open','banner_cta_click','contact_click','language_change')
          THEN event.session_id END) AS engagedSessions,
        SUM(CASE WHEN event.event_type='product_view' THEN 1 ELSE 0 END) AS productViews
       FROM analytics_events event WHERE ${current.sql}
       GROUP BY event.local_date ORDER BY event.local_date`,
    )
      .bind(...current.values)
      .all(),
    env.DB.prepare(
      `SELECT event.local_hour AS hour,
        COUNT(DISTINCT CASE WHEN event.event_type='menu_open' THEN event.session_id END) AS menuSessions,
        SUM(CASE WHEN event.event_type='product_view' THEN 1 ELSE 0 END) AS productViews
       FROM analytics_events event WHERE ${current.sql}
       GROUP BY event.local_hour ORDER BY event.local_hour`,
    )
      .bind(...current.values)
      .all(),
    env.DB.prepare(
      `SELECT product.id,COALESCE(product.name_km,product.name) AS name,
        COUNT(CASE WHEN event.event_type='product_view' THEN 1 END) AS views,
        COUNT(DISTINCT CASE WHEN event.event_type='product_view' THEN event.session_id END) AS viewingSessions,
        COUNT(CASE WHEN event.event_type='favourite_add' THEN 1 END) AS favouriteAdds,
        COUNT(CASE WHEN event.event_type='favourite_remove' THEN 1 END) AS favouriteRemoves
       FROM products product LEFT JOIN analytics_events event
        ON event.product_id=product.id AND ${current.sql}
       WHERE product.business_id=?
       GROUP BY product.id,product.name_km,product.name
       HAVING views>0 OR viewingSessions>0 OR favouriteAdds>0 OR favouriteRemoves>0
       ORDER BY views DESC,favouriteAdds DESC,name LIMIT 5000`,
    )
      .bind(...current.values, businessId)
      .all(),
    env.DB.prepare(
      `SELECT category.id,COALESCE(category.name_km,category.name) AS name,
        COUNT(CASE WHEN event.event_type='category_select' THEN 1 END) AS selections,
        COUNT(DISTINCT CASE WHEN event.event_type='category_select' THEN event.session_id END) AS sessions
       FROM categories category LEFT JOIN analytics_events event
        ON event.category_id=category.id AND ${current.sql}
       WHERE category.business_id=?
       GROUP BY category.id,category.name_km,category.name
       HAVING selections>0 OR sessions>0
       ORDER BY selections DESC,name`,
    )
      .bind(...current.values, businessId)
      .all(),
    env.DB.prepare(
      `SELECT tables.id,tables.group_id AS groupId,tables.branch_id AS branchId,tables.code,tables.label,groups.name AS groupName,
        COUNT(DISTINCT CASE WHEN event.event_type='menu_open' THEN event.session_id END) AS menuSessions,
        COUNT(DISTINCT CASE WHEN event.event_type IN
          ('product_view','favourite_add','favourite_remove','category_select','search',
           'banner_open','banner_cta_click','contact_click','language_change')
          THEN event.session_id END) AS engagedSessions,
        SUM(CASE WHEN event.event_type='product_view' THEN 1 ELSE 0 END) AS productViews
       FROM restaurant_tables tables
       JOIN table_groups groups ON groups.id=tables.group_id
        AND groups.business_id=tables.business_id
       LEFT JOIN analytics_events event ON event.table_id=tables.id AND ${current.sql}
       WHERE tables.business_id=?
       GROUP BY tables.id,tables.group_id,tables.branch_id,tables.code,tables.label,groups.name
       HAVING menuSessions>0 OR engagedSessions>0 OR productViews>0
       ORDER BY menuSessions DESC,groups.name,tables.sort_order`,
    )
      .bind(...current.values, businessId)
      .all(),
    env.DB.prepare(
      `SELECT event.search_term AS term,COUNT(*) AS searches,
        SUM(CASE WHEN event.search_result_count=0 THEN 1 ELSE 0 END) AS noResultSearches,
        MAX(event.search_result_count) AS maxResults
       FROM analytics_events event
       WHERE ${current.sql} AND event.event_type='search'
       GROUP BY event.search_term ORDER BY searches DESC,term LIMIT 100`,
    )
      .bind(...current.values)
      .all(),
    env.DB.prepare(
      `SELECT banner.id,banner.title,
        COUNT(CASE WHEN event.event_type='banner_impression' THEN 1 END) AS impressions,
        COUNT(CASE WHEN event.event_type='banner_open' THEN 1 END) AS opens,
        COUNT(CASE WHEN event.event_type='banner_cta_click' THEN 1 END) AS ctaClicks
       FROM banners banner LEFT JOIN analytics_events event
        ON event.banner_id=banner.id AND ${current.sql}
       WHERE banner.business_id=?
       GROUP BY banner.id,banner.title
       HAVING impressions>0 OR opens>0 OR ctaClicks>0
       ORDER BY impressions DESC,banner.title`,
    )
      .bind(...current.values, businessId)
      .all(),
    env.DB.prepare(
      `SELECT event.action_kind AS action,COUNT(*) AS actions,
        COUNT(DISTINCT event.session_id) AS sessions
       FROM analytics_events event
       WHERE ${current.sql} AND event.event_type='contact_click'
       GROUP BY event.action_kind ORDER BY actions DESC`,
    )
      .bind(...current.values)
      .all(),
    env.DB.prepare(
      `SELECT event.language,
        COUNT(DISTINCT CASE WHEN event.event_type='menu_open' THEN event.session_id END) AS menuSessions,
        SUM(CASE WHEN event.event_type='product_view' THEN 1 ELSE 0 END) AS productViews
       FROM analytics_events event WHERE ${current.sql}
       GROUP BY event.language ORDER BY menuSessions DESC`,
    )
      .bind(...current.values)
      .all(),
    env.DB.prepare(
      `SELECT event.source_type AS source,
        COUNT(DISTINCT CASE WHEN event.event_type='menu_open' THEN event.session_id END) AS menuSessions,
        SUM(CASE WHEN event.event_type='product_view' THEN 1 ELSE 0 END) AS productViews
       FROM analytics_events event WHERE ${current.sql}
       GROUP BY event.source_type ORDER BY menuSessions DESC`,
    )
      .bind(...current.values)
      .all(),
  ]);

  const numbers = (row: Record<string, unknown> | null) => {
    const value = row || {};
    const menuSessions = Number(value.menuSessions || 0);
    const engagedSessions = Number(value.engagedSessions || 0);
    return {
      menuOpens: Number(value.menuOpens || 0),
      menuSessions,
      engagedSessions,
      engagementRate: menuSessions ? engagedSessions / menuSessions : 0,
      productViews: Number(value.productViews || 0),
      averageProductViews: menuSessions
        ? Number(value.productViews || 0) / menuSessions
        : 0,
      favouriteAdds: Number(value.favouriteAdds || 0),
    };
  };
  return {
    range,
    summary: numbers((summaryResult || null) as Record<string, unknown> | null),
    previous: numbers(
      (previousResult || null) as Record<string, unknown> | null,
    ),
    daily: dailyResult.results,
    hourly: hourlyResult.results,
    products: productResult.results,
    categories: categoryResult.results,
    tables: tableResult.results,
    searches: searchResult.results,
    promotions: promotionResult.results,
    actions: actionResult.results,
    languages: languageResult.results,
    sources: sourceResult.results,
  };
}

function validLocalDateTime(value: string) {
  if (!LOCAL_DATE_TIME_PATTERN.test(value)) return false;
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day &&
    parsed.getUTCHours() === hour &&
    parsed.getUTCMinutes() === minute
  );
}

function validPriceAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 && amount <= 999_999_999
    ? amount
    : null;
}

function parsePriceEntries(value: unknown): PriceEntryInput[] | null {
  if (!Array.isArray(value) || value.length > 1000) return null;
  const entries: PriceEntryInput[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    const item = (raw ?? {}) as Record<string, unknown>;
    const priceListId = String(item.priceListId ?? "");
    const portionId = item.portionId == null ? "" : String(item.portionId);
    const targetKey = portionId || "base";
    const priceCents =
      item.priceCents === "" || item.priceCents == null
        ? null
        : validPriceAmount(item.priceCents);
    if (
      !RECORD_ID_PATTERN.test(priceListId) ||
      (targetKey !== "base" && !PRODUCT_OPTION_ID_PATTERN.test(targetKey)) ||
      (item.priceCents !== "" && item.priceCents != null && priceCents == null)
    )
      return null;
    const key = `${priceListId}:${targetKey}`;
    if (seen.has(key)) return null;
    seen.add(key);
    entries.push({ priceListId, targetKey, priceCents });
  }
  return entries;
}

async function normalPriceListId(env: Env, businessId: string) {
  const row = await env.DB.prepare(
    "SELECT id FROM price_lists WHERE business_id=? AND is_normal=1",
  )
    .bind(businessId)
    .first<{ id: string }>();
  return row?.id || "";
}

async function resolvePriceList(
  env: Env,
  businessId: string,
  pricingMode: unknown,
  defaultPriceListId: unknown,
  timezone: unknown,
) {
  const zone = validTimezone(String(timezone || ""))
    ? String(timezone)
    : "Asia/Phnom_Penh";
  const normalId = await normalPriceListId(env, businessId);
  let activeId = String(defaultPriceListId || normalId);
  const selected = activeId
    ? await env.DB.prepare(
        "SELECT id FROM price_lists WHERE id=? AND business_id=? AND is_archived=0",
      )
        .bind(activeId, businessId)
        .first()
    : null;
  if (!selected) activeId = normalId;
  if (pricingMode === "automatic") {
    const now = localDateTimeNow(zone);
    const scheduled = await env.DB.prepare(
      `SELECT id FROM price_lists
       WHERE business_id=? AND is_archived=0 AND schedule_enabled=1
         AND schedule_start_local<=? AND schedule_end_local>?
       ORDER BY schedule_start_local DESC LIMIT 1`,
    )
      .bind(businessId, now, now)
      .first<{ id: string }>();
    if (scheduled?.id) activeId = scheduled.id;
  }
  return { activeId: activeId || normalId, normalId, timezone: zone };
}

function priceMap(rows: Array<Record<string, unknown>>, priceListId: string) {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.priceListId !== priceListId) continue;
    const amount = Number(row.priceCents);
    if (Number.isFinite(amount))
      map.set(`${row.productId}:${row.targetKey}`, amount);
  }
  return map;
}

function applyResolvedPrices(
  product: Json,
  normalPrices: Map<string, number>,
  activePrices: Map<string, number>,
  branchId: string,
) {
  const hydrated = hydrateProduct(product) as Json & {
    portions: Json[];
    modifierGroups: unknown[];
    priceCents: number;
    maxPrice: number;
  };
  const visiblePortions = hydrated.portions.filter((portion) =>
    portion.branchId == null || portion.branchId === branchId,
  );
  if (hydrated.portions.length && !visiblePortions.length) return null;
  const productId = String(product.id);
  const baseKey = `${productId}:base`;
  hydrated.priceCents =
    activePrices.get(baseKey) ??
    normalPrices.get(baseKey) ??
    Number(product.priceCents || 0);
  hydrated.portions = visiblePortions.map((portion) => {
    const key = `${productId}:${String(portion.id)}`;
    return {
      ...portion,
      priceCents:
        activePrices.get(key) ??
        normalPrices.get(key) ??
        Number(portion.priceCents || 0),
    };
  });
  if (hydrated.portions.length) {
    const portionPrices = hydrated.portions.map((portion) =>
      Number(portion.priceCents || 0),
    );
    hydrated.priceCents = Math.min(...portionPrices);
    hydrated.maxPrice = Math.max(...portionPrices);
  } else {
    hydrated.maxPrice = hydrated.priceCents;
  }
  return hydrated;
}

function safeHttpUrl(value: unknown) {
  const raw = String(value ?? "")
    .trim()
    .slice(0, 1000);
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function normalizeMenuHostname(value: unknown) {
  const hostname = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  if (!hostname || hostname.length > 253 || !hostname.includes("."))
    return null;
  const labels = hostname.split(".");
  if (
    labels.some(
      (label) =>
        !label ||
        label.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
    )
  )
    return null;
  return hostname;
}

function customMenuOrigin(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return { url: "", hostname: "" };
  try {
    const parsed = new URL(raw);
    const hostname = normalizeMenuHostname(parsed.hostname);
    if (
      parsed.protocol !== "https:" ||
      !hostname ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash ||
      (parsed.port && parsed.port !== "443")
    )
      return null;
    return { url: `https://${hostname}`, hostname };
  } catch {
    return null;
  }
}

function bannerFields(body: Json) {
  const title = String(body.title ?? "")
    .trim()
    .slice(0, 160);
  const subtitle = String(body.subtitle ?? "")
    .trim()
    .slice(0, 500);
  const detailText = String(body.detailText ?? "")
    .trim()
    .slice(0, 10_000);
  const ctaLabel = String(body.ctaLabel ?? "")
    .trim()
    .slice(0, 80);
  const imageUrl = safeHttpUrl(body.imageUrl);
  const ctaUrl = safeHttpUrl(body.ctaUrl);
  const startsAt = String(body.startsAt ?? "").trim();
  const endsAt = String(body.endsAt ?? "").trim();
  const hasSchedule = Boolean(startsAt || endsAt);
  if (!title) return { error: "Banner headline is required" } as const;
  if (!imageUrl)
    return { error: "Choose a valid HTTP or HTTPS banner image URL" } as const;
  if (ctaUrl === null)
    return { error: "Banner link must be a valid HTTP or HTTPS URL" } as const;
  if (ctaUrl && !detailText)
    return { error: "Add banner details before adding a link" } as const;
  if (
    hasSchedule &&
    (!validLocalDateTime(startsAt) ||
      !validLocalDateTime(endsAt) ||
      startsAt >= endsAt)
  )
    return {
      error: "Schedule end must be after a valid schedule start",
    } as const;
  return {
    title,
    subtitle,
    imageUrl,
    detailText,
    ctaLabel,
    ctaUrl,
    isActive: body.isActive === false || body.isActive === 0 ? 0 : 1,
    startsAt: hasSchedule ? startsAt : null,
    endsAt: hasSchedule ? endsAt : null,
  };
}

function businessShopInformation(
  body: Json,
  current: Record<string, unknown> = {},
) {
  const rawContacts = Array.isArray(body.contactNumbers)
    ? body.contactNumbers
    : [];
  const contactNumbers = rawContacts
    .slice(0, 10)
    .map((value) => {
      const item = (value ?? {}) as Record<string, unknown>;
      return {
        label:
          String(item.label ?? "Main")
            .trim()
            .slice(0, 30) || "Main",
        number: String(item.number ?? "")
          .trim()
          .slice(0, 40),
      };
    })
    .filter((item) => item.number);

  const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  const rawHours = Array.isArray(body.businessHours) ? body.businessHours : [];
  const businessHours = rawHours
    .slice(0, 7)
    .map((value) => {
      const item = (value ?? {}) as Record<string, unknown>;
      return {
        day: Number(item.day),
        enabled: Boolean(item.enabled),
        open: String(item.open ?? "08:00"),
        close: String(item.close ?? "22:00"),
      };
    })
    .filter(
      (item) =>
        Number.isInteger(item.day) &&
        item.day >= 0 &&
        item.day <= 6 &&
        timePattern.test(item.open) &&
        timePattern.test(item.close),
    );
  if (
    new Set(businessHours.map((item) => item.day)).size !== businessHours.length
  )
    return { error: "Business hours contain duplicate days" };

  const allowedPlatforms = new Set([
    "Facebook",
    "Instagram",
    "TikTok",
    "Telegram",
    "YouTube",
    "X",
    "Other",
  ]);
  const rawSocials = Array.isArray(body.socialLinks) ? body.socialLinks : [];
  const socialLinks: { platform: string; url: string }[] = [];
  for (const value of rawSocials.slice(0, 10)) {
    const item = (value ?? {}) as Record<string, unknown>;
    const platform = allowedPlatforms.has(String(item.platform))
      ? String(item.platform)
      : "Other";
    const url = safeHttpUrl(item.url);
    if (url === null) return { error: "Social links must use http or https" };
    if (url) socialLinks.push({ platform, url });
  }
  const websiteUrl = safeHttpUrl(body.websiteUrl);
  if (websiteUrl === null)
    return { error: "Website must be a valid http or https URL" };
  const locationsWereSubmitted = Array.isArray(body.locations);
  const existingLocations = jsonArray(current.locationsJson);
  const rawLocations: unknown[] = locationsWereSubmitted
    ? (body.locations as unknown[])
    : existingLocations;
  const locations: {
    label: string;
    address: string;
    mapUrl: string;
    showInMenu: boolean;
  }[] = [];
  for (const [index, value] of rawLocations.slice(0, 20).entries()) {
    const item = (value ?? {}) as Record<string, unknown>;
    const address = String(item.address ?? "")
      .trim()
      .slice(0, 240);
    const locationMapUrl = safeHttpUrl(item.mapUrl);
    if (locationMapUrl === null)
      return {
        error: `Map location ${index + 1} must be a valid http or https URL`,
      };
    if (!address && !locationMapUrl) continue;
    locations.push({
      label:
        String(item.label ?? "")
          .trim()
          .slice(0, 80) || `Branch ${index + 1}`,
      address,
      mapUrl: locationMapUrl,
      showInMenu: item.showInMenu == null ? true : Boolean(item.showInMenu),
    });
  }
  const legacyMapUrl = safeHttpUrl(body.mapUrl ?? current.mapUrl);
  if (legacyMapUrl === null)
    return { error: "Map location must be a valid http or https URL" };
  const legacyAddress = String(body.address ?? current.address ?? "")
    .trim()
    .slice(0, 240);
  const legacyMapLabel = String(body.mapLabel ?? current.mapLabel ?? "")
    .trim()
    .slice(0, 80);
  if (
    !locationsWereSubmitted &&
    !locations.length &&
    (legacyMapUrl || legacyAddress)
  ) {
    locations.push({
      label: legacyMapLabel || "Main branch",
      address: legacyAddress,
      mapUrl: legacyMapUrl,
      showInMenu: true,
    });
  }
  const mapUrl =
    locations[0]?.mapUrl || (locationsWereSubmitted ? "" : legacyMapUrl);
  const email = String(body.email ?? "")
    .trim()
    .slice(0, 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Email address is invalid" };
  const mapLabel =
    locations[0]?.label || (locationsWereSubmitted ? "" : legacyMapLabel);
  const wifiSsid = String(body.wifiSsid ?? current.wifiSsid ?? "")
    .trim()
    .slice(0, 64);
  const wifiPassword = String(
    body.wifiPassword ?? current.wifiPassword ?? "",
  ).slice(0, 128);
  const wifiSecurity =
    (body.wifiSecurity ?? current.wifiSecurity) === "open" ? "open" : "wpa";
  const setting = (key: string, fallback: boolean) =>
    body[key] == null
      ? current[key] == null
        ? fallback
        : Boolean(current[key])
      : Boolean(body[key]);
  const showHeaderLocation = setting("showHeaderLocation", true);
  const showHeaderPhones = setting("showHeaderPhones", false);
  const showHeaderWifi = setting("showHeaderWifi", false);
  const showHeaderSocials = setting("showHeaderSocials", false);
  const showHeaderTagline = setting("showHeaderTagline", true);
  const showBusinessHours = setting("showBusinessHours", true);
  if (showHeaderWifi && !wifiSsid)
    return { error: "Enter the Wi-Fi network name before showing Wi-Fi" };
  if (showHeaderWifi && wifiSecurity === "wpa" && !wifiPassword)
    return { error: "Enter the Wi-Fi password before showing Wi-Fi" };
  return {
    contactNumbers,
    businessHours,
    socialLinks,
    email,
    websiteUrl,
    locations,
    mapUrl,
    mapLabel,
    wifiSsid,
    wifiPassword,
    wifiSecurity,
    showHeaderLocation,
    showHeaderPhones,
    showHeaderWifi,
    showHeaderSocials,
    showHeaderTagline,
    showBusinessHours,
  };
}

function hydrateProduct(product: Record<string, unknown>) {
  const { portionsJson, modifierGroupsJson, ...rest } = product;
  return {
    ...rest,
    portions: jsonArray(portionsJson),
    modifierGroups: jsonArray(modifierGroupsJson),
  };
}

function parseSortItems(value: unknown) {
  if (!Array.isArray(value) || value.length > 500) return null;
  const items = value.map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    return {
      id: String(item.id ?? ""),
      sortOrder: Number(item.sortOrder),
    };
  });
  if (
    items.some(
      (item) =>
        !/^[a-zA-Z0-9_-]+$/.test(item.id) ||
        !Number.isInteger(item.sortOrder) ||
        item.sortOrder < 0 ||
        item.sortOrder > 999_999,
    ) ||
    new Set(items.map((item) => item.id)).size !== items.length
  )
    return null;
  return items;
}

function parseSortOrder(value: unknown) {
  const order = Number(value ?? 0);
  return Number.isInteger(order) && order >= 0 && order <= 999_999
    ? order
    : null;
}

async function productOptions(body: Json, db: D1Database, businessId: string) {
  const unit = String(body.unit ?? "")
    .trim()
    .slice(0, 40);
  const rawPortions = Array.isArray(body.portions) ? body.portions : [];
  const rawGroups = Array.isArray(body.modifierGroups)
    ? body.modifierGroups
    : [];
  if (rawPortions.length > 20)
    return { error: "A product can have up to 20 portions" };
  if (rawGroups.length > 12)
    return { error: "A product can have up to 12 modifier groups" };

  const label = (item: Record<string, unknown>, key: string) =>
    String(item[key] ?? "")
      .trim()
      .slice(0, 120);
  const validLabels = (item: Record<string, unknown>) =>
    Boolean(label(item, "labelKm"));
  const price = (value: unknown, { optional = false, minimum = 0 } = {}) => {
    if (optional && (value === "" || value == null)) return null;
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= minimum ? amount : NaN;
  };

  const portions = rawPortions.map((value) => {
    const item = (value ?? {}) as Record<string, unknown>;
    return {
      id: String(item.id || id("portion")).slice(0, 80),
      labelKm: label(item, "labelKm"),
      labelEn: label(item, "labelEn"),
      labelZh: label(item, "labelZh"),
      priceCents: price(item.priceCents),
      ...(item.branchId === undefined ? {} : { branchId: item.branchId }),
      priceRule: label(item, "priceRule"),
      unit: String(item.unit ?? "")
        .trim()
        .slice(0, 40),
    };
  });
  if (
    portions.some(
      (portion) =>
        !PRODUCT_OPTION_ID_PATTERN.test(portion.id) ||
        portion.id === "base" ||
        !validLabels(portion as unknown as Record<string, unknown>) ||
        !Number.isFinite(portion.priceCents),
    ) ||
    new Set(portions.map((portion) => portion.id)).size !== portions.length
  )
    return {
      error: "Every portion needs a unique ID, Khmer label and valid price",
    };
  if (portions.some(({ branchId }) => branchId != null &&
    (typeof branchId !== "string" || !PRODUCT_OPTION_ID_PATTERN.test(branchId))))
    return { error: "Every portion branch must be a valid branch ID or null" };

  const modifierGroups = rawGroups.map((value) => {
    const group = (value ?? {}) as Record<string, unknown>;
    const rawOptions = Array.isArray(group.options) ? group.options : [];
    return {
      id: String(group.id || id("group")).slice(0, 80),
      labelKm: label(group, "labelKm"),
      labelEn: label(group, "labelEn"),
      labelZh: label(group, "labelZh"),
      required: Boolean(group.required),
      multiple: Boolean(group.multiple),
      options: rawOptions.map((optionValue) => {
        const option = (optionValue ?? {}) as Record<string, unknown>;
        return {
          id: String(option.id || id("option")).slice(0, 80),
          labelKm: label(option, "labelKm"),
          labelEn: label(option, "labelEn"),
          labelZh: label(option, "labelZh"),
          priceCents: price(option.priceCents, {
            optional: true,
            minimum: -Infinity,
          }),
          prefix: String(option.prefix ?? "")
            .trim()
            .slice(0, 40),
        };
      }),
    };
  });
  if (
    modifierGroups.some(
      (group) =>
        !validLabels(group as unknown as Record<string, unknown>) ||
        !group.options.length ||
        group.options.length > 30 ||
        group.options.some(
          (option) =>
            !validLabels(option as unknown as Record<string, unknown>) ||
            (option.priceCents != null && !Number.isFinite(option.priceCents)),
        ),
    )
  )
    return {
      error: "Every modifier group and option needs a Khmer label",
    };

  const portionsJson = JSON.stringify(portions);
  const modifierGroupsJson = JSON.stringify(modifierGroups);
  if (portionsJson.length + modifierGroupsJson.length > 64_000)
    return { error: "Product options are too large" };
  if (!await ownsPortionBranches(db, businessId, portions as Array<{ branchId?: string | null }>))
    return { error: "Choose portion branches that belong to this business" };
  return { unit, portions, modifierGroups };
}

function productPriceRange(
  portions: Array<{ priceCents: number | null }>,
  fallbackPrice: number,
) {
  if (!portions.length)
    return { minPrice: fallbackPrice, maxPrice: fallbackPrice };
  const prices = portions.map((portion) => Number(portion.priceCents));
  return {
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
  };
}

async function sessionFrom(
  request: Request,
  env: Env,
): Promise<SessionContext | null> {
  const token = sessionTokenFrom(request);
  if (!token) return null;
  const tokenHash = await hashToken(token);
  return env.DB.prepare(
    `
    SELECT s.user_id AS userId, m.business_id AS businessId, m.role AS role,
      s.session_type AS sessionType, s.actor_email AS actorEmail,
      s.expires_at AS expiresAt, b.timezone,
      b.disabled_control_pages_json AS disabledControlPagesJson, m.can_view_bookings AS canViewBookings,
      sp.features_json AS subscriptionFeaturesJson,
      COALESCE(sp.pos_enabled,1) AS posEnabled,
      sp.code AS subscriptionPlanCode, sp.name AS subscriptionPlanName,
      bs.source AS subscriptionSource, bs.status AS subscriptionStatus,
      bs.trial_ends_at AS trialEndsAt,
      bs.current_period_end_at AS currentPeriodEndAt
    FROM sessions s
    JOIN memberships m ON m.user_id = s.user_id
      AND (s.business_id IS NULL OR m.business_id = s.business_id)
    JOIN businesses b ON b.id = m.business_id
    LEFT JOIN business_subscriptions bs ON bs.business_id = b.id
    LEFT JOIN subscription_plans sp ON sp.id = bs.plan_id
    WHERE s.token_hash = ? AND s.expires_at > datetime('now')
      AND (b.is_active = 1 OR s.session_type = 'support')
    ORDER BY CASE m.role WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END
    LIMIT 1
  `,
  )
    .bind(tokenHash)
    .first<SessionContext>();
}

function controlPagesForResource(
  path: string,
  method: string,
): ControlPage[] | undefined {
  const resource = path.split("/")[3];
  const readOnly = method === "GET" || method === "HEAD";
  switch (resource) {
    case "overview":
      return ["overview"];
    case "business":
      return ["business"];
    case "menu-theme":
      return ["appearance"];
    case "catalog":
      return readOnly ? catalogReaderPages : ["catalog"];
    case "categories":
    case "products":
      return ["catalog"];
    case "branches":
      return ["catalog", "tables", "qrDesigns", "orders", "reports"];
    case "menus":
      return readOnly && path === "/api/admin/menus"
        ? ["menus", "catalog", "qrDesigns", "tables"]
        : ["menus"];
    case "price-lists":
      return readOnly ? priceListReaderPages : ["priceLists"];
    case "product-prices":
      return ["managePrices"];
    case "orders":
      return ["orders"];
    case "reports":
      return ["reports"];
    case "pos":
      if (path === `${posAdminPath}/overview`) return ["sellingOverview"];
      if (path === `${posAdminPath}/sales`) return ["salesList"];
      if (path === `${posAdminPath}/payment-types` || path.startsWith(`${posAdminPath}/payment-types/`))
        return ["posPaymentTypes"];
      return ["posProfiles"];
    case "tables":
    case "table-groups":
      return readOnly ? ["tables", "qrDesigns"] : ["tables"];
    case "banners":
      return ["banners"];
    case "readiness":
    case "qr-designs":
      return ["qrDesigns"];
    case "media":
      return ["business", "appearance", "catalog", "banners", "qrDesigns", "menus"];
  }
}

function sessionTokenFrom(request: Request) {
  const bearer = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  const cookie = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)mf_session=([^;]+)/)?.[1];
  return bearer ?? cookie ?? "";
}

async function createSession(userId: string, env: Env) {
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll(
    "-",
    "",
  );
  const expires = new Date(Date.now() + 30 * 864e5).toISOString();
  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
  )
    .bind(id("ses"), userId, await hashToken(token), expires)
    .run();
  return { token, expires };
}

type ProvisionBusinessInput = {
  email: string;
  displayName: string;
  businessName: string;
  businessSlug: string;
  passwordProof: string;
  plan: PlanOfferRow;
  publicSignup: boolean;
  actorEmail?: string;
};

async function registrationPlan(db: D1Database, input: Json, publicSignup: boolean) {
  const { planId, priceId } = input;
  if (planId === undefined && priceId === undefined)
    return selectedPlan(db, DEFAULT_PLAN_ID, publicSignup);
  if (typeof planId !== "string" || typeof priceId !== "string") return null;
  const plan = await selectedPlan(db, planId, publicSignup);
  return plan?.priceId === priceId ? plan : null;
}

function planChangedDuringSignup(error: unknown) {
  return String(error).includes("NOT NULL constraint failed: business_subscriptions.plan_id");
}

async function provisionBusiness(env: Env, input: ProvisionBusinessInput) {
  const userId = id("usr");
  const businessId = id("biz");
  const priceListId = id("prl");
  const groupId = id("grp");
  const designId = id("qrd");
  const subscriptionId = id("sub");
  const createdAt = new Date().toISOString();
  const trialEndsAt = input.plan.amountMinor > 0
    ? new Date(Date.parse(createdAt) + 30 * 864e5).toISOString()
    : null;
  const passwordData = await credentialHash(
    input.passwordProof,
    env.AUTH_PEPPER,
  );
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO users (id, email, display_name, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)",
    ).bind(
      userId,
      input.email,
      input.displayName || input.businessName,
      passwordData.hash,
      passwordData.salt,
    ),
    env.DB.prepare(
      `INSERT INTO businesses
       (id, name, slug, tagline, locale, currency, timezone, pricing_mode,
        default_price_list_id, disabled_control_pages_json)
       VALUES (?, ?, ?, ?, 'km', 'KHR', 'Asia/Phnom_Penh', 'automatic', ?, ?)`,
    ).bind(
      businessId,
      input.businessName,
      input.businessSlug,
      "Freshly made, beautifully served.",
      priceListId,
      JSON.stringify(["sellingOverview", "posProfiles", "posPaymentTypes"] satisfies ControlPage[]),
    ),
    env.DB.prepare(
      `INSERT INTO price_lists (id,business_id,name,is_normal)
       VALUES (?,?,'Normal Rate',1)`,
    ).bind(priceListId, businessId),
    env.DB.prepare(
      "INSERT INTO memberships (user_id, business_id, role) VALUES (?, ?, 'owner')",
    ).bind(userId, businessId),
    env.DB.prepare(
      `INSERT INTO business_subscriptions
       (id,business_id,plan_id,price_id,source,status,trial_ends_at,
        current_period_start_at,current_period_end_at,created_at,updated_at)
       VALUES (?,?,
         (SELECT plan.id FROM subscription_plans plan ${planOfferJoin}
          WHERE plan.id=? AND price.id=? AND plan.is_active=1 AND (?=0 OR plan.is_public=1)),
         ?,'manual',?,?,?,?,?,?)`,
    ).bind(
      subscriptionId,
      businessId,
      input.plan.id,
      input.plan.priceId,
      Number(input.publicSignup),
      input.plan.priceId,
      trialEndsAt ? "trialing" : "active",
      trialEndsAt,
      createdAt,
      trialEndsAt,
      createdAt,
      createdAt,
    ),
    env.DB.prepare(
      "INSERT INTO table_groups (id, business_id, name, sort_order, is_active) VALUES (?, ?, 'Main Area', 0, 1)",
    ).bind(groupId, businessId),
    env.DB.prepare(
      `INSERT INTO qr_designs
       (id, business_id, name, preset_key, target_type, config_json, is_default)
       VALUES (?, ?, 'My QR Menu', 'table-card', 'menu', ?, 1)`,
    ).bind(designId, businessId, JSON.stringify(defaultQrConfig())),
    ...(input.actorEmail ? [
      auditStatement(env, input.actorEmail, "business.created", businessId, userId, {
        businessName: input.businessName, slug: input.businessSlug,
        ownerEmail: input.email, planId: input.plan.id, priceId: input.plan.priceId,
      }),
    ] : []),
  ]);
  return {
    user: {
      id: userId,
      email: input.email,
      displayName: input.displayName || input.businessName,
    },
    business: {
      id: businessId,
      name: input.businessName,
      slug: input.businessSlug,
    },
  };
}

async function invalidatePublicMenu(env: Env, businessId: string) {
  await publicMenuVersionStatement(env.DB, businessId).run();
}

function publicMenuVersionStatement(
  db: D1Database,
  businessId: string,
  onlyAfterChanges = false,
) {
  return db.prepare(
    `UPDATE businesses SET menu_cache_version=menu_cache_version+1,
     updated_at=CURRENT_TIMESTAMP WHERE id=?${onlyAfterChanges ? " AND changes()>0" : ""}`,
  )
    .bind(businessId);
}

function menuPlacements(value: unknown) {
  if (!Array.isArray(value) || !value.length || value.length > 10_000) return null;
  const ids = new Set<string>();
  const placements: { id: string; parentId: string | null; sortOrder: number }[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const { id, parentId, sortOrder } = item as Json;
    if (typeof id !== "string" || !RECORD_ID_PATTERN.test(id) || ids.has(id) ||
        (parentId !== null && (typeof parentId !== "string" || !RECORD_ID_PATTERN.test(parentId))) ||
        typeof sortOrder !== "number" || parseSortOrder(sortOrder) === null) return null;
    ids.add(id);
    placements.push({ id, parentId, sortOrder });
  }
  return placements;
}

async function deleteUnorderedProducts(db: D1Database, businessId: string, productIds: string[]) {
  const encoded = JSON.stringify(productIds);
  // Orders keep their product IDs even when the catalog changes. The delete
  // and cache version bump share a transaction with the order write guard.
  const [deleted, , retained] = await db.batch<{ id: string }>([
    db.prepare(`DELETE FROM products
      WHERE business_id=?1 AND id IN (SELECT value FROM json_each(?2))
      AND id NOT IN (
        SELECT line.product_id FROM orders purchase
        JOIN order_products line ON line.order_id=purchase.id
        WHERE purchase.business_id=?1 AND line.product_id IN (SELECT value FROM json_each(?2))
      )
      RETURNING id`).bind(businessId, encoded),
    publicMenuVersionStatement(db, businessId, true),
    db.prepare(`SELECT id FROM products
      WHERE business_id=? AND id IN (SELECT value FROM json_each(?))`).bind(businessId, encoded),
  ]);
  return {
    deletedIds: deleted.results.map(({ id }) => id),
    protectedIds: retained.results.map(({ id }) => id),
  };
}

async function localMenuAssignments(db: D1Database, businessId: string, productId: string, value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 1000 || value.some((entry) => typeof entry !== "string" || !RECORD_ID_PATTERN.test(entry)))
    return null;
  const ids = [...new Set(value as string[])];
  const encoded = JSON.stringify(ids);
  const valid = await db.prepare(`SELECT COUNT(*) AS count FROM menus
    WHERE business_id=? AND source='local' AND parent_id IS NOT NULL
      AND id IN (SELECT value FROM json_each(?))`)
    .bind(businessId, encoded).first<number>("count");
  if (valid !== ids.length) return null;
  return [
    db.prepare(`DELETE FROM menu_products WHERE business_id=? AND product_id=?
      AND menu_id IN (SELECT id FROM menus WHERE business_id=? AND source='local')
      AND menu_id NOT IN (SELECT value FROM json_each(?))`)
      .bind(businessId,productId,businessId,encoded),
    db.prepare(`INSERT INTO menu_products (business_id,menu_id,product_id)
      SELECT ?,value,? FROM json_each(?) WHERE true
      ON CONFLICT(business_id,menu_id,product_id) DO NOTHING`).bind(businessId,productId,encoded),
  ];
}

const adminCategoryScope = `filtered_category_ids(id) AS (
  SELECT id FROM categories WHERE business_id=? AND id=?
  UNION
  SELECT child.id FROM categories child
  JOIN filtered_category_ids parent ON child.parent_id=parent.id
  WHERE child.business_id=?
)`;
const adminVisibleCategoryScope = `visible_category_ids(id) AS (
  SELECT id FROM categories
  WHERE business_id = ? AND is_active = 1 AND parent_id IS NULL
  UNION ALL
  SELECT child.id FROM categories child
  JOIN visible_category_ids parent ON child.parent_id = parent.id
  WHERE child.business_id = ? AND child.is_active = 1
)`;
const adminProductFilters = {
  published: "product.is_available = 1",
  unpublished: "product.is_available = 0",
  featured: "product.is_featured = 1",
  "missing-photos": `product.is_available = 1
    AND product.category_id IN (SELECT id FROM visible_category_ids)
    AND COALESCE(TRIM(product.image_url), '') = ''
    AND NOT EXISTS (
      SELECT 1 FROM product_images missing_image
      WHERE missing_image.business_id = product.business_id
        AND missing_image.product_id = product.id
    )`,
};

function adminProductFilter(filter: string) {
  return Object.hasOwn(adminProductFilters, filter)
    ? adminProductFilters[filter as keyof typeof adminProductFilters]
    : "";
}

const adminProductCounts = `COUNT(*) AS "all",
  COUNT(CASE WHEN ${adminProductFilters.published} THEN 1 END) AS published,
  COUNT(CASE WHEN ${adminProductFilters.unpublished} THEN 1 END) AS unpublished,
  COUNT(CASE WHEN ${adminProductFilters.featured} THEN 1 END) AS featured,
  COUNT(CASE WHEN ${adminProductFilters["missing-photos"]} THEN 1 END) AS missingPhotos`;

const adminUnassignedMenuProduct = `NOT EXISTS (
  SELECT 1 FROM menu_products assignment
  JOIN menus section ON section.business_id=assignment.business_id AND section.id=assignment.menu_id
  WHERE assignment.business_id=product.business_id AND assignment.product_id=product.id
    AND section.parent_id IS NOT NULL
)`;

function countAdminCatalogProducts(db: D1Database, businessId: string, includeMenuCounts = false) {
  const menuCounts = includeMenuCounts
    ? `, COUNT(CASE WHEN ${adminUnassignedMenuProduct} THEN 1 END) AS unassignedMenu`
    : "";
  return db.prepare(`WITH RECURSIVE ${adminVisibleCategoryScope}
    SELECT ${adminProductCounts}${menuCounts}
    FROM products product WHERE product.business_id=?`)
    .bind(businessId, businessId, businessId);
}

const maxProductSelection = 10_000;

async function matchingProductIds(db: D1Database, sql: string, bindings: unknown[]) {
  const { results } = await db.prepare(`${sql} LIMIT ?`)
    .bind(...bindings, maxProductSelection + 1).all<{ id: string }>();
  if (results.length > maxProductSelection)
    return json({ error: "Select up to 10,000 products at a time. Narrow your search or category." }, 400);
  return json({ productIds: results.map(({ id }) => id) });
}

async function listAdminMenuProducts(
  env: Env,
  url: URL,
  businessId: string,
  menuId: string,
  isRoot: boolean,
  orderOnly: boolean,
  unassigned: boolean,
) {
  const categoryId = orderOnly ? "" : (url.searchParams.get("categoryId") ?? "").trim();
  const filter = orderOnly ? "" : url.searchParams.get("filter") ?? "";
  const filterPredicate = filter === "unassigned-menu"
    ? adminUnassignedMenuProduct
    : adminProductFilter(filter);
  const needsVisibleCategories = filter === "missing-photos";
  const idMode = url.searchParams.get("ids");
  const assignmentIds = !orderOnly && !isRoot && idMode === "1";
  const catalog = !orderOnly && !unassigned && !assignmentIds && url.searchParams.get("catalog") === "1";
  const includeDescendants = isRoot || (!orderOnly && !unassigned && !assignmentIds && !catalog &&
    url.searchParams.get("includeDescendants") === "1");
  const menuScope = includeDescendants ? `sections(id) AS (
    SELECT id FROM menus WHERE business_id=? AND parent_id=?
    UNION
    SELECT child.id FROM menus child JOIN sections parent ON child.parent_id=parent.id
    WHERE child.business_id=?
  )` : "";
  const menuScopeBindings = includeDescendants ? [businessId, menuId, businessId] : [];
  const scopes = [
    menuScope,
    categoryId ? adminCategoryScope : "",
    needsVisibleCategories ? adminVisibleCategoryScope : "",
  ].filter(Boolean);
  const scope = scopes.length ? `WITH RECURSIVE ${scopes.join(", ")}` : "";
  const descendantAssignment = `EXISTS (SELECT 1 FROM menu_products child_placement
    JOIN sections ON sections.id=child_placement.menu_id
    WHERE child_placement.business_id=product.business_id AND child_placement.product_id=product.id)`;
  // A submenu's assignment actions still apply only to links in that submenu.
  const assignment = isRoot ? descendantAssignment : "placement.product_id IS NOT NULL";
  const browseAssignment = includeDescendants && !isRoot
    ? `(${assignment} OR ${descendantAssignment})`
    : assignment;
  const query = orderOnly ? "" : (url.searchParams.get("query") ?? "").trim().toLowerCase().slice(0, 160);
  const from = `FROM products product
    ${isRoot ? "" : `LEFT JOIN menu_products placement ON placement.business_id=product.business_id
      AND placement.product_id=product.id AND placement.menu_id=?`}`;
  const where = `WHERE product.business_id=?
    ${catalog ? "" : unassigned ? `AND NOT (${assignment})` : `AND ${browseAssignment}`}
    ${filterPredicate ? `AND ${filterPredicate}` : ""}
    ${categoryId ? "AND product.category_id IN (SELECT id FROM filtered_category_ids)" : ""}
    ${query ? `AND LOWER(COALESCE(product.code,'') || ' ' || product.name || ' ' ||
      COALESCE(product.name_km,'') || ' ' || COALESCE(product.name_en,'') || ' ' ||
      COALESCE(product.name_zh,'')) LIKE ?` : ""}`;
  const assignedBindings = isRoot ? [businessId] : [menuId, businessId];
  const bindings = [
    ...menuScopeBindings,
    ...(categoryId ? [businessId, categoryId, businessId] : []),
    ...(needsVisibleCategories ? [businessId, businessId] : []),
    ...assignedBindings,
    ...(query ? [`%${query}%`] : []),
  ];
  if (assignmentIds || (!orderOnly && idMode === "matches"))
    return matchingProductIds(env.DB, `${scope} SELECT product.id ${from} ${where}`, bindings);
  const page = Math.min(1_000_000, Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "", 10) || 1));
  const pageSize = 48;
  const select = `${scope}
    SELECT product.id,product.code,product.name,product.name_km AS nameKm,
      product.name_en AS nameEn,product.name_zh AS nameZh,product.price_cents AS priceCents,
      product.unit,product.is_available AS isAvailable,product.image_url AS imageUrl,
      product.primary_media_id AS primaryMediaId,photo.object_key AS objectKey,
      COALESCE(category.name_km,category.name) AS categoryName,
      (${assignment}) AS isAssigned,
      ${isRoot ? "0" : "COALESCE(placement.assigned_in_admin,0)"} AS assignedInAdmin,
      ${isRoot ? "product.sort_order" : "COALESCE(placement.sort_order,product.sort_order)"} AS sortOrder
    ${from}
    LEFT JOIN categories category ON category.id=product.category_id AND category.business_id=product.business_id
    LEFT JOIN media photo ON photo.id=product.primary_media_id AND photo.business_id=product.business_id
    ${where}
    ORDER BY sortOrder,product.sort_order,product.name,product.id`;
  const statements = [
    orderOnly
      ? env.DB.prepare(select).bind(...bindings)
      : env.DB.prepare(`${select} LIMIT ? OFFSET ?`).bind(...bindings, pageSize, (page - 1) * pageSize),
    env.DB.prepare(`${scope} SELECT COUNT(*) AS total ${from} ${where}`).bind(...bindings),
  ];
  if (!orderOnly && !unassigned && url.searchParams.get("includeCounts") === "1") {
    statements.push(countAdminCatalogProducts(env.DB, businessId, true));
  }
  const [products, count, counts] = await env.DB.batch<Json>(statements);
  return json({
    products: products.results.map(({ objectKey, primaryMediaId, ...product }) => ({
      ...product,
      imageUrl: mediaUrl(env, objectKey, String(product.imageUrl ??
        (primaryMediaId ? `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${primaryMediaId}` : ""))),
    })),
    pagination: { page, pageSize, total: Number(count.results[0]?.total ?? 0) },
    counts: counts?.results[0],
  });
}

async function adminMenuProducts(request: Request, url: URL, env: Env, businessId: string, menuId: string, orderOnly: boolean) {
  const db = env.DB;
  const menu = await db.prepare(
    "SELECT parent_id AS parentId,source FROM menus WHERE business_id=? AND id=? AND deleted_in_admin=0",
  )
    .bind(businessId, menuId).first<{ parentId: string | null; source: string }>();
  if (!menu) return json({ error: "Menu not found" }, 404);
  const unassigned = url.searchParams.get("unassigned") === "1";
  if (request.method === "GET" && (!unassigned && !orderOnly || menu.parentId))
    return listAdminMenuProducts(env, url, businessId, menuId, !menu.parentId, orderOnly, unassigned);
  if (!menu.parentId) return json({ error: "Choose a submenu" }, 400);
  if (orderOnly ? request.method !== "PUT" : !["POST", "DELETE"].includes(request.method))
    return json({ error: "Method not allowed" }, 405);

  const body = await readJson(request).catch(() => null);
  const ids = body?.productIds;
  if (!Array.isArray(ids) || !ids.length || ids.length > maxProductSelection ||
      ids.some((id) => typeof id !== "string" || !RECORD_ID_PATTERN.test(id)))
    return json({ error: "Choose products for this menu" }, 400);
  const productIds = [...new Set(ids as string[])];
  const encoded = JSON.stringify(productIds);

  if (orderOnly) {
    if (ids.length !== productIds.length) return json({ error: "Product order contains duplicates" }, 400);
    const [saved] = await db.batch([
      db.prepare(`WITH requested(product_id, position) AS (SELECT value, key FROM json_each(?1))
        UPDATE menu_products SET sort_order=requested.position FROM requested
        WHERE menu_products.business_id=?2 AND menu_products.menu_id=?3
          AND menu_products.product_id=requested.product_id
          AND EXISTS (SELECT 1 FROM menus WHERE business_id=?2 AND id=?3
            AND parent_id IS NOT NULL AND deleted_in_admin=0)
          AND (SELECT COUNT(*) FROM menu_products WHERE business_id=?2 AND menu_id=?3)=?4
          AND NOT EXISTS (SELECT 1 FROM menu_products current
            WHERE current.business_id=?2 AND current.menu_id=?3
              AND current.product_id NOT IN (SELECT product_id FROM requested))`)
        .bind(encoded, businessId, menuId, productIds.length),
      publicMenuVersionStatement(db, businessId, true),
    ]);
    if (saved.meta.changes !== productIds.length)
      return json({ error: "The menu's products changed. Reopen the order dialog and try again." }, 409);
    return json({ ok: true });
  }

  if (request.method === "POST") {
    const count = await db.prepare(`SELECT COUNT(*) AS count FROM products WHERE business_id=?
      AND id IN (SELECT value FROM json_each(?))`).bind(businessId, encoded).first<number>("count");
    if (count !== productIds.length) return json({ error: "Choose products owned by this business" }, 400);
  }
  const target = "SELECT 1 FROM menus WHERE business_id=?1 AND id=?2 AND parent_id IS NOT NULL AND deleted_in_admin=0";
  const posMenu = Number(menu.source === "pos");
  const assign = request.method === "POST";
  const selected = `business_id=?1 AND menu_id=?2 AND product_id IN (SELECT value FROM json_each(?3))
    AND EXISTS (${target})`;
  const write = assign
    ? db.prepare(`INSERT INTO menu_products (business_id,menu_id,product_id,assigned_in_admin)
        SELECT ?1,?2,value,?4 FROM json_each(?3) WHERE EXISTS (${target})
        ON CONFLICT(business_id,menu_id,product_id) DO NOTHING`).bind(businessId, menuId, encoded, posMenu)
    : db.prepare(`DELETE FROM menu_products WHERE ${selected}`).bind(businessId, menuId, encoded);
  // POS sync reads these exclusions in the same transaction as its assignment writes.
  const override = assign
    ? `DELETE FROM menu_product_exclusions WHERE ${selected}`
    : `INSERT INTO menu_product_exclusions (business_id,menu_id,product_id)
        SELECT ?1,?2,id FROM products WHERE business_id=?1
          AND id IN (SELECT value FROM json_each(?3)) AND EXISTS (${target})
        ON CONFLICT(business_id,menu_id,product_id) DO NOTHING`;
  const [current] = await db.batch([
    db.prepare(target).bind(businessId, menuId),
    ...(posMenu ? [db.prepare(override).bind(businessId, menuId, encoded)] : []),
    write,
    publicMenuVersionStatement(db, businessId, true),
  ]);
  if (!current.results.length) return json({ error: "This submenu is no longer available" }, 409);
  return json({ ok: true });
}

async function activeBanners(env: Env, businessId: string, timezone: string) {
  const now = localDateTimeNow(timezone);
  return (
    await env.DB.prepare(
      `SELECT id, title, subtitle, image_url AS imageUrl,
        detail_text AS detailText, cta_label AS ctaLabel, cta_url AS ctaUrl
       FROM banners
       WHERE business_id=? AND is_active=1
         AND ((starts_at IS NULL AND ends_at IS NULL)
           OR (starts_at<=? AND ends_at>?))
       ORDER BY sort_order, created_at`,
    )
      .bind(businessId, now, now)
      .all()
  ).results as Array<Record<string, unknown>>;
}

async function bannerStateKey(banners: Array<Record<string, unknown>>) {
  const ids = banners.map((banner) => String(banner.id)).join(":");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(ids),
  );
  return bytesToHex(digest).slice(0, 16);
}

async function cachedPublicMenu(slug: string, env: Env, branchSlug: string | null, menuSlug: string | null) {
  const context = await env.DB.prepare(
    `SELECT id, pricing_mode AS pricingMode,
      default_price_list_id AS defaultPriceListId, timezone,
      allow_category_browsing AS allowCategoryBrowsing,
      menu_cache_version AS menuCacheVersion
     FROM businesses WHERE slug=? AND is_active=1`,
  )
    .bind(slug)
    .first<Record<string, unknown>>();
  if (!context) return { menu: null, cacheStatus: "MISS" };
  const businessId = String(context.id);
  const requiresMenu = menuSlug !== null || !context.allowCategoryBrowsing;
  const [branch, root] = await Promise.all([
    findBranch(env.DB, businessId, branchSlug),
    menuSlug !== null
      ? findMenuRoot(env.DB, businessId, menuSlug)
      : requiresMenu ? firstActiveMenuRoot(env.DB, businessId) : null,
  ]);
  if (!branch?.isActive || (requiresMenu && !root?.isActive))
    return { menu: null, cacheStatus: "MISS" };
  const pricing = await resolvePriceList(
    env,
    String(context.id),
    context.pricingMode,
    context.defaultPriceListId,
    context.timezone,
  );
  const banners = await activeBanners(
    env,
    String(context.id),
    pricing.timezone,
  );
  const key = catalogCacheKey(
    `${slug}:${branch.id}:${root?.id ?? "categories"}`,
    Number(context.menuCacheVersion || 1),
    pricing.activeId,
    await bannerStateKey(banners),
    env,
  );
  const cached = await env.CATALOG_CACHE.get(key, "json");
  if (cached) return { menu: cached, cacheStatus: "HIT" };
  const menu = await publicMenu(slug, env, branch, root, pricing, banners);
  if (menu)
    await env.CATALOG_CACHE.put(key, JSON.stringify(menu), {
      expirationTtl: 86_400,
    });
  return { menu, cacheStatus: "MISS" };
}

async function publicMenu(
  slug: string,
  env: Env,
  branch: Branch,
  root: MenuRoot | null,
  resolvedPricing?: { activeId: string; normalId: string; timezone: string },
  resolvedBanners?: Array<Record<string, unknown>>,
) {
  const business = await env.DB.prepare(
    `
    SELECT business.id, business.name, business.slug, business.tagline,
      business.description, business.logo_url AS logoUrl,
      business.logo_media_id AS logoMediaId, logo_media.object_key AS logoObjectKey,
      business.phone, business.address, business.currency,
      business.secondary_currency AS secondaryCurrency,
      business.secondary_exchange_rate AS secondaryExchangeRate,
      business.show_secondary_currency AS showSecondaryCurrency,
      business.enable_add_to_order AS enableAddToOrder,
      ${branchOrderColumns},
      business.locale,
      business.business_hours_json AS businessHoursJson,
      business.contact_numbers_json AS contactNumbersJson,
      business.email, business.website_url AS websiteUrl,
      business.custom_menu_url AS customMenuUrl,
      business.social_links_json AS socialLinksJson,
      business.locations_json AS locationsJson,
      business.map_url AS mapUrl, business.map_label AS mapLabel,
      business.wifi_ssid AS wifiSsid,
      business.wifi_password AS wifiPassword,
      business.wifi_security AS wifiSecurity,
      business.show_header_location AS showHeaderLocation,
      business.show_header_phones AS showHeaderPhones,
      business.show_header_wifi AS showHeaderWifi,
      business.show_header_socials AS showHeaderSocials,
      business.show_header_tagline AS showHeaderTagline,
      business.show_business_hours AS showBusinessHours,
      business.theme_color AS themeColor,
      business.menu_theme_json AS menuThemeJson, business.enable_en AS enableEn,
      business.enable_zh AS enableZh, business.timezone,
      business.pricing_mode AS pricingMode,
      business.default_price_list_id AS defaultPriceListId
    FROM businesses business
    JOIN branches branch ON branch.business_id=business.id AND branch.id=? AND branch.is_active=1
    LEFT JOIN media logo_media
      ON logo_media.id=business.logo_media_id AND logo_media.business_id=business.id
    WHERE business.slug = ? AND business.is_active = 1
  `,
  )
    .bind(branch.id, slug)
    .first<Record<string, unknown>>();
  if (!business) return null;
  const businessId = String(business.id);
  const pricing =
    resolvedPricing ||
    (await resolvePriceList(
      env,
      businessId,
      business.pricingMode,
      business.defaultPriceListId,
      business.timezone,
    ));
  const scopeBindings = root ? [businessId, root.id, businessId] : [businessId, businessId];
  const categoryQuery = root
    ? `${visibleMenuIds}
       SELECT node.id,node.parent_id AS parentId,node.slug,node.name_km AS nameKm,
        node.name_en AS nameEn,node.name_zh AS nameZh,
        COALESCE(NULLIF(node.name_km,''),NULLIF(node.name_en,''),node.name_zh) AS name,
        node.image_url AS imageUrl,node.image_media_id AS imageMediaId,
        photo.object_key AS imageObjectKey,node.sort_order AS sortOrder
       FROM menus node JOIN visible_menu_ids visible ON visible.id=node.id
       LEFT JOIN media photo ON photo.id=node.image_media_id AND photo.business_id=node.business_id
       WHERE node.business_id=? ORDER BY node.sort_order,name,node.id`
    : `${visibleCategoryIds}
       SELECT category.id, category.parent_id AS parentId,
        COALESCE(category.name_km, category.name) AS name,
        category.name_km AS nameKm, category.name_en AS nameEn,
        category.name_zh AS nameZh, category.slug,
        category.image_url AS imageUrl, category.image_media_id AS imageMediaId,
        category_media.object_key AS imageObjectKey,
        category.sort_order AS sortOrder
       FROM categories category
       JOIN visible_category_ids visible ON visible.id = category.id
       LEFT JOIN media category_media
        ON category_media.id=category.image_media_id
        AND category_media.business_id=category.business_id
       WHERE category.business_id = ?
       ORDER BY category.sort_order, category.name`;
  const [categories, products, productImages, productPrices] =
    await env.DB.batch([
      env.DB.prepare(categoryQuery).bind(...scopeBindings,businessId),
      env.DB.prepare(
        `${root ? visibleMenuIds : visibleCategoryIds}
       SELECT product.id, product.code, product.rating,
        product.category_id AS categoryId,
        ${root ? `(SELECT json_group_array(json_array(assignment.menu_id,
          COALESCE(assignment.sort_order,product.sort_order))) ${visibleMenuAssignments}) AS menuOrdersJson,` : ""}
        COALESCE(product.name_km, product.name) AS name,
        product.name_km AS nameKm, product.name_en AS nameEn,
        product.name_zh AS nameZh, product.slug, product.description,
        product.price_cents AS priceCents, product.max_price AS maxPrice,
        product.unit,
        product.portions_json AS portionsJson,
        product.modifier_groups_json AS modifierGroupsJson,
        product.image_url AS imageUrl, product.calories,
        product.primary_media_id AS primaryMediaId,
        product.prep_minutes AS prepMinutes,
        product.is_featured AS isFeatured
       FROM products product
       ${root ? "" : "JOIN visible_category_ids visible ON visible.id = product.category_id"}
       WHERE product.business_id = ? AND product.is_available = 1
       ${root ? `AND EXISTS (SELECT 1 ${visibleMenuAssignments})` : ""}
       ORDER BY product.sort_order, product.name, product.id`,
      ).bind(...scopeBindings,businessId),
      env.DB.prepare(
        `SELECT pi.product_id AS productId, m.id, m.object_key AS objectKey,
        pi.sort_order AS sortOrder, pi.is_primary AS isPrimary
       FROM product_images pi JOIN media m ON m.id = pi.media_id
       WHERE pi.business_id = ? ORDER BY pi.product_id, pi.sort_order`,
      ).bind(businessId),
      env.DB.prepare(
        `SELECT price_list_id AS priceListId, product_id AS productId,
        target_key AS targetKey, price_amount AS priceCents
       FROM product_prices
       WHERE business_id=? AND price_list_id IN (?,?)`,
      ).bind(businessId, pricing.normalId, pricing.activeId),
    ]);
  const categoryRows = (categories.results as Array<
    Json & { id: string; parentId: string | null }
  >).map((category) =>
    root && (category.id === root.id || category.parentId === root.id)
      ? { ...category, parentId: null }
      : category,
  );
  const priceRows = productPrices.results as Json[];
  const normalPrices = priceMap(priceRows, pricing.normalId);
  const activePrices = priceMap(priceRows, pricing.activeId);
  const productRows = (products.results as Json[]).flatMap(
    ({ menuOrdersJson, ...product }) => {
      const priced = applyResolvedPrices(product, normalPrices, activePrices, branch.id);
      const menuOrders = root ? jsonArray(menuOrdersJson) as [string, number][] : null;
      return priced ? [{ product: priced, menuOrders }] : [];
    },
  );
  const parentByCategoryId = new Map(
    categoryRows.map(({ id, parentId }) => [id, parentId]),
  );
  const populatedCategoryIds = new Set<string>();
  for (const { product, menuOrders } of productRows) {
    for (const section of menuOrders?.map(([id]) => id) ?? [product.categoryId]) {
      let categoryId: string | null = String(section);
      while (categoryId && !populatedCategoryIds.has(categoryId)) {
        populatedCategoryIds.add(categoryId);
        categoryId = parentByCategoryId.get(categoryId) ?? null;
      }
    }
  }
  const imagesByProduct = new Map<string, unknown[]>();
  for (const image of productImages.results as Array<Record<string, unknown>>) {
    const productId = String(image.productId);
    const { objectKey, ...publicImage } = image;
    imagesByProduct.set(productId, [
      ...(imagesByProduct.get(productId) ?? []),
      {
        ...publicImage,
        url: mediaUrl(
          env,
          objectKey,
          `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${image.id}`,
        ),
      },
    ]);
  }
  const {
    logoObjectKey,
    businessHoursJson,
    contactNumbersJson,
    socialLinksJson,
    locationsJson,
    latitude,
    longitude,
    wifiSsid,
    wifiPassword,
    wifiSecurity,
    menuThemeJson,
    defaultPriceListId: _defaultPriceListId,
    pricingMode: _pricingMode,
    ...publicBusiness
  } = business;
  publicBusiness.logoUrl = mediaUrl(
    env,
    logoObjectKey,
    String(publicBusiness.logoUrl ?? ""),
  );
  publicBusiness.businessHours = jsonArray(businessHoursJson);
  publicBusiness.contactNumbers = jsonArray(contactNumbersJson);
  publicBusiness.socialLinks = jsonArray(socialLinksJson);
  publicBusiness.locations = jsonArray(locationsJson)
    .map((value) => {
      const location = (value ?? {}) as Record<string, unknown>;
      return {
        ...location,
        showInMenu:
          location.showInMenu == null ? true : Boolean(location.showInMenu),
      };
    })
    .filter((location) => location.showInMenu);
  const primaryPublicLocation = (
    publicBusiness.locations as Array<Record<string, unknown>>
  )[0];
  publicBusiness.mapUrl = String(primaryPublicLocation?.mapUrl ?? "");
  publicBusiness.mapLabel = String(primaryPublicLocation?.label ?? "");
  if (!branch.isDefault) {
    publicBusiness.address = branch.address;
    publicBusiness.phone = branch.phone;
    publicBusiness.contactNumbers = branch.phone ? [{ label: branch.name, number: branch.phone }] : [];
    publicBusiness.mapUrl = branch.mapUrl;
    publicBusiness.mapLabel = branch.name;
    publicBusiness.locations = branch.address || branch.mapUrl
      ? [{ label: branch.name, address: branch.address, mapUrl: branch.mapUrl, showInMenu: true }]
      : [];
  }
  publicBusiness.enableAddToOrder = Boolean(publicBusiness.enableAddToOrder);
  const orderLocation = validCoordinate(latitude, 90) && validCoordinate(longitude, 180)
    ? { latitude, longitude }
    : null;
  publicBusiness.enableSubmitOrder = Boolean(publicBusiness.enableSubmitOrder && orderLocation);
  publicBusiness.orderLocation = publicBusiness.enableSubmitOrder ? orderLocation : null;
  publicBusiness.showHeaderLocation = Boolean(
    publicBusiness.showHeaderLocation,
  );
  publicBusiness.showHeaderPhones = Boolean(publicBusiness.showHeaderPhones);
  publicBusiness.showHeaderWifi = Boolean(publicBusiness.showHeaderWifi);
  publicBusiness.showHeaderSocials = Boolean(publicBusiness.showHeaderSocials);
  publicBusiness.showHeaderTagline = Boolean(publicBusiness.showHeaderTagline);
  publicBusiness.showBusinessHours = Boolean(publicBusiness.showBusinessHours);
  if (publicBusiness.showHeaderWifi) {
    publicBusiness.wifiSsid = wifiSsid;
    publicBusiness.wifiPassword = wifiSecurity === "wpa" ? wifiPassword : "";
    publicBusiness.wifiSecurity = wifiSecurity;
  }
  publicBusiness.menuTheme = parseMenuTheme(
    menuThemeJson,
    publicBusiness.themeColor,
    env,
  );
  return {
    business: publicBusiness,
    branch: { id: branch.id, slug: branch.slug, name: branch.name, isDefault: Boolean(branch.isDefault) },
    menu: root ? { id: root.id, slug: root.slug } : null,
    categories: (root ? orderMenuSections(categoryRows) : categoryRows)
      .filter((category) => populatedCategoryIds.has(category.id))
      .map((category) => {
        const { imageObjectKey, ...publicCategory } = category;
        return {
          ...publicCategory,
          imageUrl: mediaUrl(
            env,
            imageObjectKey,
            String(publicCategory.imageUrl ?? (publicCategory.imageMediaId
              ? `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${publicCategory.imageMediaId}` : "")),
          ),
        };
      }),
    products: productRows.map(({ product, menuOrders }) => {
      const images = imagesByProduct.get(String(product.id)) ?? [];
      const primaryImage = images.find(
        (image) =>
          (image as Record<string, unknown>).isPrimary === 1 ||
          (image as Record<string, unknown>).id === product.primaryMediaId,
      ) as Record<string, unknown> | undefined;
      return {
        ...product,
        ...(menuOrders ? {
          menuIds: menuOrders.map(([id]) => id),
          menuSortOrders: Object.fromEntries(menuOrders),
        } : {}),
        imageUrl: String(primaryImage?.url ?? product.imageUrl ?? ""),
        images,
      };
    }),
    banners:
      resolvedBanners ??
      (await activeBanners(env, businessId, pricing.timezone)),
  };
}

type OrderLineInput = {
  productId: string;
  portionId: string | null;
  modifierIds: string[];
  quantity: number;
  expectedPrice: number;
  note: string;
};

function parseOrderLines(value: unknown): OrderLineInput[] | null {
  if (!Array.isArray(value) || !value.length || value.length > 30) return null;
  const lines: OrderLineInput[] = [];
  for (const raw of value) {
    const {
      productId,
      portionId = null,
      modifierIds = [],
      quantity,
      expectedPrice,
      note = "",
    } = (raw ?? {}) as Json;
    if (
      typeof productId !== "string" ||
      !PRODUCT_OPTION_ID_PATTERN.test(productId) ||
      (portionId !== null &&
        (typeof portionId !== "string" ||
          !PRODUCT_OPTION_ID_PATTERN.test(portionId))) ||
      !Array.isArray(modifierIds) ||
      modifierIds.length > 360 ||
      modifierIds.some(
        (option) =>
          typeof option !== "string" || !option.length || option.length > 80,
      ) ||
      new Set(modifierIds).size !== modifierIds.length ||
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 999 ||
      typeof expectedPrice !== "number" ||
      !Number.isFinite(expectedPrice) ||
      expectedPrice < 0 ||
      typeof note !== "string" ||
      note.length > 500
    )
      return null;
    lines.push({
      productId,
      portionId,
      modifierIds: [...modifierIds].sort(),
      quantity,
      expectedPrice,
      note: note.trim(),
    });
  }
  return lines;
}

const orderReceiptSql = `SELECT id AS orderId, table_id AS tableId, order_number AS orderNumber, posting_date AS postingDate,
  submitted_at AS submittedAt, total_quantity AS totalQuantity, total_amount AS totalAmount, currency, status,
  note, submission_hash AS submissionHash
  FROM orders WHERE business_id=? AND table_id=? AND submission_id=?`;
const DEVICE_ORDER_WINDOW_MS = 60 * 60 * 1000;

type OrderReceipt = {
  orderId: string;
  tableId: string;
  orderNumber: string;
  postingDate: string;
  submittedAt: string | null;
  totalQuantity: number;
  totalAmount: number;
  currency: string;
  status: string;
  note: string;
  submissionHash: string;
};

function orderResponse(order: OrderReceipt, hash: string, status: number) {
  const { submissionHash, ...receipt } = order;
  return submissionHash === hash
    ? json(receipt, status, { "cache-control": "no-store" })
    : json(
        {
          code: "submission_conflict",
          error: "This submission ID belongs to a different order",
        },
        409,
      );
}

function validCoordinate(value: unknown, limit: number): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= limit
  );
}

async function submitOrder(request: Request, env: Env, slug: string, execution: ExecutionContext) {
  const body = await readJson(request).catch(() => null);
  const lines = parseOrderLines(body?.items);
  const {
    submissionId,
    tableToken,
    tableId: scannedTableId,
    expectedCurrency,
    note: rawNote = "",
    branch: branchSlug = null,
    menu: menuSlug = null,
  } = body ?? {};
  if (
    !lines ||
    typeof submissionId !== "string" ||
    !UUID_PATTERN.test(submissionId) ||
    typeof tableToken !== "string" ||
    !PRODUCT_OPTION_ID_PATTERN.test(tableToken) ||
    typeof rawNote !== "string" ||
    rawNote.length > 500 ||
    (branchSlug !== null && typeof branchSlug !== "string") ||
    (menuSlug !== null && typeof menuSlug !== "string") ||
    (expectedCurrency !== "USD" && expectedCurrency !== "KHR")
  )
    return json(
      {
        code: "invalid_order",
        error: "Invalid order data or missing table QR token",
      },
      400,
    );

  const context = await env.DB.prepare(
    `SELECT business.id AS businessId, business.currency, business.timezone,
      business.is_active AS businessActive, business.enable_add_to_order AS orderingEnabled,
      business.allow_category_browsing AS allowCategoryBrowsing,
      ${branchOrderColumns},
      branch.id AS branchId, branch.is_active AS branchActive, business.menu_cache_version AS catalogVersion,
      business.pricing_mode AS pricingMode, business.default_price_list_id AS defaultPriceListId,
      tables.id AS tableId, tables.is_active AND groups.is_active AS tableActive
     FROM businesses business
     JOIN restaurant_tables tables ON tables.business_id=business.id
     JOIN table_groups groups ON groups.id=tables.group_id AND groups.business_id=business.id
     JOIN branches branch ON branch.id=tables.branch_id AND branch.id=groups.branch_id AND branch.business_id=business.id
     WHERE business.slug=? AND tables.public_token=?
       AND ((? IS NULL AND branch.is_default=1) OR branch.slug=?)`,
  )
    .bind(slug, tableToken, branchSlug, branchSlug)
    .first<{
      businessId: string;
      currency: string;
      timezone: string;
      businessActive: number;
      orderingEnabled: number;
      allowCategoryBrowsing: number;
      enableSubmitOrder: number;
      latitude: number | null;
      longitude: number | null;
      orderRadiusMeters: number;
      branchId: string;
      branchActive: number;
      catalogVersion: number;
      pricingMode: string;
      defaultPriceListId: string | null;
      tableId: string;
      tableActive: number;
    }>();
  if (
    !context ||
    (scannedTableId !== undefined && scannedTableId !== context.tableId)
  )
    return json(
      { code: "table_unavailable", error: "Table is unavailable" },
      404,
    );
  const { businessId, tableId, branchId, currency } = context;
  const root = menuSlug === null ? null : await findMenuRoot(env.DB, businessId, menuSlug);
  if (menuSlug !== null && !root)
    return json({ code: "menu_unavailable", error: "Menu is unavailable" }, 404);
  const receipt = env.DB.prepare(orderReceiptSql).bind(
    businessId,
    tableId,
    submissionId,
  );
  const note = rawNote.trim();
  const hash = bytesToHex(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify({
        expectedCurrency,
        lines,
        ...(root ? { menuId: root.id } : {}),
        ...(note ? { note } : {}),
      })),
    ),
  );
  const existing = await receipt.first<OrderReceipt>();
  if (existing) return orderResponse(existing, hash, 200);
  const deviceId = body?.deviceId;
  if (typeof deviceId !== "string" || !UUID_PATTERN.test(deviceId))
    return json(
      { code: "invalid_device", error: "Refresh the menu before submitting a new order" },
      400,
    );
  const normalizedDeviceId = deviceId.toLowerCase();
  if (!context.businessActive || !context.tableActive || !context.branchActive)
    return json(
      { code: "table_unavailable", error: "Table is unavailable" },
      404,
    );
  if (root ? !root.isActive : !context.allowCategoryBrowsing)
    return json({ code: "menu_unavailable", error: "Menu is unavailable" }, 404);
  const { latitude, longitude, orderRadiusMeters } = context;
  if (
    !context.orderingEnabled ||
    !context.enableSubmitOrder ||
    latitude === null ||
    longitude === null
  )
    return json(
      { code: "ordering_disabled", error: "Ordering is disabled" },
      403,
    );
  const customerLatitude = body?.latitude;
  const customerLongitude = body?.longitude;
  if (
    !validCoordinate(customerLatitude, 90) ||
    !validCoordinate(customerLongitude, 180)
  )
    return json(
      {
        code: "location_required",
        error: "A valid customer location is required",
      },
      400,
    );
  if (
    distanceMeters(latitude, longitude, customerLatitude, customerLongitude) >
    orderRadiusMeters
  )
    return json(
      {
        code: "outside_order_radius",
        error: "Customer is outside the ordering radius",
        orderRadiusMeters,
      },
      403,
    );
  const priceChanged = () =>
    json(
      {
        code: "price_changed",
        error: "Menu prices changed. Review the latest prices.",
      },
      409,
    );
  if (expectedCurrency !== currency) return priceChanged();

  const pricing = await resolvePriceList(
    env,
    businessId,
    context.pricingMode,
    context.defaultPriceListId,
    context.timezone,
  );
  const productIds = [...new Set(lines.map((line) => line.productId))];
  const placeholders = productIds.map(() => "?").join(",");
  const scopeBindings = root ? [businessId, root.id, businessId] : [businessId, businessId];
  const [products, prices] = await env.DB.batch<Json>([
    env.DB.prepare(
      `${root ? visibleMenuIds : visibleCategoryIds}
       SELECT product.id, product.code, COALESCE(NULLIF(product.name_km,''),product.name) AS name,
         product.price_cents AS priceCents,
         product.portions_json AS portionsJson, product.modifier_groups_json AS modifierGroupsJson
       FROM products product
       ${root ? "" : "JOIN visible_category_ids visible ON visible.id=product.category_id"}
       WHERE product.business_id=? AND product.is_available=1 AND product.id IN (${placeholders})
       ${root ? `AND EXISTS (SELECT 1 ${visibleMenuAssignments})` : ""}`,
    ).bind(...scopeBindings, businessId, ...productIds),
    env.DB.prepare(
      `SELECT price_list_id AS priceListId, product_id AS productId,
        target_key AS targetKey, price_amount AS priceCents
       FROM product_prices WHERE business_id=? AND price_list_id IN (?,?)
         AND product_id IN (${placeholders})`,
    ).bind(businessId, pricing.normalId, pricing.activeId, ...productIds),
  ]);
  const normalPrices = priceMap(prices.results, pricing.normalId);
  const activePrices = priceMap(prices.results, pricing.activeId);
  const catalog = new Map(
    products.results.flatMap((product) => {
      const priced = applyResolvedPrices(product, normalPrices, activePrices, branchId);
      return priced ? [[product.id, priced] as const] : [];
    }),
  );
  const invalidSelection = () =>
    json(
      {
        code: "selection_changed",
        error: "A product, portion, or modifier is unavailable",
      },
      409,
    );
  const orderId = id("ord");
  const insertLine = env.DB.prepare(
    `INSERT INTO order_products
      (order_id,line_number,product_id,quantity,price,portion_name,price_list,modifiers,total_amount,note,
       portion_id,product_code,product_name)
     SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM orders WHERE id=?)`,
  );
  const inserts: D1PreparedStatement[] = [];
  let totalQuantity = 0;
  let totalAmount = 0;
  for (const line of lines) {
    const product = catalog.get(line.productId);
    if (!product) return invalidSelection();
    const portion = product.portions.find(
      (entry) => entry.id === line.portionId,
    );
    if ((line.portionId && !portion) || (product.portions.length && !portion))
      return invalidSelection();

    const modifiers: Json[] = [];
    const groups = product.modifierGroups as Array<{
      id: string;
      required: boolean;
      multiple: boolean;
      options: Json[];
    }>;
    for (const group of groups) {
      const selected = group.options.filter((option) =>
        line.modifierIds.includes(String(option.id)),
      );
      if (
        (group.required && !selected.length) ||
        (!group.multiple && selected.length > 1)
      )
        return invalidSelection();
      modifiers.push(
        ...selected.map((option) => ({ ...option, groupId: group.id })),
      );
    }
    if (modifiers.length !== line.modifierIds.length) return invalidSelection();

    const basePrice = Number(portion?.priceCents ?? product.priceCents);
    const price =
      basePrice +
      modifiers.reduce(
        (sum, option) => sum + Number(option.priceCents || 0),
        0,
      );
    const amount = price * line.quantity;
    if (!Number.isFinite(amount) || amount < 0) return invalidSelection();
    if (
      Math.abs(price - line.expectedPrice) >
      Number.EPSILON * Math.max(1, price) * 4
    )
      return priceChanged();

    const target = `${line.productId}:${line.portionId ?? "base"}`;
    const priceList = activePrices.has(target)
      ? pricing.activeId
      : pricing.normalId;
    totalQuantity += line.quantity;
    totalAmount += amount;
    inserts.push(
      insertLine.bind(
        orderId,
        inserts.length + 1,
        line.productId,
        line.quantity,
        price,
        String(portion?.labelKm || ""),
        priceList,
        JSON.stringify(modifiers),
        amount,
        line.note,
        line.portionId,
        product.code ?? null,
        product.name,
        orderId,
      ),
    );
  }
  if (!Number.isFinite(totalAmount)) return invalidSelection();

  const submittedAt = new Date();
  const deviceWindowStart = new Date(
    submittedAt.getTime() - DEVICE_ORDER_WINDOW_MS,
  ).toISOString();
  const postingDate = localDateKey(submittedAt, pricing.timezone);
  const numberPrefix = postingDate.slice(2).replaceAll("-", "");
  // Only the request that inserts its candidate ID can insert lines for it.
  const [header, ...results] = await env.DB.batch<OrderReceipt>([
    env.DB.prepare(
      `INSERT INTO orders
        (id,business_id,posting_date,table_id,branch_id,menu_id,total_quantity,total_amount,currency,submission_id,submission_hash,submitted_at,device_id,note,order_number)
       SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,? || '-' || printf('%03d', serial)
       FROM (
         SELECT COALESCE(CAST(substr(MAX(order_number), 8) AS INTEGER), 0) + 1 AS serial
         FROM orders WHERE business_id=? AND posting_date=?
       )
       WHERE serial <= ${MAX_DAILY_ORDERS} AND EXISTS (
         SELECT 1 FROM businesses business
         JOIN branches branch ON branch.business_id=business.id
         JOIN restaurant_tables tables ON tables.business_id=business.id AND tables.branch_id=branch.id
         JOIN table_groups groups ON groups.id=tables.group_id AND groups.is_active=1
         WHERE business.id=? AND business.is_active=1 AND enable_add_to_order=1
           AND ${branchOrderPolicy.enabled}=1
           AND branch.id=? AND branch.is_active=1 AND tables.id=? AND tables.is_active=1
           AND ${branchOrderPolicy.latitude}=?
           AND ${branchOrderPolicy.longitude}=?
           AND (${branchOrderPolicy.radius})=?
           AND business.menu_cache_version=?
           AND (
             hourly_device_order_limit=0 OR (
               SELECT COUNT(*) FROM orders
               WHERE business_id=business.id AND device_id=? AND submitted_at>?
             ) < hourly_device_order_limit
           )
       )
       ON CONFLICT (business_id,table_id,submission_id) DO NOTHING`,
    ).bind(
      orderId,
      businessId,
      postingDate,
      tableId,
      branchId,
      root?.id ?? null,
      totalQuantity,
      totalAmount,
      currency,
      submissionId,
      hash,
      submittedAt.toISOString(),
      normalizedDeviceId,
      note,
      numberPrefix,
      businessId,
      postingDate,
      businessId,
      branchId,
      tableId,
      latitude,
      longitude,
      orderRadiusMeters,
      context.catalogVersion,
      normalizedDeviceId,
      deviceWindowStart,
    ),
    ...inserts,
    captureWebhook(env.DB, "orders", "inserted", "r.business_id=? AND r.id=?", [businessId, orderId]),
    receipt,
  ]);
  const saved = results.at(-1)?.results[0];
  if (!saved) {
    const atLimit = await env.DB.prepare(
      "SELECT 1 FROM orders WHERE business_id=? AND posting_date=? AND order_number=?",
    )
      .bind(businessId, postingDate, `${numberPrefix}-${MAX_DAILY_ORDERS}`)
      .first();
    if (atLimit)
      return json(
        {
          code: "order_limit_reached",
          error: "The business has reached its daily order limit",
        },
        409,
      );
    const limitingOrder = await env.DB.prepare(
      `WITH quota AS (
         SELECT hourly_device_order_limit FROM businesses WHERE id=? AND hourly_device_order_limit>0
       )
       SELECT submitted_at FROM orders WHERE business_id=? AND device_id=? AND submitted_at>?
         AND EXISTS (SELECT 1 FROM quota)
       ORDER BY submitted_at DESC LIMIT 1
       OFFSET COALESCE((SELECT hourly_device_order_limit - 1 FROM quota), 0)`,
    )
      .bind(businessId, businessId, normalizedDeviceId, deviceWindowStart)
      .first<{ submitted_at: string }>();
    if (limitingOrder) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((Date.parse(limitingOrder.submitted_at) + DEVICE_ORDER_WINDOW_MS - Date.now()) / 1000),
      );
      return json(
        {
          code: "device_order_limit_reached",
          error: "This device has reached its hourly order limit",
          retryAfterSeconds,
        },
        429,
        { "retry-after": String(retryAfterSeconds), "cache-control": "no-store" },
      );
    }
    return json(
      {
        code: "ordering_settings_changed",
        error: "Ordering settings changed. Reload the menu and try again.",
      },
      409,
    );
  }
  if (header.meta.changes) {
    scheduleBranchWebhooks(env, execution, businessId);
    execution.waitUntil(deliverTelegramOrder(env, orderId).catch(() => {
      console.error("telegram_order_delivery_failed", { orderId });
    }));
    execution.waitUntil(deliverTelegramNotifications(env, "Order", orderId).catch(() => {
      console.error("custom_telegram_order_delivery_failed", { orderId });
    }));
    const orderEvents = env.ORDER_EVENTS?.getByName(businessId);
    if (orderEvents) {
      execution.waitUntil(orderEvents.broadcast(businessId, {
        type: "order.submitted",
        order: {
          id: saved.orderId,
          order_number: saved.orderNumber,
          table_id: saved.tableId,
          branch_id: branchId,
          posting_date: saved.postingDate,
          submitted_at: saved.submittedAt,
          total_quantity: saved.totalQuantity,
          total_amount: saved.totalAmount,
          currency: saved.currency,
        },
      }).catch(() => console.error("order_websocket_broadcast_failed", { orderId })));
    }
  }
  return orderResponse(saved, hash, header.meta.changes ? 201 : 200);
}

async function businessLanguages(env: Env, businessId: string) {
  return (
    (await env.DB.prepare(
      `SELECT enable_en AS enableEn, enable_zh AS enableZh
       FROM businesses WHERE id=?`,
    )
      .bind(businessId)
      .first<{ enableEn: number; enableZh: number }>()) ?? {
      enableEn: 0,
      enableZh: 0,
    }
  );
}

function priceListFields(body: Json, isNormal = false) {
  const name = String(body.name ?? "")
    .trim()
    .slice(0, 80);
  const scheduleEnabled = !isNormal && Boolean(body.scheduleEnabled);
  const scheduleStartLocal = scheduleEnabled
    ? String(body.scheduleStartLocal ?? "")
    : "";
  const scheduleEndLocal = scheduleEnabled
    ? String(body.scheduleEndLocal ?? "")
    : "";
  if (!name) return { error: "Price list name is required" } as const;
  if (
    scheduleEnabled &&
    (!validLocalDateTime(scheduleStartLocal) ||
      !validLocalDateTime(scheduleEndLocal) ||
      scheduleStartLocal >= scheduleEndLocal)
  )
    return {
      error: "Schedule end must be after a valid schedule start",
    } as const;
  return {
    name,
    scheduleEnabled,
    scheduleStartLocal: scheduleStartLocal || null,
    scheduleEndLocal: scheduleEndLocal || null,
  };
}

async function overlappingPriceList(
  env: Env,
  businessId: string,
  start: string,
  end: string,
  excludeId = "",
) {
  return env.DB.prepare(
    `SELECT id, name FROM price_lists
     WHERE business_id=? AND is_archived=0 AND schedule_enabled=1
       AND id<>? AND schedule_start_local<? AND schedule_end_local>?
     LIMIT 1`,
  )
    .bind(businessId, excludeId, end, start)
    .first<{ id: string; name: string }>();
}

async function productPriceStatements(
  env: Env,
  businessId: string,
  productId: string,
  basePrice: number,
  portions: Array<{ id: string; priceCents: number | null }>,
  submitted: PriceEntryInput[] | undefined,
) {
  const normalId = await normalPriceListId(env, businessId);
  if (!normalId)
    return { error: "Normal Rate price list was not found" } as const;
  const validTargets = new Set([
    ...(portions.length ? [] : ["base"]),
    ...portions.map((portion) => portion.id),
  ]);
  if (submitted?.some((entry) => !validTargets.has(entry.targetKey)))
    return {
      error: "A price references a portion that does not exist",
    } as const;

  const specialListIds = [
    ...new Set(
      (submitted || [])
        .map((entry) => entry.priceListId)
        .filter((listId) => listId !== normalId),
    ),
  ];
  if (specialListIds.length) {
    const placeholders = specialListIds.map(() => "?").join(",");
    const owned = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM price_lists
       WHERE business_id=? AND is_archived=0 AND id IN (${placeholders})`,
    )
      .bind(businessId, ...specialListIds)
      .first<{ total: number }>();
    if (Number(owned?.total || 0) !== specialListIds.length)
      return { error: "A selected price list was not found" } as const;
  }

  const upsert = (priceListId: string, targetKey: string, amount: number) =>
    env.DB.prepare(
      `INSERT INTO product_prices
       (business_id,price_list_id,product_id,target_key,price_amount)
       VALUES (?,?,?,?,?)
       ON CONFLICT(price_list_id,product_id,target_key) DO UPDATE SET
        price_amount=excluded.price_amount,updated_at=CURRENT_TIMESTAMP`,
    ).bind(businessId, priceListId, productId, targetKey, amount);

  const statements: D1PreparedStatement[] = [];
  if (submitted) {
    for (const priceListId of specialListIds)
      statements.push(
        env.DB.prepare(
          "DELETE FROM product_prices WHERE business_id=? AND product_id=? AND price_list_id=?",
        ).bind(businessId, productId, priceListId),
      );
  }
  const targets = [...validTargets];
  const targetPlaceholders = targets.map(() => "?").join(",");
  statements.push(
    env.DB.prepare(
      `DELETE FROM product_prices
       WHERE business_id=? AND product_id=? AND target_key NOT IN (${targetPlaceholders})`,
    ).bind(businessId, productId, ...targets),
  );
  if (!portions.length) statements.push(upsert(normalId, "base", basePrice));
  for (const portion of portions)
    statements.push(upsert(normalId, portion.id, Number(portion.priceCents)));
  for (const entry of submitted || []) {
    if (entry.priceListId === normalId || entry.priceCents == null) continue;
    statements.push(
      upsert(entry.priceListId, entry.targetKey, entry.priceCents),
    );
  }
  return { statements, normalId } as const;
}

async function handle(request: Request, env: Env, execution: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  let path = url.pathname.replace(/\/$/, "") || "/";

  if (request.method === "OPTIONS")
    return new Response(null, {
      status: 204,
      headers: {
        ...cors(request, env),
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "access-control-allow-headers": isPosApiPath(path)
          ? "content-type,authorization,idempotency-key" : "content-type,authorization",
      },
    });
  const publicBusiness = path.match(/^\/api\/public\/businesses\/([a-z0-9-]+)(\/.*)$/);
  if (publicBusiness) {
    const canonical = await env.DB.prepare(
      `SELECT b.slug FROM business_slug_aliases a JOIN businesses b ON b.id=a.business_id
       WHERE a.slug=?`,
    ).bind(publicBusiness[1]).first<string>("slug");
    if (canonical) path = `/api/public/businesses/${canonical}${publicBusiness[2]}`;
  }
  if (path === "/health")
    return json({ ok: true, service: "angkor-emenu-api" });

  if (isPosApiPath(path)) return handlePosApi(request, env, {
    verifyCredentials: async (email, proof, version, bindings) => {
      if (version !== AUTH_SCHEME || !PASSWORD_PROOF_PATTERN.test(proof)) return null;
      if (!authConfigured(bindings)) return null;
      const result = await verifyAccount(bindings, email, proof);
      return result.status === "verified" ? result.account : null;
    },
    localDate: localDateKey,
    subscription: (identity) => subscriptionSummary(identity, identity.timezone),
    pricing: resolvePriceList,
    priceMap,
    pricedProduct: applyResolvedPrices,
  });

  if (path === "/api/integrations/pos/orders/ws")
    return connectPosOrderEvents(request, env);
  const posOrderMatch = path.match(
    /^\/api\/integrations\/pos\/orders(?:\/([a-zA-Z0-9_-]{1,80}))?$/,
  );
  if (posOrderMatch)
    return handlePosOrders(
      request,
      env,
      execution,
      (identity) => subscriptionSummary(identity, identity.timezone),
      posOrderMatch[1],
    );

  if (
    path === "/api/integrations/pos/sync" ||
    path === "/api/integrations/pos/sync/product" ||
    path === "/api/integrations/pos/sync/tables"
  )
    return handlePosSync(
      request,
      env,
      (identity) => subscriptionSummary(identity, identity.timezone),
      path.endsWith("/tables")
        ? "tables"
        : path.endsWith("/product")
          ? "product"
          : "catalog",
    );

  const publicDomainMatch = path.match(/^\/api\/public\/domains\/([^/]+)$/);
  if (request.method === "GET" && publicDomainMatch) {
    let hostname: string | null = null;
    try {
      hostname = normalizeMenuHostname(
        decodeURIComponent(publicDomainMatch[1]),
      );
    } catch {
      hostname = null;
    }
    if (!hostname) return json({ error: "Menu domain not found" }, 404);
    const business = await env.DB.prepare(
      `SELECT slug FROM businesses
       WHERE custom_menu_hostname = ? COLLATE NOCASE AND is_active = 1`,
    )
      .bind(hostname)
      .first<{ slug: string }>();
    return business
      ? json({ slug: business.slug }, 200, { "cache-control": "no-store" })
      : json({ error: "Menu domain not found" }, 404, {
          "cache-control": "no-store",
        });
  }

  const publicMatch = path.match(
    /^\/api\/public\/businesses\/([a-z0-9-]+)\/menu$/,
  );
  if (request.method === "GET" && publicMatch) {
    const { menu, cacheStatus } = await cachedPublicMenu(publicMatch[1], env,
      url.searchParams.get("branch"), url.searchParams.get("menu"));
    return menu
      ? json(menu, 200, {
          "cache-control": "no-store",
          "x-catalog-cache": cacheStatus,
        })
      : json({ error: "Menu not found" }, 404, { "cache-control": "no-store" });
  }

  const bookingMatch = path.match(/^\/api\/public\/businesses\/([a-z0-9-]+)\/bookings$/);
  if (bookingMatch) return publicBookings(request, url, env, bookingMatch[1], execution);

  const orderMatch = path.match(
    /^\/api\/public\/businesses\/([a-z0-9-]+)\/orders$/,
  );
  if (request.method === "POST" && orderMatch) {
    return submitOrder(request, env, orderMatch[1], execution);
  }

  const orderStatusMatch = path.match(
    /^\/api\/public\/businesses\/([a-z0-9-]+)\/orders\/(ord_[a-f0-9]{32})$/,
  );
  if (request.method === "GET" && orderStatusMatch) {
    const [, slug, orderId] = orderStatusMatch;
    const receiptKey = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    const headers = { "cache-control": "private, no-store" };
    if (!receiptKey || !UUID_PATTERN.test(receiptKey))
      return json({ error: "Order not found" }, 404, headers);

    const order = await env.DB.prepare(
      `SELECT orders.status, orders.posting_date AS postingDate, orders.submitted_at AS submittedAt,
        orders.table_id AS tableId, orders.total_amount AS totalAmount, orders.currency, orders.note
       FROM orders
       JOIN businesses ON businesses.id=orders.business_id
       WHERE businesses.slug=? AND orders.id=? AND orders.submission_id=?`,
    ).bind(slug, orderId, receiptKey).first();
    if (!order) return json({ error: "Order not found" }, 404, headers);
    if (url.searchParams.get("details") !== "1")
      return json({ status: order.status }, 200, headers);

    const items = await env.DB.prepare(
      `SELECT line.product_id AS productId, line.quantity, line.portion_name AS portionName, line.modifiers, line.status,
        COALESCE(NULLIF(product.name_km,''),product.name,line.product_id) AS name,
        product.name_en AS nameEn, product.name_zh AS nameZh
       FROM order_products line
       JOIN orders ON orders.id=line.order_id
       LEFT JOIN products product ON product.id=line.product_id AND product.business_id=orders.business_id
       WHERE line.order_id=?
       ORDER BY line.line_number`,
    ).bind(orderId).all();
    return json({
      ...order,
      items: items.results.map((line) => ({
        ...line,
        modifiers: jsonArray(line.modifiers),
      })),
    }, 200, headers);
  }

  const tableContextMatch = path.match(
    /^\/api\/public\/businesses\/([a-z0-9-]+)\/table-context\/([a-zA-Z0-9_-]+)$/,
  );
  if (request.method === "GET" && tableContextMatch) {
    const tableId = url.searchParams.get("table_id");
    const branchSlug = url.searchParams.get("branch");
    const context = await env.DB.prepare(
      `SELECT restaurant_tables.id AS tableId, restaurant_tables.code, restaurant_tables.label,
        table_groups.name AS groupName, branch.id AS branchId
       FROM restaurant_tables
       JOIN table_groups ON table_groups.id = restaurant_tables.group_id
        AND table_groups.business_id = restaurant_tables.business_id
       JOIN businesses ON businesses.id = restaurant_tables.business_id
       JOIN branches branch ON branch.id=restaurant_tables.branch_id AND branch.business_id=businesses.id
       WHERE businesses.slug = ? AND businesses.is_active = 1
        AND restaurant_tables.public_token = ?
        AND (? IS NULL OR restaurant_tables.id = ?)
        AND branch.is_active=1 AND ((? IS NULL AND branch.is_default=1) OR branch.slug=?)
        AND restaurant_tables.is_active = 1 AND table_groups.is_active = 1`,
    )
      .bind(tableContextMatch[1], tableContextMatch[2], tableId, tableId, branchSlug, branchSlug)
      .first();
    return context
      ? json(context, 200, { "cache-control": "no-store" })
      : json({ error: "Table is unavailable" }, 404);
  }

  const analyticsEventMatch = path.match(
    /^\/api\/public\/businesses\/([a-z0-9-]+)\/analytics\/events$/,
  );
  if (request.method === "POST" && analyticsEventMatch) {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 32_768)
      return json({ error: "Analytics batch is too large" }, 413);
    const body = await readJson(request);
    const sessionId = String(body.sessionId ?? "");
    const rawEvents = Array.isArray(body.events) ? body.events : [];
    if (
      !UUID_PATTERN.test(sessionId) ||
      !rawEvents.length ||
      rawEvents.length > 25
    )
      return json({ error: "Invalid analytics batch" }, 400);

    const business = await env.DB.prepare(
      `SELECT id,timezone FROM businesses WHERE slug=? AND is_active=1`,
    )
      .bind(analyticsEventMatch[1])
      .first<{ id: string; timezone: string }>();
    if (!business) return json({ error: "Menu not found" }, 404);
    const branch = await findBranch(env.DB, business.id, typeof body.branch === "string" ? body.branch : null);
    if (!branch?.isActive) return json({ error: "Branch is unavailable" }, 404);

    const tableToken = String(body.tableToken ?? "");
    let tableId = "";
    if (tableToken) {
      if (!RECORD_ID_PATTERN.test(tableToken))
        return json({ error: "Invalid table context" }, 400);
      const table = await env.DB.prepare(
        `SELECT tables.id FROM restaurant_tables tables
         JOIN table_groups groups ON groups.id=tables.group_id
          AND groups.business_id=tables.business_id
         WHERE tables.business_id=? AND tables.public_token=?
          AND tables.branch_id=?
          AND tables.is_active=1 AND groups.is_active=1`,
      )
        .bind(business.id, tableToken, branch.id)
        .first<{ id: string }>();
      if (!table) return json({ error: "Table is unavailable" }, 400);
      tableId = table.id;
    }

    const [products, categories, banners] = await env.DB.batch([
      env.DB.prepare(
        "SELECT id,COALESCE(name_km,name) AS label FROM products WHERE business_id=?",
      ).bind(business.id),
      env.DB.prepare(
        "SELECT id,COALESCE(name_km,name) AS label FROM categories WHERE business_id=?",
      ).bind(business.id),
      env.DB.prepare(
        "SELECT id,title AS label FROM banners WHERE business_id=?",
      ).bind(business.id),
    ]);
    const labels = (rows: D1Result<unknown>) =>
      new Map(
        (rows.results as Array<Record<string, unknown>>).map((row) => [
          String(row.id),
          String(row.label || ""),
        ]),
      );
    const productLabels = labels(products);
    const categoryLabels = labels(categories);
    const bannerLabels = labels(banners);
    const local = analyticsLocalNow(business.timezone || "UTC");
    const statements: D1PreparedStatement[] = [];

    for (const value of rawEvents) {
      const event = (value ?? {}) as Record<string, unknown>;
      const eventId = String(event.id ?? "");
      const eventType = String(event.type ?? "");
      const language = ANALYTICS_LANGUAGES.has(String(event.language))
        ? String(event.language)
        : "km";
      if (!UUID_PATTERN.test(eventId) || !ANALYTICS_EVENT_TYPES.has(eventType))
        return json({ error: "Invalid analytics event" }, 400);

      const productId = String(event.productId ?? "");
      const categoryId = String(event.categoryId ?? "");
      const bannerId = String(event.bannerId ?? "");
      if (productId && !productLabels.has(productId))
        return json({ error: "Analytics product was not found" }, 400);
      if (categoryId && !categoryLabels.has(categoryId))
        return json({ error: "Analytics category was not found" }, 400);
      if (bannerId && !bannerLabels.has(bannerId))
        return json({ error: "Analytics banner was not found" }, 400);

      const searchTerm =
        eventType === "search" ? normalizeSearchTerm(event.searchTerm) : "";
      if (eventType === "search" && searchTerm.length < 2)
        return json({ error: "Search phrase is too short" }, 400);
      const resultCount =
        eventType === "search"
          ? Math.max(
              0,
              Math.min(100_000, Math.floor(Number(event.resultCount) || 0)),
            )
          : null;
      const actionKind =
        eventType === "contact_click" &&
        ANALYTICS_ACTIONS.has(String(event.actionKind))
          ? String(event.actionKind)
          : "";
      if (eventType === "contact_click" && !actionKind)
        return json({ error: "Invalid contact action" }, 400);
      const entityLabel =
        productLabels.get(productId) ||
        categoryLabels.get(categoryId) ||
        bannerLabels.get(bannerId) ||
        "";

      statements.push(
        env.DB.prepare(
          `INSERT OR IGNORE INTO analytics_events
           (id,business_id,session_id,event_type,table_id,branch_id,product_id,category_id,
            banner_id,entity_label,language,search_term,search_result_count,
            action_kind,source_type,local_date,local_hour)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        ).bind(
          eventId,
          business.id,
          sessionId,
          eventType,
          tableId || null,
          branch.id,
          productId || null,
          categoryId || null,
          bannerId || null,
          entityLabel,
          language,
          searchTerm,
          resultCount,
          actionKind,
          tableId ? "table" : "general",
          local.localDate,
          local.localHour,
        ),
      );
    }
    await env.DB.batch(statements);
    return json({ accepted: statements.length }, 202, {
      "cache-control": "no-store",
    });
  }

  const publicMediaMatch = path.match(/^\/media\/([a-zA-Z0-9_-]+)$/);
  if (request.method === "GET" && publicMediaMatch) {
    const item = await env.DB.prepare(
      `SELECT m.object_key AS objectKey, m.content_type AS contentType
       FROM media m
       JOIN businesses b ON b.id = m.business_id
       WHERE m.id = ? AND b.is_active = 1`,
    )
      .bind(publicMediaMatch[1])
      .first<{ objectKey: string; contentType: string }>();
    if (!item) return json({ error: "Media not found" }, 404);
    const object = await env.MEDIA.get(item.objectKey);
    return object
      ? new Response(object.body, {
          headers: {
            "content-type": item.contentType,
            "cache-control": "public, max-age=86400",
            etag: object.httpEtag,
          },
        })
      : json({ error: "Media not found" }, 404);
  }

  if (request.method === "GET" && path === "/api/public/subscription-plans")
    return json({ plans: await publicPlans(env.DB) }, 200, { "cache-control": "no-store" });

  if (request.method === "POST" && path === "/api/auth/register") {
    const body = await readJson(request);
    const email = String(body.email ?? "")
      .toLowerCase()
      .trim();
    const passwordProof = String(body.passwordProof ?? "").toLowerCase();
    const authVersion = String(body.authVersion ?? "");
    const businessName = String(body.businessName ?? "").trim();
    const displayName = String(body.displayName ?? "").trim();
    const businessSlug = String(body.slug ?? "");
    if (
      !email.includes("@") ||
      authVersion !== AUTH_SCHEME ||
      !PASSWORD_PROOF_PATTERN.test(passwordProof) ||
      businessName.length < 2
    )
      return json({ error: "Please provide valid registration details" }, 400);
    if (
      businessSlug.length < 3 ||
      businessSlug.length > 48 ||
      !BUSINESS_SLUG_PATTERN.test(businessSlug)
    )
      return json(
        {
          code: "INVALID_MENU_SLUG",
          error:
            "Menu link must be 3-48 lowercase letters, numbers, or single hyphens",
        },
        400,
      );
    if (!authConfigured(env))
      return json({ error: "Authentication is not configured" }, 503);
    const [existingUser, existingBusiness] = await Promise.all([
      env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first(),
      businessSlugOwner(env.DB, businessSlug),
    ]);
    if (existingUser)
      return json(
        { code: "EMAIL_IN_USE", error: "Email is already in use" },
        409,
      );
    if (existingBusiness)
      return json(
        {
          code: "MENU_SLUG_IN_USE",
          error: "Menu link is already in use",
        },
        409,
      );
    const plan = await registrationPlan(env.DB, body, true);
    if (!plan) return json({ code: "PLAN_UNAVAILABLE", error: "Choose a currently offered plan" }, 409);
    let created: Awaited<ReturnType<typeof provisionBusiness>>;
    try {
      created = await provisionBusiness(env, {
        email,
        displayName,
        businessName,
        businessSlug,
        passwordProof,
        plan,
        publicSignup: true,
      });
    } catch (error) {
      if (planChangedDuringSignup(error))
        return json({ code: "PLAN_UNAVAILABLE", error: "Choose a currently offered plan" }, 409);
      if (businessSlugConflict(error))
        return json({ code: "MENU_SLUG_IN_USE", error: "Menu link is already in use" }, 409);
      return json(
        {
          code: "REGISTRATION_CONFLICT",
          error: "Email or menu link is already in use",
        },
        409,
      );
    }
    const session = await createSession(created.user.id, env);
    return json(
      {
        user: created.user,
        business: created.business,
        token: session.token,
      },
      201,
      {
        "set-cookie": `mf_session=${session.token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
      },
    );
  }

  if (request.method === "POST" && path === "/api/auth/recovery-reset") {
    const resetKey = request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "");
    if (
      !env.PASSWORD_RESET_KEY ||
      !resetKey ||
      !safeEqual(resetKey, env.PASSWORD_RESET_KEY)
    )
      return json({ error: "Recovery is not available" }, 404);
    if (!authConfigured(env))
      return json({ error: "Authentication is not configured" }, 503);

    const body = await readJson(request);
    const email = String(body.email ?? "")
      .toLowerCase()
      .trim();
    const newEmail = String(body.newEmail ?? email)
      .toLowerCase()
      .trim();
    const passwordProof = String(body.passwordProof ?? "").toLowerCase();
    const authVersion = String(body.authVersion ?? "");
    if (
      !email.includes("@") ||
      !newEmail.includes("@") ||
      authVersion !== AUTH_SCHEME ||
      !PASSWORD_PROOF_PATTERN.test(passwordProof)
    )
      return json({ error: "Invalid recovery details" }, 400);

    const user = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first<{ id: string }>();
    if (!user) return json({ error: "Account not found" }, 404);

    if (newEmail !== email) {
      const duplicate = await env.DB.prepare(
        "SELECT id FROM users WHERE email=? AND id<>?",
      )
        .bind(newEmail, user.id)
        .first();
      if (duplicate) return json({ error: "New email is already in use" }, 409);
    }

    const passwordData = await credentialHash(passwordProof, env.AUTH_PEPPER);
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE users SET email=?, password_hash=?, password_salt=? WHERE id=?",
      ).bind(newEmail, passwordData.hash, passwordData.salt, user.id),
      env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id),
    ]);
    return json({ ok: true });
  }

  if (request.method === "POST" && path === "/api/auth/login") {
    const body = await readJson(request);
    const email = String(body.email ?? "")
      .toLowerCase()
      .trim();
    const passwordProof = String(body.passwordProof ?? "").toLowerCase();
    const authVersion = String(body.authVersion ?? "");
    if (
      authVersion !== AUTH_SCHEME ||
      !PASSWORD_PROOF_PATTERN.test(passwordProof)
    )
      return json({ error: "Invalid email or password" }, 401);
    if (!authConfigured(env))
      return json({ error: "Authentication is not configured" }, 503);
    const result = await verifyAccount(env, email, passwordProof);
    if (result.status === "reset_required")
      return json({ error: "This account requires a password reset" }, 409);
    if (result.status !== "verified")
      return json({ error: "Invalid email or password" }, 401);
    const user = result.account;
    const session = await createSession(user.id, env);
    return json(
      {
        user: { id: user.id, email: user.email, displayName: user.displayName },
        token: session.token,
      },
      200,
      {
        "set-cookie": `mf_session=${session.token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
      },
    );
  }

  const auth = await sessionFrom(request, env);
  if (!auth) return json(isPosAdminPath(path)
    ? { error: "Authentication required", code: "AUTHENTICATION_REQUIRED" }
    : { error: "Authentication required" }, 401);

  if (request.method === "POST" && path === "/api/auth/logout") {
    const token = sessionTokenFrom(request);
    if (token) {
      await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?")
        .bind(await hashToken(token))
        .run();
    }
    return json({ ok: true }, 200, {
      "set-cookie":
        "mf_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    });
  }

  if (request.method === "POST" && path === "/api/auth/change-password") {
    const body = await readJson(request);
    const authVersion = String(body.authVersion ?? "");
    const currentPasswordProof = String(
      body.currentPasswordProof ?? "",
    ).toLowerCase();
    const newPasswordProof = String(body.newPasswordProof ?? "").toLowerCase();
    if (
      authVersion !== AUTH_SCHEME ||
      !PASSWORD_PROOF_PATTERN.test(currentPasswordProof) ||
      !PASSWORD_PROOF_PATTERN.test(newPasswordProof) ||
      currentPasswordProof === newPasswordProof
    ) {
      return json({ error: "Please provide valid password details" }, 400);
    }
    if (!authConfigured(env))
      return json({ error: "Authentication is not configured" }, 503);

    const user = await env.DB.prepare(
      `SELECT id, password_hash AS passwordHash, password_salt AS passwordSalt
       FROM users WHERE id = ?`,
    )
      .bind(auth.userId)
      .first<Record<string, string>>();
    if (!user) return json({ error: "Account not found" }, 404);
    if (!user.passwordSalt.startsWith(`${AUTH_SCHEME}$`)) {
      return json({ error: "This account requires a password reset" }, 409);
    }
    const currentCredential = await credentialHash(
      currentPasswordProof,
      env.AUTH_PEPPER,
      user.passwordSalt,
    );
    if (!safeEqual(currentCredential.hash, user.passwordHash)) {
      return json({ error: "Current password is incorrect" }, 400);
    }

    const nextCredential = await credentialHash(
      newPasswordProof,
      env.AUTH_PEPPER,
    );
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?",
      ).bind(nextCredential.hash, nextCredential.salt, auth.userId),
      env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(
        auth.userId,
      ),
    ]);
    const session = await createSession(auth.userId, env);
    return json({ ok: true, token: session.token }, 200, {
      "set-cookie": `mf_session=${session.token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
    });
  }

  const disabledControlPages = new Set(
    jsonArray(auth.disabledControlPagesJson),
  );
  if (auth.subscriptionFeaturesJson !== null) {
    const included = new Set(planFeatures(auth.subscriptionFeaturesJson));
    for (const page of controlPageIds)
      if (!sellingControlPages.includes(page) && !included.has(page)) disabledControlPages.add(page);
  }
  const canViewBusinessActivity =
    auth.role === "owner" || auth.role === "manager";
  const canAccessSelling = canViewBusinessActivity && auth.sessionType === "customer" && Boolean(auth.posEnabled);
  const workspaceAccessPath = ["/api/admin/workspace", "/api/admin/workspace-access", "/api/admin/overview"].includes(path);
  const bookingPath = path === "/api/admin/bookings" || path.startsWith("/api/admin/bookings/");
  const bookingAccess = bookingPath || workspaceAccessPath
    ? await bookingWorkspaceAccess(env.DB, auth)
    : { visible: false, canManage: false };
  if (bookingPath) return adminBookings(request, url, env, path, auth.businessId, bookingAccess, execution);
  const telegramPath = path === "/api/admin/telegram-notifications" || path.startsWith("/api/admin/telegram-notifications/");
  const telegramAccess = (telegramPath || workspaceAccessPath) && await canManageTelegramNotifications(env.DB, auth);
  if (telegramPath) return telegramAccess
    ? adminTelegramNotifications(request, env, path, auth.businessId)
    : json({ error: "Telegram notifications are unavailable for this account or plan" }, 403);
  const accessibleControlPages = controlPageIds.filter(
    (page) =>
      page === "bookings" ? bookingAccess.visible :
        page === "telegramNotifications" ? telegramAccess :
        sellingControlPages.includes(page) ? canAccessSelling && !disabledControlPages.has(page) :
        !disabledControlPages.has(page) && ((page !== "orders" && page !== "reports") || canViewBusinessActivity),
  );
  if (request.method === "GET" && path === "/api/admin/workspace-access")
    return json({ accessibleControlPages });

  if (path.startsWith("/api/admin/")) {
    const requiredPages = controlPagesForResource(path, request.method);
    if (requiredPages?.every((page) => disabledControlPages.has(page)))
      return json(
        {
          code: "CONTROL_PAGE_DISABLED",
          error: "This page is disabled for your business",
        },
        403,
      );
  }

  const subscription = subscriptionSummary(auth, auth.timezone);
  if (
    path.startsWith("/api/admin/") &&
    !["GET", "HEAD"].includes(request.method) &&
    subscription.readOnly &&
    auth.sessionType !== "support"
  ) {
    return json(
      {
        code: "SUBSCRIPTION_EXPIRED",
        error:
          "Your subscription has expired. This workspace is available in read-only mode.",
        subscription,
      },
      402,
    );
  }

  if (path === "/api/admin/integrations/pos")
    return handlePosIntegration(request, env, auth);

  if (isPosAdminPath(path))
    return handlePosSetup(
      request, url, env.DB, auth, path.slice(posAdminPath.length),
      () => localDateKey(new Date(), auth.timezone || "UTC"),
    );

  if (request.method === "GET" && path === "/api/admin/branches") {
    const { results } = await listBranches(env.DB, auth.businessId);
    return json({ branches: results.map(({ id, slug, name, isDefault, isActive }) => ({ id, slug, name, isDefault, isActive })) });
  }

  if (request.method === "GET" && path === "/api/admin/menus") {
    const menus = env.DB.prepare(`SELECT m.id,m.slug,m.parent_id AS parentId,
      m.name_km AS nameKm,m.name_en AS nameEn,m.name_zh AS nameZh,m.source,m.is_active AS isActive,
      m.sort_order AS sortOrder,m.image_media_id AS imageMediaId,m.image_url AS imageUrl,photo.object_key AS objectKey
      FROM menus m LEFT JOIN media photo ON photo.id=m.image_media_id AND photo.business_id=m.business_id
      WHERE m.business_id=? AND m.deleted_in_admin=0
      ORDER BY m.sort_order,COALESCE(NULLIF(m.name_km,''),NULLIF(m.name_en,''),m.name_zh),m.id`)
      .bind(auth.businessId);
    const categories = url.searchParams.get("includeCategories") === "1" && !disabledControlPages.has("menus")
      ? env.DB.prepare(`SELECT id,parent_id AS parentId,name,name_km AS nameKm,
          name_en AS nameEn,name_zh AS nameZh
          FROM categories WHERE business_id=? ORDER BY sort_order,name,id`).bind(auth.businessId)
      : null;
    const [menuResult, categoryResult] = await env.DB.batch<Json>(categories ? [menus, categories] : [menus]);
    return json({
      menus: menuResult.results.map(({ objectKey, ...menu }) => ({ ...menu, imageUrl: mediaUrl(env,objectKey,
        String(menu.imageUrl ?? (menu.imageMediaId ? `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${menu.imageMediaId}` : ""))) })),
      ...(categoryResult ? { categories: categoryResult.results } : {}),
    });
  }

  const menuProductsMatch = path.match(/^\/api\/admin\/menus\/([a-zA-Z0-9_-]+)\/products(?:\/(order))?$/);
  if (menuProductsMatch)
    return adminMenuProducts(request, url, env, auth.businessId, menuProductsMatch[1], Boolean(menuProductsMatch[2]));

  if (request.method === "POST" && path === "/api/admin/menus/assign-product") {
    const body = await readJson(request).catch(() => null);
    const productId = body?.productId;
    const menuIds = body?.menuIds;
    if (
      typeof productId !== "string" || !RECORD_ID_PATTERN.test(productId) ||
      !Array.isArray(menuIds) || !menuIds.length || menuIds.length > 1000 ||
      menuIds.some((id) => typeof id !== "string" || !RECORD_ID_PATTERN.test(id))
    ) {
      return json({ error: "Choose a product and the menus to assign it to" }, 400);
    }
    const ids = [...new Set(menuIds as string[])];
    const businessId = auth.businessId;
    const encoded = JSON.stringify(ids);
    const [, , assigned] = await env.DB.batch<{ total: number }>([
      env.DB.prepare(`WITH targets AS (
        SELECT id FROM menus
        WHERE business_id=?1 AND source='local' AND parent_id IS NOT NULL
          AND id IN (SELECT value FROM json_each(?2))
      )
      INSERT INTO menu_products (business_id, menu_id, product_id)
      SELECT ?1, id, ?3 FROM targets
      WHERE (SELECT COUNT(*) FROM targets)=?4
        AND EXISTS (SELECT 1 FROM products WHERE business_id=?1 AND id=?3)
      ON CONFLICT (business_id,menu_id,product_id) DO NOTHING`)
        .bind(businessId, encoded, productId, ids.length),
      publicMenuVersionStatement(env.DB, businessId, true),
      env.DB.prepare(`SELECT COUNT(*) AS total FROM menu_products placement
        JOIN menus menu ON menu.business_id=placement.business_id AND menu.id=placement.menu_id
        WHERE placement.business_id=? AND placement.product_id=?
          AND menu.source='local' AND menu.parent_id IS NOT NULL
          AND menu.id IN (SELECT value FROM json_each(?))`)
        .bind(businessId, productId, encoded),
    ]);
    if (assigned.results[0]?.total !== ids.length)
      return json({ error: "Choose an existing product and local submenus from this business" }, 400);
    return json({ ok: true });
  }

  if (request.method === "PUT" && path === "/api/admin/menus/tree-order") {
    const body = await readJson(request).catch(() => null);
    const before = menuPlacements(body?.before);
    const updates = menuPlacements(body?.updates);
    if (!before || !updates) return json({ error: "Choose valid menus to reorder" }, 400);

    const parents = new Map(before.map(({ id, parentId }) => [id, parentId]));
    for (const { id, parentId } of updates) {
      const previousParentId = parents.get(id);
      if (previousParentId === undefined || (previousParentId === null) !== (parentId === null) ||
          (parentId !== null && !parents.has(parentId)))
        return json({ error: "Choose a valid parent menu. Top-level menus must stay at the top level." }, 400);
      parents.set(id, parentId);
    }
    for (const id of parents.keys()) {
      const ancestors = new Set<string>();
      let current: string | null = id;
      while (current !== null && parents.has(current)) {
        if (ancestors.has(current)) return json({ error: "A menu cannot be moved under itself or its submenus" }, 400);
        if (ancestors.size === 32) return json({ error: "Menus can be nested up to 32 levels" }, 400);
        ancestors.add(current);
        current = parents.get(current) ?? null;
      }
    }

    const businessId = auth.businessId;
    const db = env.DB;
    const [saved] = await db.batch([
      db.prepare(`WITH expected AS (
          SELECT json_extract(value,'$.id') AS id, json_extract(value,'$.parentId') AS parent_id,
            json_extract(value,'$.sortOrder') AS sort_order FROM json_each(?1)
        ), requested AS (
          SELECT json_extract(value,'$.id') AS id, json_extract(value,'$.parentId') AS parent_id,
            json_extract(value,'$.sortOrder') AS sort_order FROM json_each(?2)
        ), unchanged AS MATERIALIZED (
          SELECT 1
          WHERE (SELECT COUNT(*) FROM menus WHERE business_id=?3 AND deleted_in_admin=0)=json_array_length(?1)
            AND NOT EXISTS (
              SELECT 1 FROM expected LEFT JOIN menus current
                ON current.id=expected.id AND current.business_id=?3 AND current.deleted_in_admin=0
              WHERE current.id IS NULL OR current.parent_id IS NOT expected.parent_id
                OR current.sort_order IS NOT expected.sort_order
            )
        )
        UPDATE menus SET
          pos_parent_id=CASE WHEN menus.source='pos' AND menus.admin_reparented=0
            AND menus.parent_id IS NOT requested.parent_id THEN menus.parent_id ELSE menus.pos_parent_id END,
          admin_reparented=CASE WHEN menus.source='pos' AND menus.parent_id IS NOT requested.parent_id
            THEN 1 ELSE menus.admin_reparented END,
          admin_sorted=CASE WHEN menus.source='pos' THEN 1 ELSE menus.admin_sorted END,
          parent_id=requested.parent_id, sort_order=requested.sort_order
        FROM requested
        WHERE menus.id=requested.id AND menus.business_id=?3 AND menus.deleted_in_admin=0
          AND EXISTS (SELECT 1 FROM unchanged)`)
        .bind(JSON.stringify(before), JSON.stringify(updates), businessId),
      publicMenuVersionStatement(db, businessId, true),
      db.prepare("UPDATE pos_integrations SET catalog_version=catalog_version+1 WHERE business_id=? AND changes()>0")
        .bind(businessId),
    ]);
    if (saved.meta.changes !== updates.length)
      return json({ error: "The menu tree changed. Close and reopen Sort Order to try again." }, 409);
    return json({ ok: true });
  }

  if (request.method === "PUT" && path === "/api/admin/menus/reorder") {
    const body = await readJson(request).catch(() => null);
    const parentId = body?.parentId;
    const menuIds = body?.menuIds;
    const includePos = body?.includePos === true;
    const move = body?.move as Json | undefined;
    const movedMenuId = move?.id ?? null;
    const fromParentId = move?.fromParentId ?? null;
    if (
      (parentId !== null && (typeof parentId !== "string" || !RECORD_ID_PATTERN.test(parentId))) ||
      !Array.isArray(menuIds) || menuIds.length < (move === undefined ? 2 : 1) || menuIds.length > 10_000 ||
      menuIds.some((id) => typeof id !== "string" || !RECORD_ID_PATTERN.test(id)) ||
      new Set(menuIds).size !== menuIds.length
    ) {
      return json({ error: "Choose sibling menus to reorder" }, 400);
    }
    if (move !== undefined && (
      includePos || !parentId || typeof movedMenuId !== "string" || !menuIds.includes(movedMenuId) ||
      typeof fromParentId !== "string" || !RECORD_ID_PATTERN.test(fromParentId) ||
      fromParentId === parentId
    )) {
      return json({ error: "Choose a submenu and a different parent menu" }, 400);
    }

    const businessId = auth.businessId;
    const [saved] = await env.DB.batch([
      env.DB.prepare(`WITH RECURSIVE requested(id, position) AS (
          SELECT value, key FROM json_each(?1)
        ), moving AS (
          SELECT id FROM menus
          WHERE business_id=?2 AND id=?5 AND parent_id=?6 AND source='local'
        ), ancestors(id, parent_id) AS (
          SELECT id, parent_id FROM menus
          WHERE business_id=?2 AND id=?3 AND source='local' AND ?5 IS NOT NULL
          UNION
          SELECT menu.id, menu.parent_id FROM menus menu
          JOIN ancestors ON menu.id=ancestors.parent_id
          WHERE menu.business_id=?2
        ), siblings AS (
          SELECT id FROM menus
          WHERE business_id=?2 AND deleted_in_admin=0 AND (?7=1 OR source='local')
            AND (parent_id IS ?3 OR id IN (SELECT id FROM moving))
        ), matched AS (
          SELECT requested.id, requested.position
          FROM requested JOIN siblings USING (id)
        )
        UPDATE menus SET parent_id=?3, sort_order=matched.position,
          admin_sorted=CASE WHEN ?7=1 AND menus.source='pos' THEN 1 ELSE menus.admin_sorted END
        FROM matched
        WHERE menus.id=matched.id AND menus.business_id=?2
          AND (SELECT COUNT(*) FROM matched)=?4
          AND (SELECT COUNT(*) FROM siblings)=?4
          AND (?3 IS NULL OR EXISTS (SELECT 1 FROM menus parent
            WHERE parent.id=?3 AND parent.business_id=?2 AND parent.deleted_in_admin=0))
          AND (?5 IS NULL OR (
            EXISTS (SELECT 1 FROM moving)
            AND EXISTS (SELECT 1 FROM ancestors WHERE id=?3)
            AND NOT EXISTS (SELECT 1 FROM ancestors WHERE id=?5)
          ))`)
        .bind(JSON.stringify(menuIds), businessId, parentId, menuIds.length, movedMenuId, fromParentId, Number(includePos)),
      publicMenuVersionStatement(env.DB, businessId, true),
      // Reject any in-flight POS snapshot that read the previous order.
      ...(includePos || move ? [env.DB.prepare(
        "UPDATE pos_integrations SET catalog_version=catalog_version+1 WHERE business_id=? AND changes()>0",
      ).bind(businessId)] : []),
    ]);
    if (saved.meta.changes !== menuIds.length)
      return json({
        error: move
          ? "The submenu could not be moved. Choose a local parent outside its branch and try again."
          : "The editable menus at this level changed. Refresh and try again.",
      }, 409);
    return json({ ok: true });
  }

  const menuEditMatch = path.match(/^\/api\/admin\/menus(?:\/([a-zA-Z0-9_-]+))?$/);
  if (request.method === "DELETE" && menuEditMatch?.[1]) {
    const businessId = auth.businessId;
    const menuId = menuEditMatch[1];
    const includeSubmenus = url.searchParams.get("includeSubmenus") === "1";
    const db = env.DB;
    const menu = await db.prepare("SELECT id FROM menus WHERE business_id=? AND id=? AND deleted_in_admin=0")
      .bind(businessId, menuId).first();
    if (!menu) return json({ error: "Menu not found" }, 404);
    const eligible = `WITH RECURSIVE subtree(id, source, deleted_in_admin) AS (
      SELECT id, source, deleted_in_admin FROM menus
      WHERE business_id=?1 AND id=?2 AND deleted_in_admin=0
      UNION
      SELECT child.id, child.source, child.deleted_in_admin FROM menus child
      JOIN subtree ON child.parent_id=subtree.id
      WHERE child.business_id=?1
    ), eligible AS (
      SELECT id, source FROM subtree
      WHERE ?3=1 OR NOT EXISTS (SELECT 1 FROM subtree WHERE id<>?2 AND deleted_in_admin=0)
    )`;
    const scope = [businessId, menuId, Number(includeSubmenus)];
    const [, , , removed] = await db.batch<{ id: string }>([
      db.prepare(`${eligible}
        UPDATE businesses SET menu_cache_version=menu_cache_version+1, updated_at=CURRENT_TIMESTAMP
        WHERE id=?1 AND EXISTS (SELECT 1 FROM eligible)`).bind(...scope),
      db.prepare(`${eligible}
        UPDATE pos_integrations SET catalog_version=catalog_version+1
        WHERE business_id=?1 AND EXISTS (SELECT 1 FROM eligible WHERE source='pos')`).bind(...scope),
      db.prepare(`${eligible}
        UPDATE orders SET menu_id=NULL
        WHERE business_id=?1 AND menu_id IN (SELECT id FROM eligible)`).bind(...scope),
      db.prepare(`${eligible}
        DELETE FROM menus
        WHERE business_id=?1 AND id IN (SELECT id FROM eligible) RETURNING id`).bind(...scope),
    ]);
    const deleted = removed.results;
    if (!deleted.length)
      return json({ error: "The menu or its submenus changed. Reopen the delete confirmation and try again." }, 409);
    return json({ deletedIds: deleted.map(({ id }) => id) });
  }

  if (menuEditMatch && (request.method === "POST" && !menuEditMatch[1] || request.method === "PUT" && menuEditMatch[1])) {
    const businessId = auth.businessId;
    const db = env.DB;
    const body = await readJson(request);
    const existingId = menuEditMatch[1];
    const existing = existingId ? await db.prepare(`SELECT parent_id AS parentId, source FROM menus
      WHERE id=? AND business_id=? AND deleted_in_admin=0`)
      .bind(existingId,businessId).first<{ parentId: string | null; source: "local" | "pos" }>() : null;
    if (existingId && !existing) return json({ error: "Editable menu not found" },404);
    const menuId = existingId || id("mnu");
    const parentId = String(body.parentId || "") || null;
    const nameKm = String(body.nameKm ?? "").trim().slice(0,160);
    const nameEn = String(body.nameEn ?? "").trim().slice(0,160);
    const nameZh = String(body.nameZh ?? "").trim().slice(0,160);
    const slug = String(body.slug || recordSlug((nameEn || nameKm || nameZh).slice(0,65),"menu",menuId)).trim();
    const sortOrder = parseSortOrder(body.sortOrder);
    const imageMediaId = String(body.imageMediaId || "") || null;
    const isActive = body.isActive === false || body.isActive === 0 ? 0 : 1;
    if (!(nameKm || nameEn || nameZh) || sortOrder === null || (!existingId && (slug.length > 80 || !BUSINESS_SLUG_PATTERN.test(slug))))
      return json({ error: "Enter a menu name, a valid slug and a whole sort order" },400);
    if (existing && Boolean(existing.parentId) !== Boolean(parentId))
      return json({ error: "A menu must remain a root or a submenu" },400);
    if (parentId && !await db.prepare("SELECT id FROM menus WHERE business_id=? AND id=? AND deleted_in_admin=0")
      .bind(businessId,parentId).first()) return json({ error: "Choose an available parent menu" },400);
    if (imageMediaId && !await db.prepare("SELECT id FROM media WHERE business_id=? AND id=?")
      .bind(businessId,imageMediaId).first()) return json({ error: "Menu photo not found" },400);
    if (existing?.source === "pos") {
      if (parentId !== existing.parentId)
        return json({ error: "POS controls this menu's parent" }, 409);
      const [saved] = await db.batch([
        db.prepare(`UPDATE menus SET name_km=?,name_en=?,name_zh=?,sort_order=?,image_media_id=?,
          image_url=CASE WHEN ? THEN image_url ELSE NULL END,is_active=?,admin_active=?
          WHERE business_id=? AND id=? AND parent_id IS ? AND source='pos' AND deleted_in_admin=0`)
          .bind(nameKm, nameEn, nameZh, sortOrder, imageMediaId, Number(body.imageMediaId === ""),
            isActive, isActive, businessId, menuId, parentId),
        db.prepare("UPDATE pos_integrations SET catalog_version=catalog_version+1 WHERE business_id=? AND changes()>0")
          .bind(businessId),
        publicMenuVersionStatement(db, businessId),
      ]);
      if (!saved.meta.changes) return json({ error: "The menu changed. Reopen it and try again." }, 409);
      return json({ id: menuId });
    }
    const fields = [parentId,nameKm,nameEn,nameZh,sortOrder,imageMediaId,isActive];
    const write = existingId
      ? db.prepare(`WITH RECURSIVE ancestors(id,parent_id) AS (
          SELECT id,parent_id FROM menus WHERE business_id=? AND id=?
          UNION SELECT m.id,m.parent_id FROM menus m JOIN ancestors a ON a.parent_id=m.id WHERE m.business_id=?
        ) UPDATE menus SET parent_id=?,name_km=?,name_en=?,name_zh=?,sort_order=?,image_media_id=?,is_active=?
        WHERE id=? AND business_id=? AND source='local' AND NOT EXISTS (SELECT 1 FROM ancestors WHERE id=?)
          AND (? IS NULL OR EXISTS (SELECT 1 FROM ancestors JOIN menus parent USING (id)
            WHERE parent.id=? AND parent.deleted_in_admin=0))`)
          .bind(businessId,parentId,businessId,...fields,menuId,businessId,menuId,parentId,parentId)
      : db.prepare(`INSERT INTO menus (id,business_id,slug,parent_id,name_km,name_en,name_zh,sort_order,image_media_id,is_active)
        SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10
        WHERE ?4 IS NULL OR EXISTS (SELECT 1 FROM menus WHERE business_id=?2 AND id=?4 AND deleted_in_admin=0)
        ON CONFLICT (business_id,slug) DO NOTHING`).bind(menuId,businessId,slug,...fields);
    const [saved] = await db.batch([
      write,
      publicMenuVersionStatement(db, businessId, true),
      ...(existing && existing.parentId !== parentId ? [db.prepare(
        "UPDATE pos_integrations SET catalog_version=catalog_version+1 WHERE business_id=? AND changes()>0",
      ).bind(businessId)] : []),
    ]);
    if (!saved.meta.changes) return json({ error: existingId ? "Choose a parent outside this submenu" : "This menu slug is already in use" },409);
    return json({ id: menuId },existingId ? 200 : 201);
  }

  const adminOrderMatch = path.match(
    /^\/api\/admin\/orders(?:\/([a-zA-Z0-9_-]+))?$/,
  );
  if (
    adminOrderMatch &&
    (request.method === "GET" ||
      (request.method === "PATCH" && adminOrderMatch[1]))
  ) {
    if (!canViewBusinessActivity)
      return json({ error: "Owner or manager access is required" }, 403);
    const orderId = adminOrderMatch[1];
    if (request.method === "PATCH") {
      const { status } = (await readJson(request).catch(() => null)) ?? {};
      if (!isOrderStatusUpdate(status))
        return json({ error: "Invalid order status" }, 400);
      const order = await updateOrderStatus(
        env.DB,
        auth.businessId,
        orderId,
        status,
      );
      if (!order) return json({ error: "Order not found" }, 404);
      if (order.changed) scheduleBranchWebhooks(env, execution, auth.businessId);
      if (order.status !== status)
        return json(
          {
            code: "order_status_conflict",
            error: "This order can no longer be changed to that status",
          },
          409,
        );
      return json({ status: order.status });
    }

    const summarySql = (details = false) => `SELECT o.id, o.order_number AS orderNumber, o.status, o.posting_date AS postingDate,
        o.total_quantity AS totalQuantity, o.total_amount AS totalAmount, o.currency,
        t.code AS tableCode, t.label AS tableLabel, g.name AS groupName,
        o.branch_id AS branchId, branch.name AS branchName, o.menu_id AS menuId${details ? ", o.note" : ""}
      FROM orders o
      JOIN restaurant_tables t ON t.id=o.table_id AND t.business_id=o.business_id
      JOIN table_groups g ON g.id=t.group_id AND g.business_id=o.business_id
      JOIN branches branch ON branch.id=o.branch_id AND branch.business_id=o.business_id
      WHERE o.business_id=?`;
    if (orderId) {
      const [headers, lines] = await env.DB.batch<Json>([
        env.DB.prepare(`${summarySql(true)} AND o.id=?`).bind(
          auth.businessId,
          orderId,
        ),
        env.DB.prepare(
          `SELECT line.line_number AS lineNumber, line.product_id AS productId,
            COALESCE(NULLIF(product.name_km,''),product.name) AS name,
            product.name_en AS nameEn, line.quantity, line.price, line.status,
            line.portion_name AS portionName, line.price_list AS priceList,
            price_list.name AS priceListName, line.modifiers,
            line.total_amount AS totalAmount, line.note
          FROM order_products line
          JOIN orders o ON o.id=line.order_id
          LEFT JOIN products product ON product.id=line.product_id AND product.business_id=o.business_id
          LEFT JOIN price_lists price_list ON price_list.id=line.price_list AND price_list.business_id=o.business_id
          WHERE o.business_id=? AND o.id=?
          ORDER BY line.line_number`,
        ).bind(auth.businessId, orderId),
      ]);
      const order = headers.results[0];
      if (!order) return json({ error: "Order not found" }, 404);
      return json({
        order,
        products: lines.results.map((line) => ({
          ...line,
          modifiers: jsonArray(line.modifiers),
        })),
      });
    }

    const page = Number(url.searchParams.get("page") ?? 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000)
      return json({ error: "Invalid page number" }, 400);
    const pageSize = 25;
    const branchId = url.searchParams.get("branchId") || "";
    const { results } = await env.DB.prepare(
      `${summarySql()} AND (?='' OR o.branch_id=?) ORDER BY o.posting_date DESC, o.rowid DESC LIMIT ? OFFSET ?`,
    )
      .bind(auth.businessId, branchId, branchId, pageSize + 1, (page - 1) * pageSize)
      .all();
    return json({
      orders: results.slice(0, pageSize),
      hasMore: results.length > pageSize,
    });
  }

  if (
    request.method === "GET" &&
    (path === "/api/admin/reports/menu-analytics" ||
      path === "/api/admin/reports/menu-analytics.csv")
  ) {
    if (!new Set(["owner", "manager"]).has(auth.role))
      return json({ error: "Owner or manager access is required" }, 403);
    const today = localDateKey(new Date(), auth.timezone || "UTC");
    const from = url.searchParams.get("from") || shiftDate(today, -29);
    const to = url.searchParams.get("to") || today;
    const fromDate = reportDate(from);
    const toDate = reportDate(to);
    if (!fromDate || !toDate || fromDate > toDate)
      return json({ error: "Invalid report date range" }, 400);
    const duration =
      Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
    if (duration > 397)
      return json({ error: "Reports are limited to 13 months" }, 400);
    const language = String(url.searchParams.get("language") || "");
    const tableId = String(url.searchParams.get("tableId") || "");
    const groupId = String(url.searchParams.get("groupId") || "");
    const branchId = String(url.searchParams.get("branchId") || "");
    if (language && !ANALYTICS_LANGUAGES.has(language))
      return json({ error: "Invalid report language" }, 400);
    if (
      (tableId && !RECORD_ID_PATTERN.test(tableId)) ||
      (groupId && !RECORD_ID_PATTERN.test(groupId)) ||
      (branchId && !RECORD_ID_PATTERN.test(branchId))
    )
      return json({ error: "Invalid report filter" }, 400);
    const report = await analyticsReport(env, auth.businessId, {
      from,
      to,
      previousFrom: shiftDate(from, -duration),
      previousTo: shiftDate(from, -1),
      language,
      tableId,
      groupId,
      branchId,
    });
    if (path.endsWith(".csv")) {
      const dataset = String(url.searchParams.get("dataset") || "daily");
      const datasets: Record<string, unknown[]> = {
        daily: report.daily,
        hourly: report.hourly,
        products: report.products,
        categories: report.categories,
        tables: report.tables,
        searches: report.searches,
        promotions: report.promotions,
        actions: report.actions,
        languages: report.languages,
        sources: report.sources,
      };
      if (!Object.hasOwn(datasets, dataset))
        return json({ error: "Unknown export dataset" }, 400);
      return csvResponse(
        datasets[dataset] as Array<Record<string, unknown>>,
        `menu-analytics-${dataset}-${from}-to-${to}.csv`,
      );
    }
    return json(report);
  }

  if (
    request.method === "GET" &&
    (path === "/api/admin/workspace" || path === "/api/admin/overview")
  ) {
    const business = await env.DB.prepare(
      `SELECT id, name, slug, tagline, description, logo_url AS logoUrl,
        logo_media_id AS logoMediaId, phone, address, currency,
        secondary_currency AS secondaryCurrency,
        secondary_exchange_rate AS secondaryExchangeRate,
        show_secondary_currency AS showSecondaryCurrency,
        enable_add_to_order AS enableAddToOrder, locale,
        business_hours_json AS businessHoursJson,
        contact_numbers_json AS contactNumbersJson, email,
        website_url AS websiteUrl, custom_menu_url AS customMenuUrl,
        social_links_json AS socialLinksJson,
        locations_json AS locationsJson,
        map_url AS mapUrl, map_label AS mapLabel,
        wifi_ssid AS wifiSsid, wifi_password AS wifiPassword,
        wifi_security AS wifiSecurity,
        show_header_location AS showHeaderLocation,
        show_header_phones AS showHeaderPhones,
        show_header_wifi AS showHeaderWifi,
        show_header_socials AS showHeaderSocials,
        show_header_tagline AS showHeaderTagline,
        show_business_hours AS showBusinessHours,
        theme_color AS themeColor, menu_theme_json AS menuThemeJson,
        enable_en AS enableEn, enable_zh AS enableZh,
        timezone, pricing_mode AS pricingMode, is_active AS isActive,
        default_price_list_id AS defaultPriceListId,
        first_qr_downloaded_at AS firstQrDownloadedAt
       FROM businesses WHERE id = ?`,
    )
      .bind(auth.businessId)
      .first<Record<string, unknown>>();
    let firstQrDownloadedAt: string | null = null;
    if (business) {
      firstQrDownloadedAt = business.firstQrDownloadedAt
        ? String(business.firstQrDownloadedAt)
        : null;
      delete business.firstQrDownloadedAt;
      business.businessHours = jsonArray(business.businessHoursJson);
      business.contactNumbers = jsonArray(business.contactNumbersJson);
      business.socialLinks = jsonArray(business.socialLinksJson);
      business.locations = jsonArray(business.locationsJson);
      business.enableAddToOrder = Boolean(business.enableAddToOrder);
      business.showHeaderLocation = Boolean(business.showHeaderLocation);
      business.showHeaderPhones = Boolean(business.showHeaderPhones);
      business.showHeaderWifi = Boolean(business.showHeaderWifi);
      business.showHeaderSocials = Boolean(business.showHeaderSocials);
      business.showHeaderTagline = Boolean(business.showHeaderTagline);
      business.showBusinessHours = Boolean(business.showBusinessHours);
      business.menuTheme = parseMenuTheme(
        business.menuThemeJson,
        business.themeColor,
        env,
      );
      delete business.businessHoursJson;
      delete business.contactNumbersJson;
      delete business.socialLinksJson;
      delete business.locationsJson;
      delete business.menuThemeJson;
      const pricing = await resolvePriceList(
        env,
        auth.businessId,
        business.pricingMode,
        business.defaultPriceListId,
        business.timezone,
      );
      business.activePriceListId = pricing.activeId;
    }
    const user = await env.DB.prepare(
      `SELECT id, email, display_name AS displayName
       FROM users WHERE id = ?`,
    )
      .bind(auth.userId)
      .first();
    const [counts, catalogReadiness] = disabledControlPages.has("overview")
      ? [null, null]
      : await Promise.all([
          env.DB.prepare(
            `SELECT (SELECT COUNT(*) FROM products WHERE business_id = ?) AS products,
          (SELECT COUNT(*) FROM categories WHERE business_id = ?) AS categories,
          (SELECT COUNT(*) FROM banners WHERE business_id = ?) AS banners`,
          )
            .bind(auth.businessId, auth.businessId, auth.businessId)
            .first(),
          env.DB.prepare(
            `WITH RECURSIVE visible_category_ids(id) AS (
          SELECT id FROM categories
          WHERE business_id = ? AND is_active = 1 AND parent_id IS NULL
          UNION ALL
          SELECT child.id FROM categories child
          JOIN visible_category_ids parent ON child.parent_id = parent.id
          WHERE child.business_id = ? AND child.is_active = 1
        )
        SELECT COUNT(*) AS publishedProducts,
          SUM(CASE WHEN COALESCE(TRIM(product.image_url), '') = ''
            AND NOT EXISTS (
              SELECT 1 FROM product_images image
              WHERE image.business_id = product.business_id
                AND image.product_id = product.id
            ) THEN 1 ELSE 0 END) AS missingPhotoProducts
        FROM products product
        JOIN visible_category_ids visible ON visible.id = product.category_id
        WHERE product.business_id = ? AND product.is_available = 1`,
          )
            .bind(auth.businessId, auth.businessId, auth.businessId)
            .first<{
              publishedProducts: number;
              missingPhotoProducts: number;
            }>(),
        ]);
    return json({
      business,
      accessibleControlPages,
      counts,
      readiness: {
        firstQrDownloadedAt,
        publishedProducts: Number(catalogReadiness?.publishedProducts || 0),
        missingPhotoProducts: Number(
          catalogReadiness?.missingPhotoProducts || 0,
        ),
      },
      subscription,
      role: auth.role,
      user,
      supportSession:
        auth.sessionType === "support"
          ? {
              active: true,
              actorEmail: auth.actorEmail,
              expiresAt: auth.expiresAt,
            }
          : null,
    });
  }

  if (
    request.method === "POST" &&
    path === "/api/admin/readiness/qr-download"
  ) {
    await env.DB.prepare(
      `UPDATE businesses
       SET first_qr_downloaded_at=COALESCE(first_qr_downloaded_at,CURRENT_TIMESTAMP)
       WHERE id=?`,
    )
      .bind(auth.businessId)
      .run();
    const readiness = await env.DB.prepare(
      `SELECT first_qr_downloaded_at AS firstQrDownloadedAt
       FROM businesses WHERE id=?`,
    )
      .bind(auth.businessId)
      .first<{ firstQrDownloadedAt: string | null }>();
    return json({
      firstQrDownloadedAt: readiness?.firstQrDownloadedAt ?? null,
    });
  }

  if (request.method === "PUT" && path === "/api/admin/business") {
    const body = await readJson(request);
    const currency = String(body.currency ?? "KHR").toUpperCase();
    if (currency !== "USD" && currency !== "KHR") {
      return json({ error: "Currency must be USD or KHR" }, 400);
    }
    const currentPricing = await env.DB.prepare(
      `SELECT currency, timezone, pricing_mode AS pricingMode,
        default_price_list_id AS defaultPriceListId,
        secondary_currency AS secondaryCurrency,
        secondary_exchange_rate AS secondaryExchangeRate,
        show_secondary_currency AS showSecondaryCurrency,
        enable_add_to_order AS enableAddToOrder,
        locations_json AS locationsJson, map_url AS mapUrl,
        map_label AS mapLabel, address, wifi_ssid AS wifiSsid,
        wifi_password AS wifiPassword, wifi_security AS wifiSecurity,
        show_header_location AS showHeaderLocation,
        show_header_phones AS showHeaderPhones,
        show_header_wifi AS showHeaderWifi,
        show_header_socials AS showHeaderSocials,
        show_header_tagline AS showHeaderTagline,
        show_business_hours AS showBusinessHours
       FROM businesses WHERE id=?`,
    )
      .bind(auth.businessId)
      .first<Record<string, unknown>>();
    const secondaryCurrencyWasSubmitted = body.secondaryCurrency != null;
    let secondaryCurrency = String(
      body.secondaryCurrency ??
        currentPricing?.secondaryCurrency ??
        (currency === "USD" ? "KHR" : "USD"),
    ).toUpperCase();
    if (!secondaryCurrencyWasSubmitted && secondaryCurrency === currency) {
      secondaryCurrency = currency === "USD" ? "KHR" : "USD";
    }
    if (secondaryCurrency !== "USD" && secondaryCurrency !== "KHR") {
      return json({ error: "Secondary currency must be USD or KHR" }, 400);
    }
    if (secondaryCurrency === currency) {
      return json(
        { error: "Primary and secondary currencies must be different" },
        400,
      );
    }
    let secondaryExchangeRate = Number(
      body.secondaryExchangeRate ??
        currentPricing?.secondaryExchangeRate ??
        (currency === "USD" ? 4000 : 0.00025),
    );
    if (
      body.secondaryExchangeRate == null &&
      currentPricing?.currency &&
      currentPricing.currency !== currency &&
      secondaryExchangeRate > 0
    ) {
      secondaryExchangeRate = 1 / secondaryExchangeRate;
    }
    if (
      !Number.isFinite(secondaryExchangeRate) ||
      secondaryExchangeRate <= 0 ||
      secondaryExchangeRate > 1_000_000_000
    ) {
      return json({ error: "Enter a valid positive exchange rate" }, 400);
    }
    const showSecondaryCurrency =
      body.showSecondaryCurrency == null
        ? currentPricing?.showSecondaryCurrency
          ? 1
          : 0
        : body.showSecondaryCurrency
          ? 1
          : 0;
    const enableAddToOrder =
      body.enableAddToOrder == null
        ? currentPricing?.enableAddToOrder
          ? 1
          : 0
        : body.enableAddToOrder
          ? 1
          : 0;
    const shopInformation = businessShopInformation(body, currentPricing || {});
    if ("error" in shopInformation)
      return json({ error: shopInformation.error }, 400);
    const timezone = String(
      body.timezone ?? currentPricing?.timezone ?? "Asia/Phnom_Penh",
    ).trim();
    const pricingMode = body.pricingMode === "manual" ? "manual" : "automatic";
    const defaultPriceListId = String(
      body.defaultPriceListId ?? currentPricing?.defaultPriceListId ?? "",
    );
    if (!validTimezone(timezone))
      return json({ error: "Choose a valid IANA business timezone" }, 400);
    const defaultPriceList = await env.DB.prepare(
      `SELECT id FROM price_lists
       WHERE id=? AND business_id=? AND is_archived=0`,
    )
      .bind(defaultPriceListId, auth.businessId)
      .first();
    if (!defaultPriceList)
      return json({ error: "Choose an active default price list" }, 400);
    const logoMediaId = String(body.logoMediaId ?? "");
    let logoObjectKey = "";
    if (logoMediaId) {
      const logo = await env.DB.prepare(
        "SELECT id, object_key AS objectKey FROM media WHERE id=? AND business_id=?",
      )
        .bind(logoMediaId, auth.businessId)
        .first<{ id: string; objectKey: string }>();
      if (!logo) return json({ error: "Business logo was not found" }, 404);
      logoObjectKey = logo.objectKey;
    }
    const logoUrl = logoMediaId
      ? mediaUrl(
          env,
          logoObjectKey,
          `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${logoMediaId}`,
        )
      : null;
    await env.DB.prepare(
      `UPDATE businesses SET name=?, tagline=?, description=?, phone=?, address=?, currency=?,
       secondary_currency=?,secondary_exchange_rate=?,show_secondary_currency=?,
       enable_add_to_order=?,
       business_hours_json=?,contact_numbers_json=?,email=?,website_url=?,
       social_links_json=?,locations_json=?,map_url=?,map_label=?,wifi_ssid=?,wifi_password=?,
       wifi_security=?,show_header_location=?,show_header_phones=?,
       show_header_wifi=?,show_header_socials=?,show_header_tagline=?,show_business_hours=?,
       locale='km', enable_en=?, enable_zh=?, theme_color=?, logo_url=?, logo_media_id=?,
       timezone=?,pricing_mode=?,default_price_list_id=?,
       updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    )
      .bind(
        String(body.name ?? ""),
        String(body.tagline ?? ""),
        String(body.description ?? ""),
        shopInformation.contactNumbers[0]?.number || String(body.phone ?? ""),
        shopInformation.locations[0]?.address || String(body.address ?? ""),
        currency,
        secondaryCurrency,
        secondaryExchangeRate,
        showSecondaryCurrency,
        enableAddToOrder,
        JSON.stringify(shopInformation.businessHours),
        JSON.stringify(shopInformation.contactNumbers),
        shopInformation.email,
        shopInformation.websiteUrl,
        JSON.stringify(shopInformation.socialLinks),
        JSON.stringify(shopInformation.locations),
        shopInformation.mapUrl,
        shopInformation.mapLabel,
        shopInformation.wifiSsid,
        shopInformation.wifiPassword,
        shopInformation.wifiSecurity,
        shopInformation.showHeaderLocation ? 1 : 0,
        shopInformation.showHeaderPhones ? 1 : 0,
        shopInformation.showHeaderWifi ? 1 : 0,
        shopInformation.showHeaderSocials ? 1 : 0,
        shopInformation.showHeaderTagline ? 1 : 0,
        shopInformation.showBusinessHours ? 1 : 0,
        body.enableEn ? 1 : 0,
        body.enableZh ? 1 : 0,
        String(body.themeColor ?? "#de3c2f"),
        logoUrl,
        logoMediaId || null,
        timezone,
        pricingMode,
        defaultPriceListId,
        auth.businessId,
      )
      .run();
    await invalidatePublicMenu(env, auth.businessId);
    return json({ ok: true });
  }

  if (request.method === "PUT" && path === "/api/admin/menu-theme") {
    const body = await readJson(request);
    const current = await env.DB.prepare(
      "SELECT theme_color AS themeColor FROM businesses WHERE id=?",
    )
      .bind(auth.businessId)
      .first<{ themeColor: string }>();
    const nextTheme = menuTheme(
      body.menuTheme,
      current?.themeColor || "#e84231",
    );
    const imageIds = menuThemeImageFields.map(
      ({ mediaId }) => nextTheme[mediaId],
    );
    const images = imageIds.some(Boolean)
      ? (await env.DB
          .prepare("SELECT id, object_key AS objectKey FROM media WHERE business_id=? AND id IN (?,?)")
          .bind(auth.businessId, ...imageIds)
          .all<{ id: string; objectKey: string }>()).results
      : [];
    for (const { mediaId, url, missingMessage } of menuThemeImageFields) {
      nextTheme[url] = "";
      const imageId = nextTheme[mediaId];
      if (!imageId) continue;
      const image = images.find(({ id }) => id === imageId);
      if (!image) return json({ error: missingMessage }, 404);
      const assetUrl = workerMediaUrl(env, imageId);
      nextTheme[url] = url === "productPlaceholderUrl"
        ? assetUrl
        : mediaUrl(env, image.objectKey, assetUrl);
    }
    if (
      nextTheme.backgroundType === "image" &&
      !nextTheme.backgroundImageMediaId
    ) {
      return json(
        { error: "Upload a background image before publishing" },
        400,
      );
    }
    await env.DB.prepare(
      `UPDATE businesses
       SET menu_theme_json=?, theme_color=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
    )
      .bind(JSON.stringify(nextTheme), nextTheme.primaryColor, auth.businessId)
      .run();
    await invalidatePublicMenu(env, auth.businessId);
    return json({ ok: true, menuTheme: nextTheme });
  }

  if (request.method === "GET" && path === "/api/admin/price-lists") {
    const [lists, business] = await Promise.all([
      env.DB.prepare(
        `SELECT list.id, list.name, list.is_normal AS isNormal,
          list.schedule_enabled AS scheduleEnabled,
          list.schedule_start_local AS scheduleStartLocal,
          list.schedule_end_local AS scheduleEndLocal,
          list.is_archived AS isArchived,
          COUNT(price.product_id) AS overrideCount
         FROM price_lists list
         LEFT JOIN product_prices price
          ON price.price_list_id=list.id AND price.business_id=list.business_id
         WHERE list.business_id=?
         GROUP BY list.id
         ORDER BY list.is_normal DESC, list.is_archived, list.created_at`,
      )
        .bind(auth.businessId)
        .all(),
      env.DB.prepare(
        `SELECT timezone, pricing_mode AS pricingMode,
          default_price_list_id AS defaultPriceListId
         FROM businesses WHERE id=?`,
      )
        .bind(auth.businessId)
        .first<Record<string, unknown>>(),
    ]);
    const pricing = await resolvePriceList(
      env,
      auth.businessId,
      business?.pricingMode,
      business?.defaultPriceListId,
      business?.timezone,
    );
    return json({
      priceLists: lists.results,
      activePriceListId: pricing.activeId,
    });
  }

  if (request.method === "POST" && path === "/api/admin/price-lists") {
    const body = await readJson(request);
    const fields = priceListFields(body);
    if ("error" in fields) return json({ error: fields.error }, 400);
    if (fields.scheduleEnabled) {
      const overlap = await overlappingPriceList(
        env,
        auth.businessId,
        String(fields.scheduleStartLocal),
        String(fields.scheduleEndLocal),
      );
      if (overlap)
        return json({ error: `Schedule overlaps ${overlap.name}` }, 409);
    }
    const priceListId = id("prl");
    try {
      await env.DB.prepare(
        `INSERT INTO price_lists
         (id,business_id,name,schedule_enabled,schedule_start_local,schedule_end_local)
         VALUES (?,?,?,?,?,?)`,
      )
        .bind(
          priceListId,
          auth.businessId,
          fields.name,
          fields.scheduleEnabled ? 1 : 0,
          fields.scheduleStartLocal,
          fields.scheduleEndLocal,
        )
        .run();
    } catch {
      return json({ error: "A price list with this name already exists" }, 409);
    }
    await invalidatePublicMenu(env, auth.businessId);
    return json({ id: priceListId }, 201);
  }

  const priceListMatch = path.match(
    /^\/api\/admin\/price-lists\/([a-zA-Z0-9_-]+)$/,
  );
  if (request.method === "PUT" && priceListMatch) {
    const priceListId = priceListMatch[1];
    const existing = await env.DB.prepare(
      `SELECT id,name,is_normal AS isNormal,is_archived AS isArchived
       FROM price_lists WHERE id=? AND business_id=?`,
    )
      .bind(priceListId, auth.businessId)
      .first<Record<string, unknown>>();
    if (!existing) return json({ error: "Price list not found" }, 404);
    const body = await readJson(request);
    const fields = priceListFields(body, Boolean(existing.isNormal));
    if ("error" in fields) return json({ error: fields.error }, 400);
    const isArchived = existing.isNormal ? false : Boolean(body.isArchived);
    if (fields.scheduleEnabled && !isArchived) {
      const overlap = await overlappingPriceList(
        env,
        auth.businessId,
        String(fields.scheduleStartLocal),
        String(fields.scheduleEndLocal),
        priceListId,
      );
      if (overlap)
        return json({ error: `Schedule overlaps ${overlap.name}` }, 409);
    }
    if (isArchived) {
      const business = await env.DB.prepare(
        `SELECT default_price_list_id AS defaultPriceListId, timezone
         FROM businesses WHERE id=?`,
      )
        .bind(auth.businessId)
        .first<Record<string, unknown>>();
      if (business?.defaultPriceListId === priceListId)
        return json(
          {
            error:
              "Choose another default price list before archiving this one",
          },
          409,
        );
      if (
        fields.scheduleEnabled &&
        String(fields.scheduleEndLocal) >
          localDateTimeNow(String(business?.timezone || "Asia/Phnom_Penh"))
      )
        return json(
          { error: "Disable the current or future schedule before archiving" },
          409,
        );
    }
    try {
      await env.DB.prepare(
        `UPDATE price_lists SET name=?,schedule_enabled=?,schedule_start_local=?,
          schedule_end_local=?,is_archived=?,updated_at=CURRENT_TIMESTAMP
         WHERE id=? AND business_id=?`,
      )
        .bind(
          existing.isNormal ? "Normal Rate" : fields.name,
          fields.scheduleEnabled ? 1 : 0,
          fields.scheduleStartLocal,
          fields.scheduleEndLocal,
          isArchived ? 1 : 0,
          priceListId,
          auth.businessId,
        )
        .run();
    } catch {
      return json({ error: "A price list with this name already exists" }, 409);
    }
    await invalidatePublicMenu(env, auth.businessId);
    return json({ ok: true });
  }

  if (request.method === "PUT" && path === "/api/admin/product-prices") {
    const body = await readJson(request);
    const productId = String(body.productId ?? "");
    const priceListId = String(body.priceListId ?? "");
    const portionId = body.portionId == null ? "" : String(body.portionId);
    const targetKey = portionId || "base";
    if (
      !RECORD_ID_PATTERN.test(productId) ||
      !RECORD_ID_PATTERN.test(priceListId) ||
      (targetKey !== "base" && !PRODUCT_OPTION_ID_PATTERN.test(targetKey))
    )
      return json({ error: "Invalid product price target" }, 400);
    const amount =
      body.priceCents === "" || body.priceCents == null
        ? null
        : validPriceAmount(body.priceCents);
    if (body.priceCents !== "" && body.priceCents != null && amount == null)
      return json({ error: "Price must be zero or greater" }, 400);

    const [product, list] = await Promise.all([
      env.DB.prepare(
        `SELECT id,price_cents AS priceCents,max_price AS maxPrice,
          portions_json AS portionsJson
         FROM products WHERE id=? AND business_id=?`,
      )
        .bind(productId, auth.businessId)
        .first<Record<string, unknown>>(),
      env.DB.prepare(
        `SELECT id,is_normal AS isNormal FROM price_lists
         WHERE id=? AND business_id=? AND is_archived=0`,
      )
        .bind(priceListId, auth.businessId)
        .first<Record<string, unknown>>(),
    ]);
    if (!product) return json({ error: "Menu item not found" }, 404);
    if (!list) return json({ error: "Price list not found" }, 404);
    const portions = jsonArray(product.portionsJson) as Array<
      Record<string, unknown>
    >;
    const portion = portions.find((item) => item.id === targetKey);
    if (targetKey === "base" && portions.length)
      return json(
        { error: "Products with portions do not have a base price row" },
        400,
      );
    if (targetKey !== "base" && !portion)
      return json({ error: "Product portion not found" }, 404);
    if (list.isNormal && amount == null)
      return json({ error: "Normal Rate prices cannot be empty" }, 400);

    const statements: D1PreparedStatement[] = [];
    if (amount == null) {
      statements.push(
        env.DB.prepare(
          `DELETE FROM product_prices
           WHERE business_id=? AND price_list_id=? AND product_id=? AND target_key=?`,
        ).bind(auth.businessId, priceListId, productId, targetKey),
      );
    } else {
      statements.push(
        env.DB.prepare(
          `INSERT INTO product_prices
           (business_id,price_list_id,product_id,target_key,price_amount)
           VALUES (?,?,?,?,?)
           ON CONFLICT(price_list_id,product_id,target_key) DO UPDATE SET
            price_amount=excluded.price_amount,updated_at=CURRENT_TIMESTAMP`,
        ).bind(auth.businessId, priceListId, productId, targetKey, amount),
      );
    }
    if (list.isNormal && amount != null) {
      if (targetKey === "base")
        statements.push(
          env.DB.prepare(
            `UPDATE products SET price_cents=?,max_price=?,updated_at=CURRENT_TIMESTAMP
             WHERE id=? AND business_id=?`,
          ).bind(amount, amount, productId, auth.businessId),
        );
      else {
        const nextPortions = portions.map((item) =>
          item.id === targetKey ? { ...item, priceCents: amount } : item,
        );
        const prices = nextPortions.map((item) => Number(item.priceCents || 0));
        statements.push(
          env.DB.prepare(
            `UPDATE products SET portions_json=?,price_cents=?,max_price=?,
              updated_at=CURRENT_TIMESTAMP
             WHERE id=? AND business_id=?`,
          ).bind(
            JSON.stringify(nextPortions),
            Math.min(...prices),
            Math.max(...prices),
            productId,
            auth.businessId,
          ),
        );
      }
    }
    await env.DB.batch(statements);
    const normalId = await normalPriceListId(env, auth.businessId);
    let effectivePriceCents = amount;
    let inherited = false;
    if (!list.isNormal && amount == null) {
      inherited = true;
      const normal = await env.DB.prepare(
        `SELECT price_amount AS priceCents FROM product_prices
         WHERE business_id=? AND price_list_id=? AND product_id=? AND target_key=?`,
      )
        .bind(auth.businessId, normalId, productId, targetKey)
        .first<{ priceCents: number }>();
      effectivePriceCents = Number(
        normal?.priceCents ??
          (targetKey === "base" ? product.priceCents : portion?.priceCents) ??
          0,
      );
    }
    await invalidatePublicMenu(env, auth.businessId);
    return json({ ok: true, effectivePriceCents, inherited });
  }

  if (request.method === "GET" && path === "/api/admin/qr-designs") {
    const browsing = qrCategoryBrowsingEnabled(env.DB, auth.businessId);
    if (url.searchParams.get("settings") === "1")
      return json({ allowCategoryBrowsing: await browsing });
    const designs = env.DB.prepare(
      `SELECT design.id, design.name, design.preset_key AS presetKey,
        design.target_type AS targetType, design.config_json AS configJson,
        design.background_media_id AS backgroundMediaId,
        background.object_key AS backgroundObjectKey,
        design.is_default AS isDefault, design.created_at AS createdAt,
        design.updated_at AS updatedAt
       FROM qr_designs design
       LEFT JOIN media background ON background.id = design.background_media_id
        AND background.business_id = design.business_id
       WHERE design.business_id = ?
       ORDER BY design.is_default DESC, design.updated_at DESC`,
    )
      .bind(auth.businessId)
      .all<Record<string, unknown>>();
    const [result, allowCategoryBrowsing] = await Promise.all([designs, browsing]);
    return json({
      designs: result.results.map((row) => hydrateQrDesign(row, env)),
      allowCategoryBrowsing,
    });
  }

  if (request.method === "POST" && path === "/api/admin/qr-designs") {
    const body = await readJson(request);
    const name = String(body.name ?? "Untitled QR design")
      .trim()
      .slice(0, 100);
    const presetKey = String(body.presetKey ?? "table-card");
    const targetType = body.targetType === "table" ? "table" : "menu";
    const backgroundMediaId = String(body.backgroundMediaId ?? "");
    if (!name) return json({ error: "Design name is required" }, 400);
    if (!QR_PRESETS.has(presetKey))
      return json({ error: "Unknown QR preset" }, 400);
    if (backgroundMediaId) {
      const media = await env.DB.prepare(
        "SELECT id FROM media WHERE id=? AND business_id=?",
      )
        .bind(backgroundMediaId, auth.businessId)
        .first();
      if (!media) return json({ error: "Background image was not found" }, 404);
    }
    const config = qrConfig(body.config);
    if (!config.menuSlug && !(await qrCategoryBrowsingEnabled(env.DB, auth.businessId)))
      return json({ error: "Choose an active menu before saving this QR design" }, 400);
    const designId = id("qrd");
    config.backgroundImageUrl = "";
    await env.DB.prepare(
      `INSERT INTO qr_designs
       (id,business_id,name,preset_key,target_type,config_json,background_media_id,is_default)
       VALUES (?,?,?,?,?,?,?,0)`,
    )
      .bind(
        designId,
        auth.businessId,
        name,
        presetKey,
        targetType,
        JSON.stringify(config),
        backgroundMediaId || null,
      )
      .run();
    return json({ id: designId }, 201);
  }

  const qrDuplicateMatch = path.match(
    /^\/api\/admin\/qr-designs\/([a-zA-Z0-9_-]+)\/duplicate$/,
  );
  if (request.method === "POST" && qrDuplicateMatch) {
    const source = await env.DB.prepare(
      `SELECT name,preset_key AS presetKey,target_type AS targetType,
        config_json AS configJson,background_media_id AS backgroundMediaId
       FROM qr_designs WHERE id=? AND business_id=?`,
    )
      .bind(qrDuplicateMatch[1], auth.businessId)
      .first<Record<string, unknown>>();
    if (!source) return json({ error: "QR design not found" }, 404);
    const designId = id("qrd");
    await env.DB.prepare(
      `INSERT INTO qr_designs
       (id,business_id,name,preset_key,target_type,config_json,background_media_id,is_default)
       VALUES (?,?,?,?,?,?,?,0)`,
    )
      .bind(
        designId,
        auth.businessId,
        `${String(source.name).slice(0, 90)} copy`,
        source.presetKey,
        source.targetType,
        source.configJson,
        source.backgroundMediaId || null,
      )
      .run();
    return json({ id: designId }, 201);
  }

  const qrDefaultMatch = path.match(
    /^\/api\/admin\/qr-designs\/([a-zA-Z0-9_-]+)\/default$/,
  );
  if (request.method === "PATCH" && qrDefaultMatch) {
    const design = await env.DB.prepare(
      "SELECT id FROM qr_designs WHERE id=? AND business_id=?",
    )
      .bind(qrDefaultMatch[1], auth.businessId)
      .first();
    if (!design) return json({ error: "QR design not found" }, 404);
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE qr_designs SET is_default=0 WHERE business_id=?",
      ).bind(auth.businessId),
      env.DB.prepare(
        "UPDATE qr_designs SET is_default=1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND business_id=?",
      ).bind(qrDefaultMatch[1], auth.businessId),
    ]);
    return json({ ok: true });
  }

  const qrDesignMatch = path.match(
    /^\/api\/admin\/qr-designs\/([a-zA-Z0-9_-]+)$/,
  );
  if (request.method === "PUT" && qrDesignMatch) {
    const body = await readJson(request);
    const name = String(body.name ?? "")
      .trim()
      .slice(0, 100);
    const presetKey = String(body.presetKey ?? "table-card");
    const targetType = body.targetType === "table" ? "table" : "menu";
    const backgroundMediaId = String(body.backgroundMediaId ?? "");
    if (!name) return json({ error: "Design name is required" }, 400);
    if (!QR_PRESETS.has(presetKey))
      return json({ error: "Unknown QR preset" }, 400);
    if (backgroundMediaId) {
      const media = await env.DB.prepare(
        "SELECT id FROM media WHERE id=? AND business_id=?",
      )
        .bind(backgroundMediaId, auth.businessId)
        .first();
      if (!media) return json({ error: "Background image was not found" }, 404);
    }
    const config = qrConfig(body.config);
    if (!config.menuSlug && !(await qrCategoryBrowsingEnabled(env.DB, auth.businessId)))
      return json({ error: "Choose an active menu before saving this QR design" }, 400);
    config.backgroundImageUrl = "";
    const result = await env.DB.prepare(
      `UPDATE qr_designs SET name=?,preset_key=?,target_type=?,config_json=?,
       background_media_id=?,updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND business_id=?`,
    )
      .bind(
        name,
        presetKey,
        targetType,
        JSON.stringify(config),
        backgroundMediaId || null,
        qrDesignMatch[1],
        auth.businessId,
      )
      .run();
    return result.meta.changes
      ? json({ ok: true })
      : json({ error: "QR design not found" }, 404);
  }
  if (request.method === "DELETE" && qrDesignMatch) {
    const design = await env.DB.prepare(
      "SELECT is_default AS isDefault FROM qr_designs WHERE id=? AND business_id=?",
    )
      .bind(qrDesignMatch[1], auth.businessId)
      .first<{ isDefault: number }>();
    if (!design) return json({ error: "QR design not found" }, 404);
    if (design.isDefault)
      return json(
        { error: "Choose another default before deleting this design" },
        409,
      );
    await env.DB.prepare("DELETE FROM qr_designs WHERE id=? AND business_id=?")
      .bind(qrDesignMatch[1], auth.businessId)
      .run();
    return json({ ok: true });
  }

  if (request.method === "GET" && path === "/api/admin/table-groups") {
    const branchId = url.searchParams.get("branchId") || "";
    const groups = await env.DB.prepare(
      `SELECT groups.id,groups.name,groups.sort_order AS sortOrder,groups.branch_id AS branchId,
        groups.is_active AS isActive,
        COUNT(tables.id) AS tableCount,
        SUM(CASE WHEN tables.is_active=1 THEN 1 ELSE 0 END) AS activeTableCount
       FROM table_groups groups
       LEFT JOIN restaurant_tables tables ON tables.group_id=groups.id
        AND tables.business_id=groups.business_id
       WHERE groups.business_id=? AND (?='' OR groups.branch_id=?)
       GROUP BY groups.id
       ORDER BY groups.sort_order,groups.name`,
    )
      .bind(auth.businessId,branchId,branchId)
      .all();
    return json({ groups: groups.results });
  }

  if (request.method === "POST" && path === "/api/admin/table-groups") {
    const body = await readJson(request);
    const name = String(body.name ?? "")
      .trim()
      .slice(0, 80);
    const sortOrder = parseSortOrder(body.sortOrder);
    if (!name) return json({ error: "Group name is required" }, 400);
    if (sortOrder == null) return json({ error: "Invalid group order" }, 400);
    const branchId = String(body.branchId ?? "");
    const branch = await env.DB.prepare(`SELECT id FROM branches WHERE business_id=? AND is_active=1
      AND ((?='' AND is_default=1) OR id=?)`).bind(auth.businessId,branchId,branchId).first<{ id: string }>();
    if (!branch) return json({ error: "Choose an active branch" },400);
    const groupId = id("grp");
    try {
      await env.DB.prepare(
        "INSERT INTO table_groups (id,business_id,branch_id,name,sort_order,is_active) VALUES (?,?,?,?,?,1)",
      )
        .bind(groupId, auth.businessId, branch.id, name, sortOrder)
        .run();
    } catch {
      return json(
        { error: "A table group with this name already exists" },
        409,
      );
    }
    return json({ id: groupId }, 201);
  }

  if (request.method === "PUT" && path === "/api/admin/table-groups/reorder") {
    const body = await readJson(request);
    const items = parseSortItems(body.items);
    if (!items) return json({ error: "Invalid table group order" }, 400);
    await env.DB.batch(
      items.map((item) =>
        env.DB.prepare(
          "UPDATE table_groups SET sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND business_id=?",
        ).bind(item.sortOrder, item.id, auth.businessId),
      ),
    );
    return json({ ok: true });
  }

  const tableGroupMatch = path.match(
    /^\/api\/admin\/table-groups\/([a-zA-Z0-9_-]+)$/,
  );
  if (request.method === "PUT" && tableGroupMatch) {
    const body = await readJson(request);
    const name = String(body.name ?? "")
      .trim()
      .slice(0, 80);
    const isActive = body.isActive === false || body.isActive === 0 ? 0 : 1;
    if (!name) return json({ error: "Group name is required" }, 400);
    if (!isActive) {
      const activeTables = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM restaurant_tables WHERE group_id=? AND business_id=? AND is_active=1",
      )
        .bind(tableGroupMatch[1], auth.businessId)
        .first<{ count: number }>();
      if (Number(activeTables?.count || 0) > 0)
        return json(
          {
            error: "Move or archive active tables before archiving this group",
          },
          409,
        );
    }
    try {
      const result = await env.DB.prepare(
        `UPDATE table_groups SET name=?,is_active=?,updated_at=CURRENT_TIMESTAMP
         WHERE id=? AND business_id=?`,
      )
        .bind(name, isActive, tableGroupMatch[1], auth.businessId)
        .run();
      return result.meta.changes
        ? json({ ok: true })
        : json({ error: "Table group not found" }, 404);
    } catch {
      return json(
        { error: "A table group with this name already exists" },
        409,
      );
    }
  }
  if (request.method === "DELETE" && tableGroupMatch) {
    const activeTables = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM restaurant_tables WHERE group_id=? AND business_id=? AND is_active=1",
    )
      .bind(tableGroupMatch[1], auth.businessId)
      .first<{ count: number }>();
    if (Number(activeTables?.count || 0) > 0)
      return json(
        { error: "Move or archive active tables before archiving this group" },
        409,
      );
    await env.DB.prepare(
      "UPDATE table_groups SET is_active=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND business_id=?",
    )
      .bind(tableGroupMatch[1], auth.businessId)
      .run();
    return json({ ok: true });
  }

  if (request.method === "GET" && path === "/api/admin/tables") {
    const branchId = url.searchParams.get("branchId") || "";
    const tables = await env.DB.prepare(
      `SELECT tables.id,tables.group_id AS groupId,tables.branch_id AS branchId,tables.code,tables.label,
        tables.public_token AS publicToken,tables.sort_order AS sortOrder,
        tables.is_active AS isActive,groups.name AS groupName,
        groups.is_active AS groupIsActive
       FROM restaurant_tables tables
       JOIN table_groups groups ON groups.id=tables.group_id
        AND groups.business_id=tables.business_id
       WHERE tables.business_id=? AND (?='' OR tables.branch_id=?)
       ORDER BY groups.sort_order,tables.sort_order,tables.code`,
    )
      .bind(auth.businessId,branchId,branchId)
      .all();
    return json({ tables: tables.results });
  }

  if (request.method === "POST" && path === "/api/admin/tables/bulk-delete") {
    const body = await readJson(request).catch(() => null);
    const tableIds = body?.tableIds ?? [];
    const groupIds = body?.groupIds ?? [];
    const includeGroupTables = body?.includeGroupTables ?? false;
    if (
      !Array.isArray(tableIds) || !Array.isArray(groupIds) ||
      typeof includeGroupTables !== "boolean" ||
      tableIds.length + groupIds.length === 0 || tableIds.length + groupIds.length > 10_000 ||
      [...tableIds, ...groupIds].some((id) => typeof id !== "string" || !RECORD_ID_PATTERN.test(id))
    ) {
      return json({ error: "Choose the tables or table groups to delete" }, 400);
    }

    const businessId = auth.businessId;
    const tables = JSON.stringify([...new Set(tableIds)]);
    const groups = JSON.stringify([...new Set(groupIds)]);
    const [deletedTables, deletedGroups, retained] = await env.DB.batch<Json>([
      env.DB.prepare(`WITH selected_tables AS (
          SELECT value AS id FROM json_each(?2)
        ), selected_groups AS (
          SELECT id FROM table_groups
          WHERE business_id=?1 AND ?4=1 AND id IN (SELECT value FROM json_each(?3))
        ), protected_tables AS (
          SELECT id, group_id FROM restaurant_tables
          WHERE (id IN (SELECT id FROM selected_tables) OR group_id IN (SELECT id FROM selected_groups))
            AND (business_id<>?1 OR id IN (SELECT table_id FROM orders))
        )
        DELETE FROM restaurant_tables
        WHERE business_id=?1 AND (
          group_id IN (
            SELECT id FROM selected_groups
            WHERE id NOT IN (SELECT group_id FROM protected_tables)
          )
          OR (
            id IN (SELECT id FROM selected_tables)
            AND group_id NOT IN (SELECT id FROM selected_groups)
            AND id NOT IN (SELECT id FROM protected_tables)
          )
        )
        RETURNING id`).bind(businessId, tables, groups, includeGroupTables ? 1 : 0),
      env.DB.prepare(`DELETE FROM table_groups
        WHERE business_id=?1 AND id IN (SELECT value FROM json_each(?2))
          AND id NOT IN (
            SELECT group_id FROM restaurant_tables WHERE group_id IN (SELECT value FROM json_each(?2))
          )
        RETURNING id`).bind(businessId, groups),
      env.DB.prepare(`SELECT
        (SELECT COUNT(*) FROM restaurant_tables
          WHERE business_id=?1 AND id IN (SELECT value FROM json_each(?2))) AS keptTableCount,
        (SELECT COUNT(*) FROM table_groups
          WHERE business_id=?1 AND id IN (SELECT value FROM json_each(?3))) AS keptGroupCount`)
        .bind(businessId, tables, groups),
    ]);
    return json({
      deletedTableIds: deletedTables.results.map(({ id }) => id),
      deletedGroupIds: deletedGroups.results.map(({ id }) => id),
      ...retained.results[0],
    });
  }

  if (request.method === "POST" && path === "/api/admin/tables") {
    const body = await readJson(request);
    const groupId = String(body.groupId ?? "");
    const code = String(body.code ?? "")
      .trim()
      .slice(0, 30);
    const label = String(body.label ?? code)
      .trim()
      .slice(0, 80);
    const sortOrder = parseSortOrder(body.sortOrder);
    if (!code || !label)
      return json({ error: "Table code and label are required" }, 400);
    if (sortOrder == null) return json({ error: "Invalid table order" }, 400);
    const group = await env.DB.prepare(
      `SELECT groups.branch_id AS branchId FROM table_groups groups JOIN branches branch ON branch.id=groups.branch_id
       WHERE groups.id=? AND groups.business_id=? AND groups.is_active=1 AND branch.is_active=1`,
    )
      .bind(groupId, auth.businessId)
      .first<{ branchId: string }>();
    if (!group) return json({ error: "Choose an active table group" }, 400);
    const tableId = id("tbl");
    const publicToken = id("scan");
    try {
      await env.DB.prepare(
        `INSERT INTO restaurant_tables
         (id,business_id,group_id,branch_id,code,label,public_token,sort_order,is_active)
         VALUES (?,?,?,?,?,?,?,?,1)`,
      )
        .bind(
          tableId,
          auth.businessId,
          groupId,
          group.branchId,
          code,
          label,
          publicToken,
          sortOrder,
        )
        .run();
    } catch {
      return json({ error: "A table with this code already exists" }, 409);
    }
    return json({ id: tableId, publicToken }, 201);
  }

  if (request.method === "PUT" && path === "/api/admin/tables/reorder") {
    const body = await readJson(request);
    const groupId = String(body.groupId ?? "");
    const items = parseSortItems(body.items);
    if (!groupId || !items) return json({ error: "Invalid table order" }, 400);
    await env.DB.batch(
      items.map((item) =>
        env.DB.prepare(
          `UPDATE restaurant_tables SET sort_order=?,updated_at=CURRENT_TIMESTAMP
           WHERE id=? AND business_id=? AND group_id=?`,
        ).bind(item.sortOrder, item.id, auth.businessId, groupId),
      ),
    );
    return json({ ok: true });
  }

  const restaurantTableMatch = path.match(
    /^\/api\/admin\/tables\/([a-zA-Z0-9_-]+)$/,
  );
  if (request.method === "PUT" && restaurantTableMatch) {
    const body = await readJson(request);
    const groupId = String(body.groupId ?? "");
    const code = String(body.code ?? "")
      .trim()
      .slice(0, 30);
    const label = String(body.label ?? code)
      .trim()
      .slice(0, 80);
    const isActive = body.isActive === false || body.isActive === 0 ? 0 : 1;
    if (!code || !label)
      return json({ error: "Table code and label are required" }, 400);
    const group = await env.DB.prepare(
      `SELECT groups.id FROM table_groups groups JOIN restaurant_tables tables
         ON tables.business_id=groups.business_id AND tables.branch_id=groups.branch_id
       WHERE groups.id=? AND groups.business_id=? AND groups.is_active=1 AND tables.id=?`,
    )
      .bind(groupId, auth.businessId,restaurantTableMatch[1])
      .first();
    if (!group) return json({ error: "Choose an active table group in the same branch" }, 400);
    try {
      const result = await env.DB.prepare(
        `UPDATE restaurant_tables SET group_id=?,code=?,label=?,is_active=?,
         updated_at=CURRENT_TIMESTAMP WHERE id=? AND business_id=?`,
      )
        .bind(
          groupId,
          code,
          label,
          isActive,
          restaurantTableMatch[1],
          auth.businessId,
        )
        .run();
      return result.meta.changes
        ? json({ ok: true })
        : json({ error: "Table not found" }, 404);
    } catch {
      return json({ error: "A table with this code already exists" }, 409);
    }
  }
  if (request.method === "DELETE" && restaurantTableMatch) {
    await env.DB.prepare(
      "UPDATE restaurant_tables SET is_active=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND business_id=?",
    )
      .bind(restaurantTableMatch[1], auth.businessId)
      .run();
    return json({ ok: true });
  }

  if (request.method === "GET" && path === "/api/admin/catalog") {
    const page = Math.max(
      1,
      Number.parseInt(url.searchParams.get("page") || "1", 10) || 1,
    );
    const pageSize = Math.min(
      1000,
      Math.max(
        1,
        Number.parseInt(url.searchParams.get("pageSize") || "50", 10) || 50,
      ),
    );
    const search = String(url.searchParams.get("query") || "")
      .trim()
      .toLowerCase();
    const categoryId = String(url.searchParams.get("categoryId") || "").trim();
    const productId = (url.searchParams.get("productId") ?? "").trim();
    const filter = String(url.searchParams.get("filter") || "all");
    const requestedSort = String(
      url.searchParams.get("sortBy") || "sort-order",
    );
    const sortColumns: Record<string, string> = {
      "sort-order": "product.sort_order",
      "name-km":
        "COALESCE(NULLIF(TRIM(product.name_km), ''), product.name, '') COLLATE NOCASE",
      "name-en":
        "COALESCE(NULLIF(TRIM(product.name_en), ''), product.name_km, product.name, '') COLLATE NOCASE",
      "name-zh":
        "COALESCE(NULLIF(TRIM(product.name_zh), ''), product.name_km, product.name, '') COLLATE NOCASE",
      "created-at": "product.created_at",
      "updated-at": "product.updated_at",
    };
    const sortColumn = sortColumns[requestedSort] || sortColumns["sort-order"];
    const sortDirection =
      String(url.searchParams.get("sortDirection") || "asc").toLowerCase() ===
      "desc"
        ? "DESC"
        : "ASC";
    const sortTieBreaker =
      requestedSort === "created-at" || requestedSort === "updated-at"
        ? `, product.rowid ${sortDirection}`
        : "";
    const visibleCategoryCte = `WITH RECURSIVE ${adminVisibleCategoryScope}`;
    let filterCte = visibleCategoryCte;
    const filterCteBindings = [auth.businessId, auth.businessId];
    const where = ["product.business_id = ?"];
    const whereBindings: unknown[] = [auth.businessId];
    if (productId) {
      where.push("product.id = ?");
      whereBindings.push(productId);
    }
    if (categoryId) {
      filterCte += `, ${adminCategoryScope}`;
      filterCteBindings.push(auth.businessId, categoryId, auth.businessId);
      where.push("product.category_id IN (SELECT id FROM filtered_category_ids)");
    }
    if (search) {
      where.push(`LOWER(
        COALESCE(product.code, '') || ' ' ||
        COALESCE(product.name_km, product.name, '') || ' ' ||
        COALESCE(product.name_en, '') || ' ' ||
        COALESCE(product.name_zh, '')
      ) LIKE ?`);
      whereBindings.push(`%${search}%`);
    }
    const filterPredicate = adminProductFilter(filter);
    if (filterPredicate) where.push(filterPredicate);
    const whereSql = where.join(" AND ");
    const commonBindings = [...filterCteBindings, ...whereBindings];
    if (url.searchParams.get("ids") === "matches")
      return matchingProductIds(env.DB, `${filterCte}
        SELECT product.id FROM products product WHERE ${whereSql}`, commonBindings);
    const [
      categories,
      banners,
      totalResult,
      products,
      globalCounts,
      categoryCounts,
    ] = await env.DB.batch<Json>([
      env.DB.prepare(
        `SELECT id, parent_id AS parentId, COALESCE(name_km, name) AS name,
          name_km AS nameKm, name_en AS nameEn, name_zh AS nameZh,
          slug, image_url AS imageUrl, image_media_id AS imageMediaId,
          sort_order AS sortOrder, is_active AS isActive
         FROM categories WHERE business_id=? ORDER BY sort_order, name`,
      ).bind(auth.businessId),
      env.DB.prepare(
        `SELECT id, title, subtitle, image_url AS imageUrl,
            detail_text AS detailText, cta_label AS ctaLabel,
            cta_url AS ctaUrl, starts_at AS startsAt, ends_at AS endsAt,
            sort_order AS sortOrder, is_active AS isActive
           FROM banners WHERE business_id=? ORDER BY sort_order, created_at`,
      ).bind(auth.businessId),
      env.DB.prepare(
        `${filterCte}
           SELECT COUNT(*) AS total FROM products product WHERE ${whereSql}`,
      ).bind(...commonBindings),
      env.DB.prepare(
        `${filterCte}
           SELECT product.id, product.code, product.rating,
            product.category_id AS categoryId,
            (SELECT json_group_array(assignment.menu_id) FROM menu_products assignment
              JOIN menus section ON section.business_id=assignment.business_id AND section.id=assignment.menu_id
              WHERE assignment.business_id=product.business_id AND assignment.product_id=product.id
                AND section.parent_id IS NOT NULL) AS assignedMenuIdsJson,
            COALESCE(product.name_km, product.name) AS name,
            product.name_km AS nameKm, product.name_en AS nameEn,
            product.name_zh AS nameZh, product.slug, product.description,
            product.price_cents AS priceCents, product.max_price AS maxPrice,
            product.unit,
            product.portions_json AS portionsJson,
            product.modifier_groups_json AS modifierGroupsJson,
            product.image_url AS imageUrl,
            product.primary_media_id AS primaryMediaId,
            product.is_featured AS isFeatured,
             product.is_available AS isAvailable, product.sort_order AS sortOrder,
             product.created_at AS createdAt, product.updated_at AS updatedAt
           FROM products product WHERE ${whereSql}
            ORDER BY ${sortColumn} ${sortDirection}${sortTieBreaker}, product.sort_order ASC,
             product.name ASC, product.id ASC LIMIT ? OFFSET ?`,
      ).bind(...commonBindings, pageSize, (page - 1) * pageSize),
      countAdminCatalogProducts(env.DB, auth.businessId),
      env.DB.prepare(
        `SELECT category_id AS categoryId, COUNT(*) AS total
           FROM products WHERE business_id = ? GROUP BY category_id`,
      ).bind(auth.businessId),
    ]);
    const pageProducts = products.results;
    const productIds = pageProducts.map((product) => String(product.id));
    let productImages: { results: unknown[] } = { results: [] };
    let productPrices: { results: unknown[] } = { results: [] };
    if (productIds.length) {
      const placeholders = productIds.map(() => "?").join(",");
      [productImages, productPrices] = await env.DB.batch([
        env.DB.prepare(
          `SELECT pi.product_id AS productId, m.id, (? || '/' || m.id) AS url,
           m.filename, pi.sort_order AS sortOrder, pi.is_primary AS isPrimary
           FROM product_images pi JOIN media m ON m.id = pi.media_id
           WHERE pi.business_id=? AND pi.product_id IN (${placeholders})
           ORDER BY pi.product_id, pi.sort_order`,
        ).bind(
          env.PUBLIC_ASSET_BASE.replace(/\/$/, ""),
          auth.businessId,
          ...productIds,
        ),
        env.DB.prepare(
          `SELECT product_id AS productId, price_list_id AS priceListId,
           CASE WHEN target_key='base' THEN NULL ELSE target_key END AS portionId,
           price_amount AS priceCents
           FROM product_prices WHERE business_id=?
             AND product_id IN (${placeholders})
           ORDER BY product_id,price_list_id,target_key`,
        ).bind(auth.businessId, ...productIds),
      ]);
    }
    const imagesByProduct = new Map<string, unknown[]>();
    for (const image of productImages.results as Array<
      Record<string, unknown>
    >) {
      const productId = String(image.productId);
      imagesByProduct.set(productId, [
        ...(imagesByProduct.get(productId) ?? []),
        image,
      ]);
    }
    return json({
      categories: categories.results,
      products: pageProducts.map(({ assignedMenuIdsJson, ...product }) => ({
        ...hydrateProduct(product),
        menuIds: jsonArray(assignedMenuIdsJson),
        images: imagesByProduct.get(String(product.id)) ?? [],
      })),
      banners: banners.results,
      priceEntries: productPrices.results,
      pagination: {
        page,
        pageSize,
        total: Number(totalResult.results[0]?.total ?? 0),
      },
      counts: {
        ...globalCounts.results[0],
        byCategory: Object.fromEntries(
          (
            categoryCounts.results as Array<{
              categoryId: string;
              total: number;
            }>
          ).map((item) => [item.categoryId, Number(item.total || 0)]),
        ),
      },
    });
  }

  if (request.method === "POST" && path === "/api/admin/categories") {
    const body = await readJson(request);
    const categoryId = id("cat");
    const nameKm = String(body.nameKm ?? "").trim();
    const nameEn = String(body.nameEn ?? "").trim() || nameKm;
    const nameZh = String(body.nameZh ?? "").trim() || nameKm;
    const imageMediaId = String(body.imageMediaId ?? "");
    let imageObjectKey = "";
    const isActive = body.isActive === false || body.isActive === 0 ? 0 : 1;
    const sortOrder = parseSortOrder(body.sortOrder);
    if (!nameKm) return json({ error: "Khmer category name is required" }, 400);
    if (sortOrder == null)
      return json(
        { error: "Sort order must be zero or a positive whole number" },
        400,
      );
    if (imageMediaId) {
      const categoryMedia = await env.DB.prepare(
        "SELECT id, object_key AS objectKey FROM media WHERE id=? AND business_id=?",
      )
        .bind(imageMediaId, auth.businessId)
        .first<{ id: string; objectKey: string }>();
      if (!categoryMedia)
        return json({ error: "Category photo not found" }, 404);
      imageObjectKey = categoryMedia.objectKey;
    }
    const parentId = body.parentId ? String(body.parentId) : null;
    if (parentId) {
      const parent = await env.DB.prepare(
        "SELECT id FROM categories WHERE id=? AND business_id=?",
      )
        .bind(parentId, auth.businessId)
        .first();
      if (!parent) return json({ error: "Parent category not found" }, 404);
    }
    await env.DB.prepare(
      `INSERT INTO categories
       (id,business_id,parent_id,name,name_km,name_en,name_zh,slug,image_url,image_media_id,sort_order,is_active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
      .bind(
        categoryId,
        auth.businessId,
        parentId,
        nameKm,
        nameKm,
        nameEn || null,
        nameZh || null,
        recordSlug(
          String(body.slug || nameEn || nameKm),
          "category",
          categoryId,
        ),
        imageMediaId
          ? mediaUrl(
              env,
              imageObjectKey,
              `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${imageMediaId}`,
            )
          : null,
        imageMediaId || null,
        sortOrder,
        isActive,
      )
      .run();
    await invalidatePublicMenu(env, auth.businessId);
    return json({ id: categoryId }, 201);
  }

  if (request.method === "POST" && path === "/api/admin/products") {
    const body = await readJson(request);
    const productId = id("prd");
    const nameKm = String(body.nameKm ?? "").trim();
    const nameEn = String(body.nameEn ?? "").trim();
    const nameZh = String(body.nameZh ?? "").trim();
    const options = await productOptions(body, env.DB, auth.businessId);
    if ("error" in options) return json({ error: options.error }, 400);
    const submittedPriceEntries =
      body.priceEntries === undefined
        ? undefined
        : parsePriceEntries(body.priceEntries);
    if (body.priceEntries !== undefined && !submittedPriceEntries)
      return json({ error: "Product price entries are invalid" }, 400);
    const submittedBasePrice = Number(body.priceCents ?? 0);
    const { minPrice: basePrice, maxPrice } = productPriceRange(
      options.portions,
      submittedBasePrice,
    );
    const sortOrder = parseSortOrder(body.sortOrder);
    const code = String(body.code ?? "").trim() || null;
    const ratingInput = body.rating;
    const rating =
      ratingInput == null || String(ratingInput).trim() === ""
        ? null
        : Number(ratingInput);
    const mediaIds = Array.isArray(body.mediaIds)
      ? [...new Set(body.mediaIds.map(String))].slice(0, 6)
      : [];
    const primaryMediaId = String(body.primaryMediaId ?? "");
    let primaryObjectKey = "";
    if (!nameKm) return json({ error: "Khmer menu name is required" }, 400);
    if (sortOrder == null)
      return json(
        { error: "Sort order must be zero or a positive whole number" },
        400,
      );
    if (!Number.isFinite(submittedBasePrice) || submittedBasePrice < 0)
      return json({ error: "Product price must be zero or greater" }, 400);
    if (
      rating != null &&
      (!Number.isFinite(rating) || rating < 0 || rating > 5)
    )
      return json({ error: "Guest rating must be between 0 and 5" }, 400);
    if (code && code.length > 64)
      return json(
        { error: "Menu item code must be 64 characters or less" },
        400,
      );
    if (code) {
      const duplicateCode = await env.DB.prepare(
        "SELECT id FROM products WHERE business_id=? AND code=? COLLATE NOCASE",
      )
        .bind(auth.businessId, code)
        .first();
      if (duplicateCode)
        return json(
          { error: "This menu item code is already used by your business" },
          409,
        );
    }
    if (mediaIds.length > 5)
      return json({ error: "Upload no more than 5 product photos" }, 400);
    if (mediaIds.length > 0 && !mediaIds.includes(primaryMediaId))
      return json(
        { error: "Select one uploaded photo as the product photo" },
        400,
      );
    if (mediaIds.length > 0) {
      const mediaPlaceholders = mediaIds.map(() => "?").join(",");
      const ownedMedia = await env.DB.prepare(
        `SELECT id, object_key AS objectKey FROM media
         WHERE business_id=? AND id IN (${mediaPlaceholders})`,
      )
        .bind(auth.businessId, ...mediaIds)
        .all();
      if (ownedMedia.results.length !== mediaIds.length)
        return json(
          { error: "One or more product photos were not found" },
          404,
        );
      primaryObjectKey = String(
        (ownedMedia.results as Array<Record<string, unknown>>).find(
          (media) => media.id === primaryMediaId,
        )?.objectKey ?? "",
      );
    }
    const categoryId = String(body.categoryId ?? "");
    const category = await env.DB.prepare(
      "SELECT id FROM categories WHERE id=? AND business_id=?",
    )
      .bind(categoryId, auth.businessId)
      .first();
    if (!category) return json({ error: "Category not found" }, 404);
    const primaryUrl = primaryMediaId
      ? mediaUrl(
          env,
          primaryObjectKey,
          `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${primaryMediaId}`,
        )
      : null;
    if (body.menuIds !== undefined && disabledControlPages.has("menus"))
      return json({ error: "The Menus module is disabled" },403);
    const assignments = await localMenuAssignments(env.DB,auth.businessId,productId,body.menuIds);
    if (!assignments) return json({ error: "Choose submenus managed by this business" },400);
    const pricing = await productPriceStatements(
      env,
      auth.businessId,
      productId,
      basePrice,
      options.portions,
      submittedPriceEntries || undefined,
    );
    if ("error" in pricing) return json({ error: pricing.error }, 400);
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO products
         (id,business_id,category_id,code,rating,name,name_km,name_en,name_zh,slug,description,
          price_cents,max_price,unit,portions_json,modifier_groups_json,image_url,primary_media_id,
          is_featured,is_available,sort_order)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).bind(
        productId,
        auth.businessId,
        categoryId,
        code,
        rating,
        nameKm,
        nameKm,
        nameEn || null,
        nameZh || null,
        recordSlug(
          String(body.slug || nameEn || nameKm),
          "menu-item",
          productId,
        ),
        String(body.description ?? ""),
        basePrice,
        maxPrice,
        options.unit,
        JSON.stringify(options.portions),
        JSON.stringify(options.modifierGroups),
        primaryUrl,
        primaryMediaId || null,
        body.isFeatured ? 1 : 0,
        body.isAvailable === false ? 0 : 1,
        sortOrder,
      ),
      ...mediaIds.map((mediaId, index) =>
        env.DB.prepare(
          `INSERT INTO product_images
           (product_id,media_id,business_id,sort_order,is_primary)
           VALUES (?,?,?,?,?)`,
        ).bind(
          productId,
          mediaId,
          auth.businessId,
          index,
          mediaId === primaryMediaId ? 1 : 0,
        ),
      ),
      ...pricing.statements,
      ...assignments,
      publicMenuVersionStatement(env.DB,auth.businessId),
    ]);
    return json({ id: productId }, 201);
  }

  if (request.method === "PUT" && path === "/api/admin/categories/reorder") {
    const body = await readJson(request);
    const items = parseSortItems(body.items);
    if (!items) return json({ error: "Invalid category sort order" }, 400);
    if (!items.length) return json({ ok: true });

    const sortJson = JSON.stringify(items);
    const owned = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM categories
       WHERE business_id=? AND id IN (
         SELECT json_extract(value, '$.id') FROM json_each(?)
       )`,
    )
      .bind(auth.businessId, sortJson)
      .first<{ total: number }>();
    if (Number(owned?.total ?? 0) !== items.length)
      return json({ error: "One or more categories were not found" }, 404);

    await env.DB.prepare(
      `UPDATE categories
       SET sort_order=CAST((
         SELECT json_extract(value, '$.sortOrder') FROM json_each(?)
         WHERE json_extract(value, '$.id')=categories.id
       ) AS INTEGER)
       WHERE business_id=? AND id IN (
         SELECT json_extract(value, '$.id') FROM json_each(?)
       )`,
    )
      .bind(sortJson, auth.businessId, sortJson)
      .run();
    await invalidatePublicMenu(env, auth.businessId);
    return json({ ok: true });
  }

  if (request.method === "PUT" && path === "/api/admin/products/reorder") {
    const body = await readJson(request);
    const categoryId = String(body.categoryId ?? "");
    const items = parseSortItems(body.items);
    if (!items || !categoryId)
      return json({ error: "Invalid menu item sort order" }, 400);

    const category = await env.DB.prepare(
      "SELECT id FROM categories WHERE id=? AND business_id=?",
    )
      .bind(categoryId, auth.businessId)
      .first();
    if (!category) return json({ error: "Category not found" }, 404);
    if (!items.length) return json({ ok: true });

    const sortJson = JSON.stringify(items);
    const owned = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM products
       WHERE business_id=? AND category_id=? AND id IN (
         SELECT json_extract(value, '$.id') FROM json_each(?)
       )`,
    )
      .bind(auth.businessId, categoryId, sortJson)
      .first<{ total: number }>();
    if (Number(owned?.total ?? 0) !== items.length)
      return json({ error: "One or more menu items were not found" }, 404);

    await env.DB.prepare(
      `UPDATE products
       SET sort_order=CAST((
         SELECT json_extract(value, '$.sortOrder') FROM json_each(?)
         WHERE json_extract(value, '$.id')=products.id
       ) AS INTEGER), updated_at=CURRENT_TIMESTAMP
       WHERE business_id=? AND category_id=? AND id IN (
         SELECT json_extract(value, '$.id') FROM json_each(?)
       )`,
    )
      .bind(sortJson, auth.businessId, categoryId, sortJson)
      .run();
    await invalidatePublicMenu(env, auth.businessId);
    return json({ ok: true });
  }

  const categoryUpdateMatch = path.match(
    /^\/api\/admin\/categories\/([a-zA-Z0-9_-]+)$/,
  );
  if (request.method === "PUT" && categoryUpdateMatch) {
    const categoryId = categoryUpdateMatch[1];
    const existing = await env.DB.prepare(
      "SELECT id FROM categories WHERE id=? AND business_id=?",
    )
      .bind(categoryId, auth.businessId)
      .first();
    if (!existing) return json({ error: "Category not found" }, 404);

    const body = await readJson(request);
    const nameKm = String(body.nameKm ?? "").trim();
    const nameEn = String(body.nameEn ?? "").trim() || nameKm;
    const nameZh = String(body.nameZh ?? "").trim() || nameKm;
    const imageMediaId = String(body.imageMediaId ?? "");
    let imageObjectKey = "";
    const parentId = body.parentId ? String(body.parentId) : null;
    const isActive = body.isActive === false || body.isActive === 0 ? 0 : 1;
    const sortOrder = parseSortOrder(body.sortOrder);
    if (!nameKm) return json({ error: "Khmer category name is required" }, 400);
    if (sortOrder == null)
      return json(
        { error: "Sort order must be zero or a positive whole number" },
        400,
      );
    if (parentId === categoryId)
      return json({ error: "A category cannot be its own parent" }, 400);
    if (parentId) {
      const parent = await env.DB.prepare(
        "SELECT id FROM categories WHERE id=? AND business_id=?",
      )
        .bind(parentId, auth.businessId)
        .first();
      if (!parent) return json({ error: "Parent category not found" }, 404);
    }
    if (imageMediaId) {
      const image = await env.DB.prepare(
        "SELECT id, object_key AS objectKey FROM media WHERE id=? AND business_id=?",
      )
        .bind(imageMediaId, auth.businessId)
        .first<{ id: string; objectKey: string }>();
      if (!image) return json({ error: "Category photo not found" }, 404);
      imageObjectKey = image.objectKey;
    }
    await env.DB.prepare(
      `UPDATE categories SET parent_id=?, name=?, name_km=?, name_en=?, name_zh=?,
       slug=?, image_url=?, image_media_id=?, sort_order=?, is_active=?
       WHERE id=? AND business_id=?`,
    )
      .bind(
        parentId,
        nameKm,
        nameKm,
        nameEn || null,
        nameZh || null,
        recordSlug(
          String(body.slug || nameEn || nameKm),
          "category",
          categoryId,
        ),
        imageMediaId
          ? mediaUrl(
              env,
              imageObjectKey,
              `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${imageMediaId}`,
            )
          : null,
        imageMediaId || null,
        sortOrder,
        isActive,
        categoryId,
        auth.businessId,
      )
      .run();
    await invalidatePublicMenu(env, auth.businessId);
    return json({ ok: true });
  }

  if (request.method === "PUT" && path === "/api/admin/products/bulk-info") {
    const body = await readJson(request);
    if (!Array.isArray(body.items) || body.items.length === 0)
      return json({ error: "At least one menu item is required" }, 400);
    if (body.items.length > 500)
      return json({ error: "Update no more than 500 menu items at once" }, 400);

    const items: Array<{
      id: string;
      code: string;
      nameKm: string;
      nameEn: string;
      nameZh: string;
      unit: string;
    }> = [];
    const productIds = new Set<string>();
    const productCodes = new Set<string>();
    for (const value of body.items) {
      if (!value || typeof value !== "object" || Array.isArray(value))
        return json({ error: "Invalid menu item update" }, 400);
      const item = value as Record<string, unknown>;
      const productId = String(item.id ?? "").trim();
      const code = String(item.code ?? "").trim();
      const nameKm = String(item.nameKm ?? "").trim();
      const nameEn = String(item.nameEn ?? "").trim();
      const nameZh = String(item.nameZh ?? "").trim();
      const unit = String(item.unit ?? "").trim();
      if (!/^[a-zA-Z0-9_-]+$/.test(productId) || productIds.has(productId))
        return json({ error: "Invalid or duplicate menu item" }, 400);
      if (code.length > 64)
        return json(
          { error: "Menu item code must be 64 characters or less" },
          400,
        );
      const normalizedCode = code.toLocaleLowerCase();
      if (normalizedCode && productCodes.has(normalizedCode))
        return json(
          { error: `Menu item code ${code} is used more than once` },
          409,
        );
      if (!nameKm) return json({ error: "Khmer menu name is required" }, 400);
      if (nameKm.length > 240 || nameEn.length > 240 || nameZh.length > 240)
        return json(
          { error: "Menu item names must be 240 characters or less" },
          400,
        );
      if (unit.length > 40)
        return json(
          { error: "Menu item unit must be 40 characters or less" },
          400,
        );
      productIds.add(productId);
      if (normalizedCode) productCodes.add(normalizedCode);
      items.push({ id: productId, code, nameKm, nameEn, nameZh, unit });
    }

    const chunks = Array.from(
      { length: Math.ceil(items.length / 50) },
      (_, index) => items.slice(index * 50, index * 50 + 50),
    );
    const ownedProductIds = new Set<string>();
    const existingCodes = new Map<string, string>();
    for (const chunk of chunks) {
      const placeholders = chunk.map(() => "?").join(",");
      const ownedProducts = await env.DB.prepare(
        `SELECT id,code FROM products WHERE business_id=? AND id IN (${placeholders})`,
      )
        .bind(auth.businessId, ...chunk.map((item) => item.id))
        .all<{ id: string; code: string | null }>();
      for (const product of ownedProducts.results) {
        ownedProductIds.add(product.id);
        existingCodes.set(product.id, product.code || "");
      }
    }
    if (ownedProductIds.size !== items.length)
      return json({ error: "One or more menu items were not found" }, 404);

    const requestedCodes = [...productCodes];
    for (let index = 0; index < requestedCodes.length; index += 50) {
      const codeChunk = requestedCodes.slice(index, index + 50);
      const placeholders = codeChunk.map(() => "?").join(",");
      const conflicts = await env.DB.prepare(
        `SELECT id,code FROM products
         WHERE business_id=? AND lower(code) IN (${placeholders})`,
      )
        .bind(auth.businessId, ...codeChunk)
        .all<{ id: string; code: string }>();
      const conflict = conflicts.results.find(
        (product) => !productIds.has(product.id),
      );
      if (conflict)
        return json(
          {
            error: `Menu item code ${conflict.code} is already used by your business`,
          },
          409,
        );
    }

    const changedCodeIds = items
      .filter(
        (item) =>
          item.code.toLocaleLowerCase() !==
          (existingCodes.get(item.id) || "").trim().toLocaleLowerCase(),
      )
      .map((item) => item.id);
    for (let index = 0; index < changedCodeIds.length; index += 50) {
      const idChunk = changedCodeIds.slice(index, index + 50);
      const placeholders = idChunk.map(() => "?").join(",");
      await env.DB.prepare(
        `UPDATE products SET code=NULL
         WHERE business_id=? AND id IN (${placeholders})`,
      )
        .bind(auth.businessId, ...idChunk)
        .run();
    }

    for (const chunk of chunks) {
      await env.DB.batch(
        chunk.map((item) =>
          env.DB.prepare(
            `UPDATE products SET code=?, name=?, name_km=?, name_en=?, name_zh=?, slug=?, unit=?,
             updated_at=CURRENT_TIMESTAMP WHERE id=? AND business_id=?`,
          ).bind(
            item.code || null,
            item.nameKm,
            item.nameKm,
            item.nameEn || null,
            item.nameZh || null,
            recordSlug(item.nameEn || item.nameKm, "menu-item", item.id),
            item.unit,
            item.id,
            auth.businessId,
          ),
        ),
      );
    }
    await invalidatePublicMenu(env, auth.businessId);
    return json({ ok: true, updated: items.length });
  }

  const productUpdateMatch = path.match(
    /^\/api\/admin\/products\/([a-zA-Z0-9_-]+)$/,
  );
  if (request.method === "PUT" && productUpdateMatch) {
    const productId = productUpdateMatch[1];
    const existing = await env.DB.prepare(
      "SELECT id FROM products WHERE id=? AND business_id=?",
    )
      .bind(productId, auth.businessId)
      .first();
    if (!existing) return json({ error: "Menu item not found" }, 404);

    const body = await readJson(request);
    const nameKm = String(body.nameKm ?? "").trim();
    const nameEn = String(body.nameEn ?? "").trim();
    const nameZh = String(body.nameZh ?? "").trim();
    const options = await productOptions(body, env.DB, auth.businessId);
    if ("error" in options) return json({ error: options.error }, 400);
    const submittedPriceEntries =
      body.priceEntries === undefined
        ? undefined
        : parsePriceEntries(body.priceEntries);
    if (body.priceEntries !== undefined && !submittedPriceEntries)
      return json({ error: "Product price entries are invalid" }, 400);
    const submittedBasePrice = Number(body.priceCents ?? 0);
    const { minPrice: basePrice, maxPrice } = productPriceRange(
      options.portions,
      submittedBasePrice,
    );
    const sortOrder = parseSortOrder(body.sortOrder);
    const code = String(body.code ?? "").trim() || null;
    const ratingInput = body.rating;
    const rating =
      ratingInput == null || String(ratingInput).trim() === ""
        ? null
        : Number(ratingInput);
    const categoryId = String(body.categoryId ?? "");
    const mediaIds = Array.isArray(body.mediaIds)
      ? [...new Set(body.mediaIds.map(String))].slice(0, 6)
      : [];
    const primaryMediaId = String(body.primaryMediaId ?? "");
    let primaryObjectKey = "";
    if (!nameKm) return json({ error: "Khmer menu name is required" }, 400);
    if (sortOrder == null)
      return json(
        { error: "Sort order must be zero or a positive whole number" },
        400,
      );
    if (!Number.isFinite(submittedBasePrice) || submittedBasePrice < 0)
      return json({ error: "Product price must be zero or greater" }, 400);
    if (
      rating != null &&
      (!Number.isFinite(rating) || rating < 0 || rating > 5)
    )
      return json({ error: "Guest rating must be between 0 and 5" }, 400);
    if (code && code.length > 64)
      return json(
        { error: "Menu item code must be 64 characters or less" },
        400,
      );
    if (code) {
      const duplicateCode = await env.DB.prepare(
        `SELECT id FROM products
         WHERE business_id=? AND code=? COLLATE NOCASE AND id<>?`,
      )
        .bind(auth.businessId, code, productId)
        .first();
      if (duplicateCode)
        return json(
          { error: "This menu item code is already used by your business" },
          409,
        );
    }
    if (mediaIds.length > 5)
      return json({ error: "Upload no more than 5 product photos" }, 400);
    if (mediaIds.length > 0 && !mediaIds.includes(primaryMediaId))
      return json(
        { error: "Select one uploaded photo as the product photo" },
        400,
      );
    const category = await env.DB.prepare(
      "SELECT id FROM categories WHERE id=? AND business_id=?",
    )
      .bind(categoryId, auth.businessId)
      .first();
    if (!category) return json({ error: "Category not found" }, 404);
    if (mediaIds.length > 0) {
      const mediaPlaceholders = mediaIds.map(() => "?").join(",");
      const ownedMedia = await env.DB.prepare(
        `SELECT id, object_key AS objectKey FROM media
         WHERE business_id=? AND id IN (${mediaPlaceholders})`,
      )
        .bind(auth.businessId, ...mediaIds)
        .all();
      if (ownedMedia.results.length !== mediaIds.length)
        return json(
          { error: "One or more product photos were not found" },
          404,
        );
      primaryObjectKey = String(
        (ownedMedia.results as Array<Record<string, unknown>>).find(
          (media) => media.id === primaryMediaId,
        )?.objectKey ?? "",
      );
    }
    const primaryUrl = primaryMediaId
      ? mediaUrl(
          env,
          primaryObjectKey,
          `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${primaryMediaId}`,
        )
      : null;
    if (body.menuIds !== undefined && disabledControlPages.has("menus"))
      return json({ error: "The Menus module is disabled" },403);
    const assignments = await localMenuAssignments(env.DB,auth.businessId,productId,body.menuIds);
    if (!assignments) return json({ error: "Choose submenus managed by this business" },400);
    const pricing = await productPriceStatements(
      env,
      auth.businessId,
      productId,
      basePrice,
      options.portions,
      submittedPriceEntries || undefined,
    );
    if ("error" in pricing) return json({ error: pricing.error }, 400);
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE products SET code=?, rating=?, category_id=?, name=?, name_km=?, name_en=?, name_zh=?,
          slug=?, description=?, price_cents=?, max_price=?, unit=?, portions_json=?, modifier_groups_json=?,
         image_url=?, primary_media_id=?,
         is_featured=?, is_available=?, sort_order=?, updated_at=CURRENT_TIMESTAMP
         WHERE id=? AND business_id=?`,
      ).bind(
        code,
        rating,
        categoryId,
        nameKm,
        nameKm,
        nameEn || null,
        nameZh || null,
        recordSlug(
          String(body.slug || nameEn || nameKm),
          "menu-item",
          productId,
        ),
        String(body.description ?? ""),
        basePrice,
        maxPrice,
        options.unit,
        JSON.stringify(options.portions),
        JSON.stringify(options.modifierGroups),
        primaryUrl,
        primaryMediaId || null,
        body.isFeatured ? 1 : 0,
        body.isAvailable === false ? 0 : 1,
        sortOrder,
        productId,
        auth.businessId,
      ),
      env.DB.prepare(
        "DELETE FROM product_images WHERE product_id=? AND business_id=?",
      ).bind(productId, auth.businessId),
      ...mediaIds.map((mediaId, index) =>
        env.DB.prepare(
          `INSERT INTO product_images
           (product_id,media_id,business_id,sort_order,is_primary)
           VALUES (?,?,?,?,?)`,
        ).bind(
          productId,
          mediaId,
          auth.businessId,
          index,
          mediaId === primaryMediaId ? 1 : 0,
        ),
      ),
      ...pricing.statements,
      ...assignments,
      publicMenuVersionStatement(env.DB,auth.businessId),
    ]);
    return json({ ok: true });
  }

  if (request.method === "POST" && path === "/api/admin/banners") {
    const body = await readJson(request);
    const fields = bannerFields(body);
    if ("error" in fields) return json({ error: fields.error }, 400);
    const bannerId = id("ban");
    await env.DB.prepare(
      `INSERT INTO banners
       (id,business_id,title,subtitle,image_url,detail_text,cta_label,cta_url,
        is_active,starts_at,ends_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    )
      .bind(
        bannerId,
        auth.businessId,
        fields.title,
        fields.subtitle,
        fields.imageUrl,
        fields.detailText,
        fields.ctaLabel,
        fields.ctaUrl,
        fields.isActive,
        fields.startsAt,
        fields.endsAt,
      )
      .run();
    await invalidatePublicMenu(env, auth.businessId);
    return json({ id: bannerId }, 201);
  }

  const bannerMatch = path.match(/^\/api\/admin\/banners\/([a-zA-Z0-9_-]+)$/);
  if (request.method === "PUT" && bannerMatch) {
    const bannerId = bannerMatch[1];
    const existing = await env.DB.prepare(
      "SELECT id FROM banners WHERE id=? AND business_id=?",
    )
      .bind(bannerId, auth.businessId)
      .first();
    if (!existing) return json({ error: "Banner not found" }, 404);
    const body = await readJson(request);
    const fields = bannerFields(body);
    if ("error" in fields) return json({ error: fields.error }, 400);
    await env.DB.prepare(
      `UPDATE banners SET title=?,subtitle=?,image_url=?,detail_text=?,
        cta_label=?,cta_url=?,is_active=?,starts_at=?,ends_at=?
       WHERE id=? AND business_id=?`,
    )
      .bind(
        fields.title,
        fields.subtitle,
        fields.imageUrl,
        fields.detailText,
        fields.ctaLabel,
        fields.ctaUrl,
        fields.isActive,
        fields.startsAt,
        fields.endsAt,
        bannerId,
        auth.businessId,
      )
      .run();
    await invalidatePublicMenu(env, auth.businessId);
    return json({ ok: true });
  }

  const categoryDeleteMatch = path.match(
    /^\/api\/admin\/categories\/([a-zA-Z0-9_-]+)$/,
  );
  if (request.method === "DELETE" && categoryDeleteMatch) {
    const categoryId = categoryDeleteMatch[1];
    const businessId = auth.businessId;
    const [deleted, , remaining] = await env.DB.batch<{ id: string; productCount: number; childCount: number }>([
      env.DB.prepare(`DELETE FROM categories WHERE id=?1 AND business_id=?2
        AND NOT EXISTS (SELECT 1 FROM products WHERE category_id=?1 AND business_id=?2)
        AND NOT EXISTS (SELECT 1 FROM categories WHERE parent_id=?1 AND business_id=?2)
        RETURNING id`).bind(categoryId, businessId),
      publicMenuVersionStatement(env.DB, businessId, true),
      env.DB.prepare(`SELECT category.id,
          (SELECT COUNT(*) FROM products WHERE category_id=?1 AND business_id=?2) AS productCount,
          (SELECT COUNT(*) FROM categories WHERE parent_id=?1 AND business_id=?2) AS childCount
        FROM categories category WHERE category.id=?1 AND category.business_id=?2`).bind(categoryId, businessId),
    ]);
    if (deleted.results.length) return json({ ok: true });
    const category = remaining.results[0];
    if (!category) return json({ error: "Category not found" }, 404);
    return json({
      error: "Remove menu items and child categories before deleting this category",
      productCount: category.productCount,
      childCount: category.childCount,
    }, 409);
  }

  const deleteMatch = path.match(
    /^\/api\/admin\/(products|banners)\/([a-zA-Z0-9_-]+)$/,
  );
  if (request.method === "POST" && path === "/api/admin/products/bulk-delete") {
    const body = await readJson(request).catch(() => null);
    const productIds = body?.productIds;
    if (
      !Array.isArray(productIds) || !productIds.length || productIds.length > maxProductSelection ||
      productIds.some((id) => typeof id !== "string" || !RECORD_ID_PATTERN.test(id))
    ) {
      return json({ error: "Select between 1 and 10,000 products to delete" }, 400);
    }
    return json(await deleteUnorderedProducts(env.DB, auth.businessId, [...new Set(productIds as string[])]));
  }
  if (request.method === "DELETE" && deleteMatch) {
    const table = deleteMatch[1];
    if (table === "products") {
      const { protectedIds } = await deleteUnorderedProducts(env.DB, auth.businessId, [deleteMatch[2]]);
      if (protectedIds.length)
        return json({ error: "Products with orders cannot be deleted" }, 409);
      return json({ ok: true });
    }
    await env.DB.batch([
      env.DB.prepare("DELETE FROM banners WHERE id=? AND business_id=?").bind(deleteMatch[2], auth.businessId),
      publicMenuVersionStatement(env.DB,auth.businessId),
    ]);
    return json({ ok: true });
  }

  if (request.method === "POST" && path === "/api/admin/media") {
    const form = await request.formData();
    const file = form.get("file");
    const allowedImageTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
    if (
      !(file instanceof File) ||
      file.size > 8 * 1024 * 1024 ||
      !allowedImageTypes.has(file.type)
    )
      return json({ error: "Upload a JPG, PNG or WebP image up to 8 MB" }, 400);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const objectKey = `businesses/${auth.businessId}/${crypto.randomUUID()}-${safeName}`;
    await env.MEDIA.put(objectKey, file.stream(), {
      httpMetadata: {
        contentType: file.type,
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
    const mediaId = id("med");
    await env.DB.prepare(
      "INSERT INTO media (id,business_id,object_key,filename,content_type,size_bytes) VALUES (?,?,?,?,?,?)",
    )
      .bind(
        mediaId,
        auth.businessId,
        objectKey,
        file.name,
        file.type,
        file.size,
      )
      .run();
    return json(
      {
        id: mediaId,
        url: mediaUrl(
          env,
          objectKey,
          `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${mediaId}`,
        ),
      },
      201,
    );
  }

  return json({ error: "Not found" }, 404);
}

type RpcSuccess<T> = { ok: true; data: T };
type RpcFailure = {
  ok: false;
  status: number;
  error: string;
  code?: string;
};
type RpcResult<T> = RpcSuccess<T> | RpcFailure;

const rpcSuccess = <T>(data: T): RpcSuccess<T> => ({ ok: true, data });
const rpcFailure = (
  status: number,
  error: string,
  code?: string,
): RpcFailure => ({ ok: false, status, error, ...(code ? { code } : {}) });

function auditStatement(
  env: Env,
  actorEmail: string,
  action: string,
  businessId: string | null,
  userId: string | null,
  details: Record<string, unknown> = {},
  onlyAfterChanges = false,
) {
  return env.DB.prepare(
    `INSERT INTO super_admin_audit_log
     (id,actor_email,action,business_id,user_id,details_json)
     SELECT ?,?,?,?,?,?${onlyAfterChanges ? " WHERE changes()>0" : ""}`,
  ).bind(
    id("aud"),
    actorEmail,
    action,
    businessId,
    userId,
    JSON.stringify(details),
  );
}

function normalizedAdminEmail(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 254);
}

function validAccountEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function withSubscription(row: Record<string, unknown>) {
  const item = { ...row };
  const subscription = subscriptionSummary(
    item as SubscriptionRow,
    String(item.timezone || "UTC"),
  );
  delete item.subscriptionPlanCode;
  delete item.subscriptionPlanName;
  delete item.subscriptionSource;
  delete item.subscriptionStatus;
  delete item.trialEndsAt;
  delete item.currentPeriodEndAt;
  return { ...item, subscription };
}

const CLONE_SECTION_ORDER = [
  "categories",
  "products",
  "pricing",
  "theme",
  "businessSettings",
] as const;
const CLONE_SECTIONS = new Set<string>(CLONE_SECTION_ORDER);
type CloneSection = (typeof CLONE_SECTION_ORDER)[number];
type CloneCounts = {
  categories: number;
  products: number;
  priceLists: number;
  productPrices: number;
};
type CloneContext = {
  source: Record<string, unknown>;
  target: Record<string, unknown>;
  sections: CloneSection[];
  categories: Array<Record<string, unknown>>;
  products: Array<Record<string, unknown>>;
  productImages: Array<Record<string, unknown>>;
  priceLists: Array<Record<string, unknown>>;
  productPrices: Array<Record<string, unknown>>;
  media: Array<Record<string, unknown>>;
  referencedMediaIds: Set<string>;
  sourceCounts: CloneCounts;
  targetCounts: CloneCounts;
  warnings: string[];
  blockers: string[];
  targetNormalPriceListId: string | null;
};

class CloneDataError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code?: string,
  ) {
    super(message);
  }
}

function effectiveCloneSections(value: unknown): CloneSection[] {
  if (!Array.isArray(value) || !value.length)
    throw new CloneDataError("Choose at least one data section to clone");
  const requested = new Set<CloneSection>();
  for (const section of value) {
    if (typeof section !== "string" || !CLONE_SECTIONS.has(section))
      throw new CloneDataError("One or more clone sections are invalid");
    requested.add(section as CloneSection);
  }
  if (requested.has("pricing")) requested.add("products");
  if (requested.has("products")) requested.add("categories");
  return CLONE_SECTION_ORDER.filter((section) => requested.has(section));
}

function parsedJsonObject(value: unknown) {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function cloneRows(
  env: Env,
  sql: string,
  ...bindings: Array<string | number>
) {
  return (
    await env.DB.prepare(sql)
      .bind(...bindings)
      .all<Record<string, unknown>>()
  ).results;
}

function cloneCountRow(row: Record<string, unknown> | null): CloneCounts {
  return {
    categories: Number(row?.categories || 0),
    products: Number(row?.products || 0),
    priceLists: Number(row?.priceLists || 0),
    productPrices: Number(row?.productPrices || 0),
  };
}

async function prepareCloneContext(
  env: Env,
  targetBusinessId: string,
  sourceBusinessId: string,
  requestedSections: unknown,
): Promise<CloneContext> {
  const sections = effectiveCloneSections(requestedSections);
  if (sourceBusinessId === targetBusinessId)
    throw new CloneDataError(
      "Source and target businesses must be different",
      409,
      "SAME_BUSINESS",
    );
  const countSql = `SELECT
    (SELECT COUNT(*) FROM categories WHERE business_id=?) AS categories,
    (SELECT COUNT(*) FROM products WHERE business_id=?) AS products,
    (SELECT COUNT(*) FROM price_lists WHERE business_id=?) AS priceLists,
    (SELECT COUNT(*) FROM product_prices WHERE business_id=?) AS productPrices`;
  const [source, target, sourceCountResult, targetCountResult] =
    await Promise.all([
      env.DB.prepare("SELECT * FROM businesses WHERE id=?")
        .bind(sourceBusinessId)
        .first<Record<string, unknown>>(),
      env.DB.prepare("SELECT * FROM businesses WHERE id=?")
        .bind(targetBusinessId)
        .first<Record<string, unknown>>(),
      env.DB.prepare(countSql)
        .bind(
          sourceBusinessId,
          sourceBusinessId,
          sourceBusinessId,
          sourceBusinessId,
        )
        .first<Record<string, unknown>>(),
      env.DB.prepare(countSql)
        .bind(
          targetBusinessId,
          targetBusinessId,
          targetBusinessId,
          targetBusinessId,
        )
        .first<Record<string, unknown>>(),
    ]);
  if (!source) throw new CloneDataError("Source business not found", 404);
  if (!target) throw new CloneDataError("Target business not found", 404);

  const wantsCategories = sections.includes("categories");
  const wantsProducts = sections.includes("products");
  const wantsPricing = sections.includes("pricing");
  const [categories, products, productImages, priceLists, productPrices] =
    await Promise.all([
      wantsCategories
        ? cloneRows(
            env,
            "SELECT * FROM categories WHERE business_id=? ORDER BY sort_order,created_at",
            sourceBusinessId,
          )
        : Promise.resolve([]),
      wantsProducts
        ? cloneRows(
            env,
            "SELECT * FROM products WHERE business_id=? ORDER BY sort_order,created_at",
            sourceBusinessId,
          )
        : Promise.resolve([]),
      wantsProducts
        ? cloneRows(
            env,
            "SELECT * FROM product_images WHERE business_id=? ORDER BY product_id,sort_order",
            sourceBusinessId,
          )
        : Promise.resolve([]),
      wantsPricing
        ? cloneRows(
            env,
            "SELECT * FROM price_lists WHERE business_id=? ORDER BY is_normal DESC,created_at",
            sourceBusinessId,
          )
        : Promise.resolve([]),
      wantsPricing
        ? cloneRows(
            env,
            "SELECT * FROM product_prices WHERE business_id=?",
            sourceBusinessId,
          )
        : Promise.resolve([]),
    ]);

  const referencedMediaIds = new Set<string>();
  if (wantsCategories)
    for (const category of categories)
      if (category.image_media_id)
        referencedMediaIds.add(String(category.image_media_id));
  if (wantsProducts) {
    for (const product of products)
      if (product.primary_media_id)
        referencedMediaIds.add(String(product.primary_media_id));
    for (const image of productImages)
      if (image.media_id) referencedMediaIds.add(String(image.media_id));
  }
  if (sections.includes("theme")) {
    const theme = parsedJsonObject(source.menu_theme_json);
    for (const { mediaId } of menuThemeImageFields)
      if (theme[mediaId]) referencedMediaIds.add(String(theme[mediaId]));
  }
  if (sections.includes("businessSettings") && source.logo_media_id)
    referencedMediaIds.add(String(source.logo_media_id));

  const allSourceMedia = referencedMediaIds.size
    ? await cloneRows(
        env,
        "SELECT * FROM media WHERE business_id=?",
        sourceBusinessId,
      )
    : [];
  const media = allSourceMedia.filter((item) =>
    referencedMediaIds.has(String(item.id)),
  );
  const foundMediaIds = new Set(media.map((item) => String(item.id)));
  const missingMediaIds = [...referencedMediaIds].filter(
    (mediaId) => !foundMediaIds.has(mediaId),
  );
  const sourceCounts = cloneCountRow(sourceCountResult);
  const targetCounts = cloneCountRow(targetCountResult);
  const warnings: string[] = [];
  const blockers: string[] = [];
  const productPortions = products.map((product) => jsonArray(product.portions_json) as Json[]);
  const portionBranchIds = [...new Set(productPortions.flat().flatMap(({ branchId }) =>
    typeof branchId === "string" ? [branchId] : [],
  ))];
  if (portionBranchIds.length) {
    const matches = await env.DB.prepare(`SELECT source.id, target.id AS targetId FROM branches source
      JOIN branches target ON target.slug=source.slug AND target.business_id=?
      WHERE source.business_id=? AND source.id IN (SELECT value FROM json_each(?))`)
      .bind(targetBusinessId, sourceBusinessId, JSON.stringify(portionBranchIds))
      .all<{ id: string; targetId: string }>();
    if (matches.results.length !== portionBranchIds.length) {
      blockers.push("Create branches with matching link slugs in the target business before cloning branch-specific portions.");
    } else {
      const branchIds = new Map(matches.results.map(({ id, targetId }) => [id, targetId]));
      for (const [index, portions] of productPortions.entries()) {
        if (portions.some((portion) => portion.branchId != null))
          products[index].portions_json = JSON.stringify(portions.map((portion) =>
            typeof portion.branchId === "string" ? { ...portion, branchId: branchIds.get(portion.branchId) } : portion,
          ));
      }
    }
  }
  if (wantsCategories && !wantsProducts && targetCounts.products > 0)
    blockers.push(
      "Products must also be selected because the target currently has products linked to its categories.",
    );
  if (missingMediaIds.length)
    blockers.push(
      `${missingMediaIds.length} referenced source image${missingMediaIds.length === 1 ? " is" : "s are"} missing.`,
    );
  if (wantsProducts && !wantsPricing)
    warnings.push(
      "Target price-list definitions will be kept, but existing product overrides will be removed and the normal list will be seeded from the cloned products.",
    );
  if (
    (wantsCategories && targetCounts.categories > 0) ||
    (wantsProducts && targetCounts.products > 0) ||
    (wantsPricing && targetCounts.priceLists > 0)
  )
    warnings.push(
      "Existing data in the selected target sections will be replaced.",
    );

  let targetNormalPriceListId: string | null = null;
  if (wantsProducts && !wantsPricing) {
    const normal = await env.DB.prepare(
      "SELECT id FROM price_lists WHERE business_id=? AND is_normal=1",
    )
      .bind(targetBusinessId)
      .first<{ id: string }>();
    targetNormalPriceListId = normal?.id || null;
    if (!targetNormalPriceListId)
      blockers.push("The target business does not have a normal price list.");
  }
  return {
    source,
    target,
    sections,
    categories,
    products,
    productImages,
    priceLists,
    productPrices,
    media,
    referencedMediaIds,
    sourceCounts,
    targetCounts,
    warnings,
    blockers,
    targetNormalPriceListId,
  };
}

function clonePreviewPayload(context: CloneContext) {
  return {
    source: {
      id: String(context.source.id),
      name: String(context.source.name),
    },
    target: {
      id: String(context.target.id),
      name: String(context.target.name),
    },
    effectiveSections: context.sections,
    sourceCounts: context.sourceCounts,
    targetCounts: context.targetCounts,
    referencedMediaCount: context.referencedMediaIds.size,
    warnings: context.warnings,
    blockers: context.blockers,
    canClone: context.blockers.length === 0,
  };
}

function jsonRowChunks(rows: Array<Record<string, unknown>>) {
  const chunks: Array<Array<Record<string, unknown>>> = [];
  let current: Array<Record<string, unknown>> = [];
  let currentBytes = 2;
  const encoder = new TextEncoder();
  for (const row of rows) {
    const bytes = encoder.encode(JSON.stringify(row)).byteLength + 1;
    if (current.length && currentBytes + bytes > 1_500_000) {
      chunks.push(current);
      current = [];
      currentBytes = 2;
    }
    current.push(row);
    currentBytes += bytes;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

function cloneInsertStatements(
  env: Env,
  rows: Array<Record<string, unknown>>,
  sql: string,
  ...bindings: Array<string | number>
) {
  return jsonRowChunks(rows).map((chunk) =>
    env.DB.prepare(sql).bind(...bindings, JSON.stringify(chunk)),
  );
}

async function withConcurrency<T>(
  items: T[],
  limit: number,
  operation: (item: T) => Promise<void>,
) {
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const item = items[cursor];
        cursor += 1;
        await operation(item);
      }
    },
  );
  const results = await Promise.allSettled(workers);
  const failure = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failure) throw failure.reason;
}

async function discardStagedMedia(env: Env, keys: string[]) {
  await withConcurrency(keys, 4, async (key) => {
    try {
      await env.MEDIA.delete(key);
    } catch {
      console.warn("clone_media_cleanup_failed", { key });
    }
  });
}

type StagedCloneMedia = {
  id: string;
  objectKey: string;
  url: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
};

async function stageCloneMedia(
  env: Env,
  targetBusinessId: string,
  sourceMedia: Array<Record<string, unknown>>,
) {
  const mediaMap = new Map<string, StagedCloneMedia>();
  const stagedKeys: string[] = [];
  try {
    await withConcurrency(sourceMedia, 2, async (item) => {
      const sourceKey = String(item.object_key || "");
      const object = sourceKey ? await env.MEDIA.get(sourceKey) : null;
      if (!object)
        throw new CloneDataError(
          `Source image ${String(item.filename || item.id)} could not be read`,
          409,
          "SOURCE_MEDIA_MISSING",
        );
      const filename = String(item.filename || "image").slice(0, 255);
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
      const objectKey = `businesses/${targetBusinessId}/${crypto.randomUUID()}-${safeName}`;
      await env.MEDIA.put(objectKey, object.body, {
        httpMetadata: object.httpMetadata,
        customMetadata: object.customMetadata,
      });
      stagedKeys.push(objectKey);
      const mediaId = id("med");
      mediaMap.set(String(item.id), {
        id: mediaId,
        objectKey,
        url: mediaUrl(
          env,
          objectKey,
          `${env.PUBLIC_ASSET_BASE.replace(/\/$/, "")}/${mediaId}`,
        ),
        filename,
        contentType: String(
          item.content_type || object.httpMetadata?.contentType || "",
        ),
        sizeBytes: Number(item.size_bytes || object.size || 0),
      });
    });
    return { mediaMap, stagedKeys };
  } catch (error) {
    await discardStagedMedia(env, stagedKeys);
    throw error;
  }
}

function cloneIdMap(rows: Array<Record<string, unknown>>, prefix: string) {
  return new Map(rows.map((row) => [String(row.id), id(prefix)]));
}

async function executeBusinessClone(
  env: Env,
  context: CloneContext,
  actorEmail: string,
) {
  if (context.blockers.length)
    throw new CloneDataError(context.blockers[0], 409, "CLONE_BLOCKED");
  const targetId = String(context.target.id);
  const categoryIds = cloneIdMap(context.categories, "cat");
  const productIds = cloneIdMap(context.products, "prd");
  const priceListIds = cloneIdMap(context.priceLists, "prl");
  const { mediaMap, stagedKeys } = await stageCloneMedia(
    env,
    targetId,
    context.media,
  );
  const mappedMedia = [...mediaMap.values()].map((item) => ({
    id: item.id,
    object_key: item.objectKey,
    filename: item.filename,
    content_type: item.contentType,
    size_bytes: item.sizeBytes,
  }));
  const mappedCategories = context.categories.map((row) => {
    const image = row.image_media_id
      ? mediaMap.get(String(row.image_media_id))
      : undefined;
    return {
      ...row,
      id: categoryIds.get(String(row.id)),
      parent_id: row.parent_id
        ? categoryIds.get(String(row.parent_id)) || null
        : null,
      image_media_id: image?.id || null,
      image_url: image?.url || row.image_url || null,
    };
  });
  const mappedCategoryById = new Map(
    mappedCategories.map((row) => [String(row.id), row]),
  );
  const categoryDepth = (row: Record<string, unknown>) => {
    let depth = 0;
    let parentId = String(row.parent_id || "");
    const visited = new Set<string>();
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = mappedCategoryById.get(parentId);
      if (!parent) break;
      depth += 1;
      parentId = String(parent.parent_id || "");
    }
    return depth;
  };
  mappedCategories.sort(
    (left, right) => categoryDepth(left) - categoryDepth(right),
  );
  const mappedProducts: Array<Record<string, unknown>> = context.products.map(
    (row) => {
      const image = row.primary_media_id
        ? mediaMap.get(String(row.primary_media_id))
        : undefined;
      return {
        ...row,
        id: productIds.get(String(row.id)),
        category_id: categoryIds.get(String(row.category_id)),
        primary_media_id: image?.id || null,
        image_url: image?.url || row.image_url || null,
      };
    },
  );
  const mappedProductImages = context.productImages.map((row) => ({
    product_id: productIds.get(String(row.product_id)),
    media_id: mediaMap.get(String(row.media_id))?.id,
    sort_order: row.sort_order,
    is_primary: row.is_primary,
  }));
  const mappedPriceLists: Array<Record<string, unknown>> =
    context.priceLists.map((row) => ({
      ...row,
      id: priceListIds.get(String(row.id)),
    }));
  const mappedProductPrices: Array<Record<string, unknown>> =
    context.productPrices
      .filter(
        (row) =>
          productIds.has(String(row.product_id)) &&
          priceListIds.has(String(row.price_list_id)),
      )
      .map((row) => ({
        price_list_id: priceListIds.get(String(row.price_list_id)),
        product_id: productIds.get(String(row.product_id)),
        target_key: row.target_key,
        price_amount: row.price_amount,
      }));
  if (
    context.sections.includes("products") &&
    !context.sections.includes("pricing")
  ) {
    const normalId = String(context.targetNormalPriceListId);
    for (const product of mappedProducts) {
      const portions = (() => {
        try {
          const value = JSON.parse(String(product.portions_json || "[]"));
          return Array.isArray(value) ? value : [];
        } catch {
          return [];
        }
      })() as Array<Record<string, unknown>>;
      if (!portions.length)
        mappedProductPrices.push({
          price_list_id: normalId,
          product_id: product.id,
          target_key: "base",
          price_amount: product.price_cents,
        });
      for (const portion of portions)
        if (portion.id != null && portion.priceCents != null)
          mappedProductPrices.push({
            price_list_id: normalId,
            product_id: product.id,
            target_key: String(portion.id),
            price_amount: Number(portion.priceCents),
          });
    }
  }

  const statements: D1PreparedStatement[] = [];
  if (context.sections.includes("pricing"))
    statements.push(
      env.DB.prepare(
        "UPDATE businesses SET default_price_list_id=NULL WHERE id=?",
      ).bind(targetId),
    );
  if (context.sections.includes("products"))
    statements.push(
      env.DB.prepare("DELETE FROM products WHERE business_id=?").bind(targetId),
    );
  if (context.sections.includes("categories"))
    statements.push(
      env.DB.prepare("DELETE FROM categories WHERE business_id=?").bind(
        targetId,
      ),
    );
  if (context.sections.includes("pricing"))
    statements.push(
      env.DB.prepare("DELETE FROM price_lists WHERE business_id=?").bind(
        targetId,
      ),
    );
  statements.push(
    ...cloneInsertStatements(
      env,
      mappedMedia,
      `INSERT INTO media
       (id,business_id,object_key,filename,content_type,size_bytes)
       SELECT json_extract(value,'$.id'),?,
        json_extract(value,'$.object_key'),json_extract(value,'$.filename'),
        json_extract(value,'$.content_type'),json_extract(value,'$.size_bytes')
       FROM json_each(?)`,
      targetId,
    ),
  );
  statements.push(
    ...cloneInsertStatements(
      env,
      mappedCategories,
      `INSERT INTO categories
       (id,business_id,parent_id,name,slug,image_url,sort_order,is_active,
        name_km,name_en,name_zh,image_media_id)
       SELECT json_extract(value,'$.id'),?,json_extract(value,'$.parent_id'),
        json_extract(value,'$.name'),json_extract(value,'$.slug'),
        json_extract(value,'$.image_url'),json_extract(value,'$.sort_order'),
        json_extract(value,'$.is_active'),json_extract(value,'$.name_km'),
        json_extract(value,'$.name_en'),json_extract(value,'$.name_zh'),
        json_extract(value,'$.image_media_id')
       FROM json_each(?)`,
      targetId,
    ),
  );

  statements.push(
    ...cloneInsertStatements(
      env,
      mappedProducts,
      `INSERT INTO products
       (id,business_id,category_id,name,slug,description,price_cents,max_price,
        image_url,calories,prep_minutes,is_featured,is_available,sort_order,
        name_km,name_en,name_zh,primary_media_id,code,unit,portions_json,
        modifier_groups_json,rating)
       SELECT json_extract(value,'$.id'),?,json_extract(value,'$.category_id'),
        json_extract(value,'$.name'),json_extract(value,'$.slug'),
        json_extract(value,'$.description'),json_extract(value,'$.price_cents'),
        json_extract(value,'$.max_price'),json_extract(value,'$.image_url'),
        json_extract(value,'$.calories'),json_extract(value,'$.prep_minutes'),
        json_extract(value,'$.is_featured'),json_extract(value,'$.is_available'),
        json_extract(value,'$.sort_order'),json_extract(value,'$.name_km'),
        json_extract(value,'$.name_en'),json_extract(value,'$.name_zh'),
        json_extract(value,'$.primary_media_id'),json_extract(value,'$.code'),
        json_extract(value,'$.unit'),json_extract(value,'$.portions_json'),
        json_extract(value,'$.modifier_groups_json'),json_extract(value,'$.rating')
       FROM json_each(?)`,
      targetId,
    ),
  );
  statements.push(
    ...cloneInsertStatements(
      env,
      mappedProductImages,
      `INSERT INTO product_images
       (product_id,media_id,business_id,sort_order,is_primary)
       SELECT json_extract(value,'$.product_id'),
        json_extract(value,'$.media_id'),?,json_extract(value,'$.sort_order'),
        json_extract(value,'$.is_primary') FROM json_each(?)`,
      targetId,
    ),
  );
  statements.push(
    ...cloneInsertStatements(
      env,
      mappedPriceLists,
      `INSERT INTO price_lists
       (id,business_id,name,is_normal,schedule_enabled,schedule_start_local,
        schedule_end_local,is_archived)
       SELECT json_extract(value,'$.id'),?,json_extract(value,'$.name'),
        json_extract(value,'$.is_normal'),
        json_extract(value,'$.schedule_enabled'),
        json_extract(value,'$.schedule_start_local'),
        json_extract(value,'$.schedule_end_local'),
        json_extract(value,'$.is_archived') FROM json_each(?)`,
      targetId,
    ),
  );
  statements.push(
    ...cloneInsertStatements(
      env,
      mappedProductPrices,
      `INSERT INTO product_prices
       (business_id,price_list_id,product_id,target_key,price_amount)
       SELECT ?,json_extract(value,'$.price_list_id'),
        json_extract(value,'$.product_id'),json_extract(value,'$.target_key'),
        json_extract(value,'$.price_amount') FROM json_each(?)`,
      targetId,
    ),
  );

  const businessChanges = new Map<string, string | number | null>();
  const setFromSource = (column: string) => {
    const value = context.source[column];
    businessChanges.set(
      column,
      value == null
        ? null
        : typeof value === "number" || typeof value === "string"
          ? value
          : String(value),
    );
  };
  if (context.sections.includes("businessSettings")) {
    for (const column of [
      "tagline",
      "description",
      "phone",
      "address",
      "currency",
      "locale",
      "enable_en",
      "enable_zh",
      "business_hours_json",
      "contact_numbers_json",
      "email",
      "website_url",
      "social_links_json",
      "map_url",
      "map_label",
      "wifi_ssid",
      "wifi_password",
      "wifi_security",
      "show_header_location",
      "show_header_phones",
      "show_header_wifi",
      "show_header_socials",
      "show_header_tagline",
      "show_business_hours",
      "locations_json",
      "secondary_currency",
      "secondary_exchange_rate",
      "show_secondary_currency",
      "enable_add_to_order",
      "timezone",
      "pricing_mode",
    ])
      setFromSource(column);
    const sourceLogoId = String(context.source.logo_media_id || "");
    const logo = sourceLogoId ? mediaMap.get(sourceLogoId) : undefined;
    businessChanges.set("logo_media_id", logo?.id || null);
    businessChanges.set(
      "logo_url",
      logo?.url || String(context.source.logo_url || "") || null,
    );
  }
  if (context.sections.includes("pricing")) {
    for (const column of [
      "currency",
      "secondary_currency",
      "secondary_exchange_rate",
      "show_secondary_currency",
      "timezone",
      "pricing_mode",
    ])
      setFromSource(column);
    const sourceDefaultId = String(context.source.default_price_list_id || "");
    const mappedDefault =
      priceListIds.get(sourceDefaultId) ||
      mappedPriceLists.find((list) => Number(list.is_normal) === 1)?.id;
    if (!mappedDefault) {
      await discardStagedMedia(env, stagedKeys);
      throw new CloneDataError(
        "The source business does not have a usable normal price list",
        409,
        "SOURCE_PRICING_INVALID",
      );
    }
    businessChanges.set("default_price_list_id", String(mappedDefault));
  }
  if (context.sections.includes("theme")) {
    const theme = parsedJsonObject(context.source.menu_theme_json);
    for (const { mediaId, url } of menuThemeImageFields) {
      const sourceId = String(theme[mediaId] || "");
      if (!sourceId) continue;
      const image = mediaMap.get(sourceId);
      theme[mediaId] = image?.id || "";
      theme[url] = image?.url || "";
    }
    businessChanges.set("menu_theme_json", JSON.stringify(theme));
    setFromSource("theme_color");
  }
  const assignments = [...businessChanges.keys()].map(
    (column) => `${column}=?`,
  );
  const values = [...businessChanges.values()];
  assignments.push(
    "menu_cache_version=menu_cache_version+1",
    "updated_at=CURRENT_TIMESTAMP",
  );
  statements.push(
    env.DB.prepare(
      `UPDATE businesses SET ${assignments.join(",")} WHERE id=?`,
    ).bind(...values, targetId),
  );
  const auditId = id("aud");
  statements.push(
    env.DB.prepare(
      `INSERT INTO super_admin_audit_log
       (id,actor_email,action,business_id,user_id,details_json)
       VALUES (?,?,'business.data_cloned',?,NULL,?)`,
    ).bind(
      auditId,
      actorEmail,
      targetId,
      JSON.stringify({
        sourceBusinessId: String(context.source.id),
        sourceBusinessName: String(context.source.name),
        targetBusinessName: String(context.target.name),
        sections: context.sections,
        copied: {
          categories: mappedCategories.length,
          products: mappedProducts.length,
          priceLists: mappedPriceLists.length,
          productPrices: mappedProductPrices.length,
          media: mappedMedia.length,
        },
      }),
    ),
  );
  try {
    await env.DB.batch(statements);
  } catch (error) {
    await discardStagedMedia(env, stagedKeys);
    throw error;
  }
  return {
    auditId,
    sourceBusinessId: String(context.source.id),
    targetBusinessId: targetId,
    effectiveSections: context.sections,
    copied: {
      categories: mappedCategories.length,
      products: mappedProducts.length,
      priceLists: mappedPriceLists.length,
      productPrices: mappedProductPrices.length,
      media: mappedMedia.length,
    },
  };
}

export class SuperAdminService extends WorkerEntrypoint<Env> {
  async listSubscriptionPlans(actorEmail: string): Promise<RpcResult<unknown>> {
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    type PlanRow = PlanOfferRow & {
      displayOrder: number; isPublic: number; isActive: number; assignedBusinesses: number;
    };
    const { results } = await this.env.DB.prepare(
      `SELECT ${planOfferFields},plan.display_order AS displayOrder,
         plan.is_public AS isPublic,plan.is_active AS isActive,
         (SELECT COUNT(*) FROM business_subscriptions WHERE plan_id=plan.id) AS assignedBusinesses
       FROM subscription_plans plan ${planOfferJoin}
       ORDER BY plan.display_order,plan.name,plan.id`,
    ).all<PlanRow>();
    const plans: ManagedPlan[] = results.map(row => ({
      ...serializePlan(row), isPublic: Boolean(row.isPublic), isActive: Boolean(row.isActive),
    }));
    return rpcSuccess({ plans });
  }

  async saveSubscriptionPlan(actorEmail: string, planId: string | null, input: Json): Promise<RpcResult<unknown>> {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor)) return rpcFailure(403, "Super-admin identity is invalid");
    const { name, description, displayOrder, isPublic, isActive, features, amountMinor, billingInterval } = input;
    if (typeof name !== "string" || !name.trim() || name.trim().length > 80 ||
        typeof description !== "string" || description.length > 500 ||
        typeof displayOrder !== "number" || !Number.isSafeInteger(displayOrder) || displayOrder < 0 ||
        typeof isPublic !== "boolean" || typeof isActive !== "boolean")
      return rpcFailure(400, "Enter valid plan details");
    if (!Array.isArray(features) || controlPageIds.filter(page => features.includes(page)).length !== features.length)
      return rpcFailure(400, "Select valid Control features");
    if (typeof amountMinor !== "number" || !Number.isSafeInteger(amountMinor) || amountMinor < 0 ||
        (billingInterval !== "month" && billingInterval !== "year"))
      return rpcFailure(400, "Enter a valid USD price and billing period");
    if (!isActive && (isPublic || planId === DEFAULT_PLAN_ID))
      return rpcFailure(400, "Only active plans can be public and Standard must stay active");
    const limits = input.limits === undefined ? null : parsePlanLimits(input.limits);
    if (input.limits !== undefined && !limits)
      return rpcFailure(400, "Enter valid whole-number plan limits or leave them blank");
    const pos = input.pos === undefined ? null : parsePlanPos(input.pos);
    if (input.pos !== undefined && !pos)
      return rpcFailure(400, "Choose whether to include POS and enter whole-number POS limits or leave them blank");

    const db = this.env.DB;
    const recordId = planId ?? id("plan");
    const planValues = [
      name.trim(), description.trim(), JSON.stringify(features), Number(isActive), Number(isPublic), displayOrder,
    ];
    const interval = amountMinor === 0 ? "month" : billingInterval;
    const priceId = id("price");
    const limitValues = limits
      ? [limits.branches, limits.menus, limits.products, limits.dailyOrders]
      : [null, null, null, null];
    const limitUpdate = limits ? ",max_branches=?,max_menus=?,max_products=?,max_daily_orders=?" : "";
    const posValues = pos ? [Number(pos.enabled), pos.profiles, pos.dailySales] : [0, null, null];
    const posUpdate = pos ? ",pos_enabled=?,max_pos_profiles=?,max_daily_pos_sales=?" : "";
    const planStatement = planId
      ? db.prepare(`UPDATE subscription_plans SET name=?,description=?,features_json=?,
          is_active=?,is_public=?,display_order=?,updated_at=CURRENT_TIMESTAMP${limitUpdate}${posUpdate} WHERE id=?`)
        .bind(...planValues, ...(limits ? limitValues : []), ...(pos ? posValues : []), recordId)
      : db.prepare(`INSERT INTO subscription_plans
          (id,code,name,description,features_json,is_active,is_public,display_order,
           max_branches,max_menus,max_products,max_daily_orders,pos_enabled,max_pos_profiles,max_daily_pos_sales)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(recordId, recordSlug(name, "plan", recordId), ...planValues, ...limitValues, ...posValues);
    const writes = [
      planStatement,
      db.prepare(`UPDATE subscription_plan_prices SET is_active=0,updated_at=CURRENT_TIMESTAMP
        WHERE plan_id=? AND is_active=1 AND currency='USD' AND provider IS NULL AND interval_count=1
          AND (amount_minor<>? OR billing_interval<>?)`).bind(recordId, amountMinor, interval),
      db.prepare(`INSERT INTO subscription_plan_prices
        (id,plan_id,code,currency,amount_minor,billing_interval)
        SELECT ?,plan.id,?,'USD',?,? FROM subscription_plans plan WHERE plan.id=?
          AND NOT EXISTS (SELECT 1 FROM subscription_plan_prices
            WHERE plan_id=plan.id AND is_active=1 AND currency='USD' AND provider IS NULL AND interval_count=1)`)
        .bind(priceId, priceId, amountMinor, interval, recordId),
      auditStatement(this.env, actor, planId ? "subscription.plan_updated" : "subscription.plan_created", null, null,
        { planId: recordId, name: name.trim(), isPublic, isActive, features, amountMinor, billingInterval: interval,
          ...(limits ? { limits } : {}), ...(pos ? { pos } : {}) }),
    ];
    try {
      const [planWrite] = await db.batch(writes);
      if (!planWrite.meta.changes) return rpcFailure(404, "Plan not found");
    } catch (error) {
      const limit = planLimitError(error);
      if (limit) return rpcFailure(409, limit.error, limit.code);
      throw error;
    }
    return rpcSuccess({ id: recordId });
  }

  async removeSubscriptionPlan(actorEmail: string, planId: string): Promise<RpcResult<unknown>> {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor)) return rpcFailure(403, "Super-admin identity is invalid");
    if (planId === DEFAULT_PLAN_ID) return rpcFailure(400, "Standard cannot be deleted or archived");
    const db = this.env.DB;
    const [archive, deletion] = await db.batch([
      db.prepare(`UPDATE subscription_plans SET is_active=0,is_public=0,updated_at=CURRENT_TIMESTAMP
        WHERE id=? AND EXISTS (SELECT 1 FROM business_subscriptions WHERE plan_id=?)`).bind(planId, planId),
      db.prepare(`DELETE FROM subscription_plans
        WHERE id=? AND NOT EXISTS (SELECT 1 FROM business_subscriptions WHERE plan_id=?)`).bind(planId, planId),
      auditStatement(this.env, actor, "subscription.plan_removed", null, null, { planId }),
    ]);
    if (!archive.meta.changes && !deletion.meta.changes) return rpcFailure(404, "Plan not found");
    return rpcSuccess({ archived: Boolean(archive.meta.changes) });
  }

  async assignSubscriptionPlan(actorEmail: string, businessId: string, input: Json): Promise<RpcResult<unknown>> {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor)) return rpcFailure(403, "Super-admin identity is invalid");
    if (typeof input.planId !== "string" || typeof input.priceId !== "string")
      return rpcFailure(400, "Choose a plan and price");
    const db = this.env.DB;
    const business = await db.prepare("SELECT id FROM businesses WHERE id=?").bind(businessId).first();
    if (!business) return rpcFailure(404, "Business not found");
    const plan = await registrationPlan(db, input, false);
    if (!plan) return rpcFailure(409, "Choose a currently available plan", "PLAN_UNAVAILABLE");
    try {
      await db.batch([
        db.prepare(`INSERT INTO business_subscriptions (id,business_id,plan_id,price_id,source,status)
          VALUES (?,?,(SELECT plan.id FROM subscription_plans plan ${planOfferJoin}
            WHERE plan.id=? AND price.id=? AND plan.is_active=1),?,'manual','active')
          ON CONFLICT(business_id) DO UPDATE SET plan_id=excluded.plan_id,price_id=excluded.price_id,
            updated_at=CURRENT_TIMESTAMP`).bind(id("sub"), businessId, plan.id, plan.priceId, plan.priceId),
        auditStatement(this.env, actor, "subscription.plan_assigned", businessId, null,
          { planId: plan.id, priceId: plan.priceId }),
      ]);
    } catch (error) {
      if (planChangedDuringSignup(error)) return rpcFailure(409, "Choose a currently available plan", "PLAN_UNAVAILABLE");
      const limit = planLimitError(error);
      if (limit) return rpcFailure(409, limit.error, limit.code);
      throw error;
    }
    return rpcSuccess({ planId: plan.id });
  }

  async businessBranches(actorEmail: string, businessId: string, branchId: string | null, input: Json | null): Promise<RpcResult<unknown>> {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor)) return rpcFailure(403,"Super-admin identity is invalid");
    const db = this.env.DB;
    const business = await db.prepare("SELECT latitude,longitude FROM businesses WHERE id=?")
      .bind(businessId).first<{ latitude: number | null; longitude: number | null }>();
    if (!business)
      return rpcFailure(404,"Business not found");
    if (!input) return rpcSuccess({ branches: (await listBranches(db,businessId)).results });
    const existing = branchId ? await db.prepare(`SELECT id,slug,name,address,phone,map_url AS mapUrl,
      ${branchOrderOverrides.latitude} AS latitude,${branchOrderOverrides.longitude} AS longitude,
      enable_submit_order AS enableSubmitOrder,
      ${branchOrderOverrides.radius} AS orderRadiusMeters,
      is_default AS isDefault,is_active AS isActive
      FROM branches branch WHERE business_id=? AND id=?`).bind(businessId,branchId).first<Branch>() : null;
    if (branchId && !existing) return rpcFailure(404,"Branch not found");
    const name = String(input.name ?? existing?.name ?? "").trim().slice(0,160);
    const slug = String(input.slug ?? "").trim();
    const active = input.isActive ?? existing?.isActive ?? 1;
    const isActive = active === false || active === 0 ? 0 : 1;
    if (!name || (!branchId && (slug.length > 80 || !BUSINESS_SLUG_PATTERN.test(slug))))
      return rpcFailure(400,"Enter a branch name and a valid slug");
    if (existing?.isDefault && !isActive) return rpcFailure(400,"The default branch must stay active");
    const branchAddress = String(input.address ?? existing?.address ?? "").trim().slice(0,500);
    const phone = String(input.phone ?? existing?.phone ?? "").trim().slice(0,80);
    const mapUrl = input.mapUrl === undefined ? existing?.mapUrl ?? "" : safeHttpUrl(input.mapUrl);
    const latitude = input.latitude === undefined ? existing?.latitude ?? null : input.latitude;
    const longitude = input.longitude === undefined ? existing?.longitude ?? null : input.longitude;
    const radius = input.orderRadiusMeters === undefined ? existing?.orderRadiusMeters ?? null : input.orderRadiusMeters;
    const enabled = input.enableSubmitOrder === undefined
      ? existing?.enableSubmitOrder == null ? null : Boolean(existing.enableSubmitOrder)
      : input.enableSubmitOrder;
    if ((latitude === null) !== (longitude === null) ||
      (latitude !== null && !validCoordinate(latitude, 90)) ||
      (longitude !== null && !validCoordinate(longitude, 180)))
      return rpcFailure(400, "Enter both valid coordinates or leave both blank");
    if (radius !== null && (typeof radius !== "number" || !Number.isSafeInteger(radius) || radius < 1))
      return rpcFailure(400, "Enter a positive whole ordering radius or leave it blank");
    if (enabled !== null && typeof enabled !== "boolean")
      return rpcFailure(400, "Choose whether to inherit, enable, or disable order submission");
    if (enabled && (!validCoordinate(latitude ?? business.latitude, 90) ||
      !validCoordinate(longitude ?? business.longitude, 180)))
      return rpcFailure(400, "Set the branch or business location before enabling order submission");
    if (!existing?.isDefault && input.mapUrl && !mapUrl) return rpcFailure(400,"Enter a valid map URL");
    const recordId = branchId ?? id("br");
    const policy = [latitude, longitude, Number(latitude !== null),
      enabled === null ? null : Number(enabled), radius ?? 100, Number(radius === null)];
    const updatePolicy = `latitude=COALESCE(?,latitude),longitude=COALESCE(?,longitude),
      has_order_location_override=?,enable_submit_order=?,order_radius_meters=?,use_business_order_radius=?`;
    const profile = [branchAddress, phone, mapUrl ?? "", isActive];
    const write = existing?.isDefault
      ? db.prepare(`UPDATE branches SET name=?,${updatePolicy}
          WHERE business_id=? AND id=?`).bind(name,...policy,businessId,recordId)
      : branchId
        ? db.prepare(`UPDATE branches SET name=?,address=?,phone=?,map_url=?,is_active=?,${updatePolicy}
            WHERE business_id=? AND id=?`).bind(name,...profile,...policy,businessId,recordId)
        : db.prepare(`INSERT INTO branches (id,business_id,slug,name,address,phone,map_url,is_active,
            latitude,longitude,has_order_location_override,enable_submit_order,order_radius_meters,use_business_order_radius)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(recordId,businessId,slug,name,...profile,...policy);
    try {
      await db.batch([
        write,
        publicMenuVersionStatement(db,businessId),
        auditStatement(this.env,actor,branchId ? "branch.updated" : "branch.created",businessId,null,{ branchId: recordId,name,isActive }),
      ]);
    } catch (error) {
      if (String(error).includes("UNIQUE constraint failed: branches.business_id, branches.slug"))
        return rpcFailure(409,"This branch slug is already in use");
      if (String(error).includes("POS_BRANCH_HAS_ACTIVITY"))
        return rpcFailure(409,"Resolve this branch's open POS bills, shifts, and working day before disabling it","POS_BRANCH_HAS_ACTIVITY");
      const limit = planLimitError(error);
      if (limit) return rpcFailure(409, limit.error, limit.code);
      throw error;
    }
    return rpcSuccess({ branches: (await listBranches(db,businessId)).results });
  }
  async branchWebhooks(
    actorEmail: string, businessId: string, branchId: string, action: WebhookAdminAction, id: string | null, input: Json,
  ): Promise<RpcResult<unknown>> {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor)) return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId) || !RECORD_ID_PATTERN.test(branchId) ||
      (id !== null && !RECORD_ID_PATTERN.test(id))) return rpcFailure(400, "Invalid webhook scope or ID");
    const result = await manageBranchWebhooks(this.env, actor, businessId, branchId, action, id, input);
    if (result.ok && action === "retry") scheduleBranchWebhooks(this.env, this.ctx, businessId);
    return result;
  }

  async clearWebhookHistory(
    actorEmail: string, businessId: string, branchId: string | null, webhookId: string | null,
  ): Promise<RpcResult<unknown>> {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor)) return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId) || (branchId !== null && !RECORD_ID_PATTERN.test(branchId)) ||
      (webhookId !== null && (branchId === null || !RECORD_ID_PATTERN.test(webhookId))))
      return rpcFailure(400, "Invalid webhook scope or ID");
    return clearWebhookHistory(this.env, actor, businessId, branchId, webhookId);
  }

  async resetData(
    actorEmail: string,
    businessId: string,
    action: "backup" | "delete",
    input: Record<string, unknown>,
  ): Promise<RpcResult<unknown>> {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor)) return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId)) return rpcFailure(400, "Business ID is invalid");
    if ((action !== "backup" && action !== "delete") || !input || typeof input !== "object" || Array.isArray(input))
      return rpcFailure(400, "Expected a valid reset request");
    const result = await resetBusinessData(this.env, actor, businessId, action, input);
    if (result.ok && action === "delete" && input.sendDeletedWebhooks === true)
      scheduleBranchWebhooks(this.env, this.ctx, businessId);
    return result;
  }

  async manageBooking(
    actorEmail: string,
    businessId: string,
    action: "feature" | "settings",
    method: "GET" | "PUT",
    input: Record<string, unknown>,
  ): Promise<RpcResult<unknown>> {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor)) return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId)) return rpcFailure(400, "Business ID is invalid");
    if (!input || typeof input !== "object" || Array.isArray(input))
      return rpcFailure(400, "Expected a valid JSON object");
    return manageBookingSettings(this.env, businessId, action, method, input,
      (event) => auditStatement(this.env, actor, event, businessId, null));
  }

  async manageBusinessPosIntegration(
    actorEmail: string,
    businessId: string,
    method: "GET" | "PUT" | "DELETE",
    input: Record<string, unknown> = {},
  ): Promise<RpcResult<unknown>> {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor))
      return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId))
      return rpcFailure(400, "Business ID is invalid");
    const business = await this.env.DB.prepare(
      "SELECT id FROM businesses WHERE id=?",
    )
      .bind(businessId)
      .first();
    if (!business) return rpcFailure(404, "Business not found");
    const syncUrl = new URL(
      "/api/integrations/pos/sync",
      this.env.PUBLIC_ASSET_BASE,
    ).href;
    if (method === "GET")
      return rpcSuccess({
        integration: await getPosIntegration(this.env, businessId),
        syncUrl,
      });
    if (method === "PUT") {
      if (
        !input ||
        typeof input !== "object" ||
        Array.isArray(input) ||
        Object.keys(input).some((key) => key !== "name")
      )
        return rpcFailure(400, "Provide only an integration name");
      const name = input.name === undefined ? "POS" : input.name;
      if (typeof name !== "string" || !name.trim() || name.trim().length > 120)
        return rpcFailure(
          400,
          "Integration name must be between 1 and 120 characters",
        );
      const result = await issuePosApiKey(
        this.env,
        businessId,
        name.trim(),
        auditStatement(
          this.env,
          actor,
          "pos_integration.key_issued",
          businessId,
          null,
          { name: name.trim() },
        ),
      );
      return rpcSuccess({
        ...result,
        integration: await getPosIntegration(this.env, businessId),
        syncUrl,
      });
    }
    if (method === "DELETE") {
      const result = await revokePosIntegration(
        this.env,
        businessId,
        auditStatement(
          this.env,
          actor,
          "pos_integration.disconnected",
          businessId,
          null,
        ),
      );
      return rpcSuccess({ ...result, integration: null, syncUrl });
    }
    return rpcFailure(405, "Method not allowed");
  }

  async dashboard(actorEmail: string): Promise<RpcResult<unknown>> {
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    const [users, businesses, recent, activity] = await Promise.all([
      this.env.DB.prepare("SELECT COUNT(*) AS total FROM users").first<{
        total: number;
      }>(),
      this.env.DB.prepare(
        `SELECT COUNT(*) AS total,
          SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN is_active=0 THEN 1 ELSE 0 END) AS disabled,
          SUM(CASE WHEN bs.status IN ('past_due','canceled') OR
            (bs.current_period_end_at IS NOT NULL
             AND datetime(bs.current_period_end_at)<=datetime('now')) THEN 1 ELSE 0 END) AS expired,
          SUM(CASE WHEN bs.status IN ('trialing','active') AND bs.current_period_end_at IS NOT NULL
            AND datetime(bs.current_period_end_at)>datetime('now')
            AND datetime(bs.current_period_end_at)<=datetime('now','+7 days') THEN 1 ELSE 0 END) AS expiringSoon,
          SUM(CASE WHEN bs.id IS NULL OR
            (bs.status IN ('trialing','active') AND bs.current_period_end_at IS NULL) THEN 1 ELSE 0 END) AS unlimited
         FROM businesses b
         LEFT JOIN business_subscriptions bs ON bs.business_id=b.id`,
      ).first<Record<string, number>>(),
      this.env.DB.prepare(
        `SELECT b.id,b.name,b.slug,b.timezone,b.is_active AS isActive,b.created_at AS createdAt,
          sp.code AS subscriptionPlanCode,sp.name AS subscriptionPlanName,
          bs.source AS subscriptionSource,bs.status AS subscriptionStatus,
          bs.trial_ends_at AS trialEndsAt,bs.current_period_end_at AS currentPeriodEndAt,
          (SELECT u.email FROM memberships m JOIN users u ON u.id=m.user_id
           WHERE m.business_id=b.id AND m.role='owner'
           ORDER BY m.created_at LIMIT 1) AS ownerEmail
         FROM businesses b
         LEFT JOIN business_subscriptions bs ON bs.business_id=b.id
         LEFT JOIN subscription_plans sp ON sp.id=bs.plan_id
         ORDER BY b.created_at DESC LIMIT 6`,
      ).all(),
      this.env.DB.prepare(
        `SELECT id,actor_email AS actorEmail,action,business_id AS businessId,
          user_id AS userId,details_json AS detailsJson,created_at AS createdAt
         FROM super_admin_audit_log ORDER BY created_at DESC LIMIT 10`,
      ).all(),
    ]);
    return rpcSuccess({
      totals: {
        users: Number(users?.total || 0),
        businesses: Number(businesses?.total || 0),
        active: Number(businesses?.active || 0),
        disabled: Number(businesses?.disabled || 0),
        expired: Number(businesses?.expired || 0),
        expiringSoon: Number(businesses?.expiringSoon || 0),
        unlimited: Number(businesses?.unlimited || 0),
      },
      recentBusinesses: recent.results.map((row) =>
        withSubscription(row as Record<string, unknown>),
      ),
      recentActivity: activity.results.map((entry) => {
        const { detailsJson, ...item } = entry as Record<string, unknown>;
        let details: Record<string, unknown> = {};
        try {
          details = JSON.parse(String(detailsJson || "{}"));
        } catch {
          // Preserve an empty metadata object for malformed legacy rows.
        }
        return { ...item, details };
      }),
    });
  }

  async listBusinesses(
    actorEmail: string,
    input: {
      q?: string;
      status?: string;
      subscriptionStatus?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<RpcResult<unknown>> {
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    const query = String(input.q || "")
      .trim()
      .slice(0, 100);
    const status = ["active", "disabled"].includes(String(input.status))
      ? String(input.status)
      : "all";
    const subscriptionStatus = [
      "current",
      "expiring",
      "expired",
      "unlimited",
    ].includes(String(input.subscriptionStatus))
      ? String(input.subscriptionStatus)
      : "all";
    const page = Math.max(1, Math.floor(Number(input.page) || 1));
    const pageSize = Math.min(
      100,
      Math.max(1, Math.floor(Number(input.pageSize) || 25)),
    );
    const clauses: string[] = [];
    const bindings: Array<string | number> = [];
    if (query) {
      clauses.push(
        `(b.name LIKE ? OR b.slug LIKE ? OR EXISTS (
          SELECT 1 FROM memberships sm JOIN users su ON su.id=sm.user_id
          WHERE sm.business_id=b.id AND su.email LIKE ?))`,
      );
      const like = `%${query}%`;
      bindings.push(like, like, like);
    }
    if (status !== "all") {
      clauses.push("b.is_active=?");
      bindings.push(status === "active" ? 1 : 0);
    }
    if (subscriptionStatus === "current")
      clauses.push(
        `(bs.id IS NULL OR (bs.status IN ('trialing','active') AND
          (bs.current_period_end_at IS NULL OR datetime(bs.current_period_end_at)>datetime('now'))))`,
      );
    if (subscriptionStatus === "expiring")
      clauses.push(
        `bs.status IN ('trialing','active') AND bs.current_period_end_at IS NOT NULL AND
         datetime(bs.current_period_end_at)>datetime('now') AND
         datetime(bs.current_period_end_at)<=datetime('now','+7 days')`,
      );
    if (subscriptionStatus === "expired")
      clauses.push(
        `(bs.status IN ('past_due','canceled') OR
          (bs.current_period_end_at IS NOT NULL AND datetime(bs.current_period_end_at)<=datetime('now')))`,
      );
    if (subscriptionStatus === "unlimited")
      clauses.push(
        `(bs.id IS NULL OR (bs.status IN ('trialing','active') AND bs.current_period_end_at IS NULL))`,
      );
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const total = await this.env.DB.prepare(
      `SELECT COUNT(*) AS total FROM businesses b
       LEFT JOIN business_subscriptions bs ON bs.business_id=b.id ${where}`,
    )
      .bind(...bindings)
      .first<{ total: number }>();
    const rows = await this.env.DB.prepare(
      `SELECT b.id,b.name,b.slug,b.timezone,b.is_active AS isActive,b.created_at AS createdAt,
        b.updated_at AS updatedAt,sp.code AS subscriptionPlanCode,
        sp.name AS subscriptionPlanName,bs.source AS subscriptionSource,
        bs.status AS subscriptionStatus,bs.trial_ends_at AS trialEndsAt,
        bs.current_period_end_at AS currentPeriodEndAt,
        (SELECT u.email FROM memberships m JOIN users u ON u.id=m.user_id
         WHERE m.business_id=b.id AND m.role='owner'
         ORDER BY m.created_at LIMIT 1) AS ownerEmail,
        (SELECT COUNT(*) FROM memberships m WHERE m.business_id=b.id) AS memberCount,
        (SELECT COUNT(*) FROM products p WHERE p.business_id=b.id) AS productCount
       FROM businesses b
       LEFT JOIN business_subscriptions bs ON bs.business_id=b.id
       LEFT JOIN subscription_plans sp ON sp.id=bs.plan_id ${where}
       ORDER BY b.created_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...bindings, pageSize, (page - 1) * pageSize)
      .all();
    return rpcSuccess({
      items: rows.results.map((row) =>
        withSubscription(row as Record<string, unknown>),
      ),
      page,
      pageSize,
      total: Number(total?.total || 0),
      totalPages: Math.max(1, Math.ceil(Number(total?.total || 0) / pageSize)),
    });
  }

  async businessDetail(
    actorEmail: string,
    businessId: string,
  ): Promise<RpcResult<unknown>> {
    if (!RECORD_ID_PATTERN.test(businessId))
      return rpcFailure(400, "Business ID is invalid");
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    const [business, members, counts] = await Promise.all([
      this.env.DB.prepare(
        `SELECT b.id,b.name,b.slug,b.tagline,b.description,b.phone,b.address,
          b.email AS contactEmail,b.website_url AS websiteUrl,
          b.custom_menu_url AS customMenuUrl,b.currency,b.locale,b.timezone,
          b.allow_category_browsing AS allowCategoryBrowsing,
          b.latitude,b.longitude,b.enable_submit_order AS enableSubmitOrder,
          b.order_radius_meters AS orderRadiusMeters,
          b.hourly_device_order_limit AS hourlyDeviceOrderLimit,
          b.disabled_control_pages_json AS disabledControlPagesJson,
          b.subscription_plan_id AS subscriptionPlanId,
          b.is_active AS isActive,b.created_at AS createdAt,b.updated_at AS updatedAt,
          sp.code AS subscriptionPlanCode,sp.name AS subscriptionPlanName,
          bs.source AS subscriptionSource,bs.status AS subscriptionStatus,
          bs.trial_ends_at AS trialEndsAt,bs.current_period_end_at AS currentPeriodEndAt
         FROM businesses b
         LEFT JOIN business_subscriptions bs ON bs.business_id=b.id
         LEFT JOIN subscription_plans sp ON sp.id=bs.plan_id
         WHERE b.id=?`,
      )
        .bind(businessId)
        .first(),
      this.env.DB.prepare(
        `SELECT u.id,u.email,u.display_name AS displayName,m.role,
          u.created_at AS createdAt
         FROM memberships m JOIN users u ON u.id=m.user_id
         WHERE m.business_id=? ORDER BY
          CASE m.role WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END,
          m.created_at`,
      )
        .bind(businessId)
        .all(),
      this.env.DB.prepare(
        `SELECT
          (SELECT COUNT(*) FROM products WHERE business_id=?) AS products,
          (SELECT COUNT(*) FROM categories WHERE business_id=?) AS categories,
          (SELECT COUNT(*) FROM banners WHERE business_id=?) AS banners,
          (SELECT COUNT(*) FROM restaurant_tables WHERE business_id=?) AS tables,
          (SELECT COUNT(*) FROM memberships WHERE business_id=?) AS members`,
      )
        .bind(businessId, businessId, businessId, businessId, businessId)
        .first(),
    ]);
    if (!business) return rpcFailure(404, "Business not found");
    const { disabledControlPagesJson, ...businessDetail } = business;
    return rpcSuccess({
      business: {
        ...withSubscription(businessDetail),
        allowCategoryBrowsing: Boolean(business.allowCategoryBrowsing),
        enableSubmitOrder: Boolean(business.enableSubmitOrder),
        disabledControlPages: jsonArray(disabledControlPagesJson),
      },
      members: members.results,
      counts,
    });
  }

  async previewBusinessClone(
    actorEmail: string,
    targetBusinessId: string,
    input: Record<string, unknown>,
  ): Promise<RpcResult<unknown>> {
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    const sourceBusinessId = String(input.sourceBusinessId || "");
    if (
      !RECORD_ID_PATTERN.test(targetBusinessId) ||
      !RECORD_ID_PATTERN.test(sourceBusinessId)
    )
      return rpcFailure(400, "Source or target business ID is invalid");
    try {
      const context = await prepareCloneContext(
        this.env,
        targetBusinessId,
        sourceBusinessId,
        input.sections,
      );
      return rpcSuccess(clonePreviewPayload(context));
    } catch (error) {
      if (error instanceof CloneDataError)
        return rpcFailure(error.status, error.message, error.code);
      throw error;
    }
  }

  async cloneBusinessData(
    actorEmail: string,
    targetBusinessId: string,
    input: Record<string, unknown>,
  ): Promise<RpcResult<unknown>> {
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    const sourceBusinessId = String(input.sourceBusinessId || "");
    if (
      !RECORD_ID_PATTERN.test(targetBusinessId) ||
      !RECORD_ID_PATTERN.test(sourceBusinessId)
    )
      return rpcFailure(400, "Source or target business ID is invalid");
    try {
      const context = await prepareCloneContext(
        this.env,
        targetBusinessId,
        sourceBusinessId,
        input.sections,
      );
      if (String(input.confirmationName || "") !== String(context.target.name))
        return rpcFailure(
          400,
          "Type the target business name exactly to confirm",
          "CONFIRMATION_MISMATCH",
        );
      return rpcSuccess(
        await executeBusinessClone(
          this.env,
          context,
          normalizedAdminEmail(actorEmail),
        ),
      );
    } catch (error) {
      if (error instanceof CloneDataError)
        return rpcFailure(error.status, error.message, error.code);
      const limit = planLimitError(error);
      if (limit) return rpcFailure(409, limit.error, limit.code);
      throw error;
    }
  }

  async createBusiness(
    actorEmail: string,
    input: Record<string, unknown>,
  ): Promise<RpcResult<unknown>> {
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    const email = normalizedAdminEmail(input.ownerEmail);
    const displayName = String(input.ownerDisplayName || "")
      .trim()
      .slice(0, 120);
    const businessName = String(input.businessName || "")
      .trim()
      .slice(0, 160);
    const businessSlug = String(input.slug || "")
      .trim()
      .toLowerCase();
    const passwordProof = String(input.passwordProof || "").toLowerCase();
    if (
      !validAccountEmail(email) ||
      !displayName ||
      businessName.length < 2 ||
      businessSlug.length < 3 ||
      businessSlug.length > 48 ||
      !BUSINESS_SLUG_PATTERN.test(businessSlug) ||
      input.authVersion !== AUTH_SCHEME ||
      !PASSWORD_PROOF_PATTERN.test(passwordProof)
    )
      return rpcFailure(400, "Please provide valid registration details");
    if (!authConfigured(this.env))
      return rpcFailure(503, "Authentication is not configured");
    const [existingUser, existingBusiness] = await Promise.all([
      this.env.DB.prepare("SELECT id FROM users WHERE email=?")
        .bind(email)
        .first(),
      businessSlugOwner(this.env.DB, businessSlug),
    ]);
    if (existingUser)
      return rpcFailure(409, "Email is already in use", "EMAIL_IN_USE");
    if (existingBusiness)
      return rpcFailure(409, "Menu link is already in use", "SLUG_IN_USE");
    const plan = await registrationPlan(this.env.DB, input, false);
    if (!plan) return rpcFailure(409, "Choose a currently available plan", "PLAN_UNAVAILABLE");
    try {
      const created = await provisionBusiness(this.env, {
        email,
        displayName,
        businessName,
        businessSlug,
        passwordProof,
        plan,
        publicSignup: false,
        actorEmail: normalizedAdminEmail(actorEmail),
      });
      return rpcSuccess(created);
    } catch (error) {
      if (planChangedDuringSignup(error))
        return rpcFailure(409, "Choose a currently available plan", "PLAN_UNAVAILABLE");
      if (businessSlugConflict(error))
        return rpcFailure(409, "Menu link is already in use", "SLUG_IN_USE");
      return rpcFailure(
        409,
        "Email or menu link is already in use",
        "REGISTRATION_CONFLICT",
      );
    }
  }

  async createBusinessMember(
    actorEmail: string,
    businessId: string,
    input: Record<string, unknown>,
  ): Promise<RpcResult<unknown>> {
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId))
      return rpcFailure(400, "Business ID is invalid");

    const email = normalizedAdminEmail(input.email);
    const displayName = String(input.displayName || "")
      .trim()
      .slice(0, 120);
    const passwordProof = String(input.passwordProof || "").toLowerCase();
    if (
      !validAccountEmail(email) ||
      !displayName ||
      input.authVersion !== AUTH_SCHEME ||
      !PASSWORD_PROOF_PATTERN.test(passwordProof)
    )
      return rpcFailure(400, "Please provide valid account details");
    if (!authConfigured(this.env))
      return rpcFailure(503, "Authentication is not configured");

    const [business, existingUser] = await Promise.all([
      this.env.DB.prepare("SELECT id,name FROM businesses WHERE id=?")
        .bind(businessId)
        .first<Record<string, string>>(),
      this.env.DB.prepare("SELECT id FROM users WHERE email=?")
        .bind(email)
        .first(),
    ]);
    if (!business) return rpcFailure(404, "Business not found");
    if (existingUser)
      return rpcFailure(409, "Email is already in use", "EMAIL_IN_USE");

    const userId = id("usr");
    const createdAt = new Date().toISOString();
    const credential = await credentialHash(
      passwordProof,
      this.env.AUTH_PEPPER,
    );
    try {
      await this.env.DB.batch([
        this.env.DB.prepare(
          `INSERT INTO users
            (id,email,display_name,password_hash,password_salt,created_at)
           VALUES (?,?,?,?,?,?)`,
        ).bind(
          userId,
          email,
          displayName,
          credential.hash,
          credential.salt,
          createdAt,
        ),
        this.env.DB.prepare(
          `INSERT INTO memberships
            (user_id,business_id,role,created_at)
           VALUES (?,?,'manager',?)`,
        ).bind(userId, businessId, createdAt),
        auditStatement(
          this.env,
          normalizedAdminEmail(actorEmail),
          "business.member_created",
          businessId,
          userId,
          { businessName: business.name, displayName, email, role: "manager" },
        ),
      ]);
      return rpcSuccess({
        id: userId,
        email,
        displayName,
        role: "manager",
        createdAt,
      });
    } catch {
      return rpcFailure(
        409,
        "Email is already in use",
        "MEMBER_CREATION_CONFLICT",
      );
    }
  }

  async setBusinessStatus(
    actorEmail: string,
    businessId: string,
    isActive: boolean,
  ): Promise<RpcResult<unknown>> {
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId))
      return rpcFailure(400, "Business ID is invalid");
    const business = await this.env.DB.prepare(
      "SELECT id,name,is_active AS isActive FROM businesses WHERE id=?",
    )
      .bind(businessId)
      .first<Record<string, unknown>>();
    if (!business) return rpcFailure(404, "Business not found");
    await this.env.DB.batch([
      this.env.DB.prepare(
        `UPDATE businesses SET is_active=?,menu_cache_version=menu_cache_version+1,
          updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      ).bind(isActive ? 1 : 0, businessId),
      ...(!isActive
        ? [
            this.env.DB.prepare(
              `DELETE FROM sessions WHERE business_id=? OR user_id IN
                (SELECT user_id FROM memberships WHERE business_id=?)`,
            ).bind(businessId, businessId),
          ]
        : []),
      auditStatement(
        this.env,
        normalizedAdminEmail(actorEmail),
        isActive ? "business.enabled" : "business.disabled",
        businessId,
        null,
        { businessName: business.name },
      ),
    ]);
    return rpcSuccess({ id: businessId, isActive });
  }

  async updateBusinessSubscription(
    actorEmail: string,
    businessId: string,
    input: Record<string, unknown>,
  ): Promise<RpcResult<unknown>> {
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId))
      return rpcFailure(400, "Business ID is invalid");
    if (!(input.expiresOn === null || typeof input.expiresOn === "string"))
      return rpcFailure(400, "expiresOn must be a date or null");

    const business = await this.env.DB.prepare(
      `SELECT b.id,b.name,b.timezone,sp.code AS subscriptionPlanCode,
        sp.name AS subscriptionPlanName,bs.source AS subscriptionSource,
        bs.status AS subscriptionStatus,bs.trial_ends_at AS trialEndsAt,
        bs.current_period_end_at AS currentPeriodEndAt
       FROM businesses b
       LEFT JOIN business_subscriptions bs ON bs.business_id=b.id
       LEFT JOIN subscription_plans sp ON sp.id=bs.plan_id
       WHERE b.id=?`,
    )
      .bind(businessId)
      .first<Record<string, unknown>>();
    if (!business) return rpcFailure(404, "Business not found");

    const expiresOn = input.expiresOn as string | null;
    const periodEnd = expiresOn
      ? endOfLocalDateUtc(expiresOn, String(business.timezone || "UTC"))
      : null;
    if (expiresOn && !periodEnd)
      return rpcFailure(400, "Expiry date or business timezone is invalid");

    const previous = subscriptionSummary(
      business as SubscriptionRow,
      String(business.timezone || "UTC"),
    );
    const now = new Date().toISOString();
    await this.env.DB.batch([
      this.env.DB.prepare(
        `INSERT INTO business_subscriptions
          (id,business_id,plan_id,price_id,source,status,trial_ends_at,
           current_period_start_at,current_period_end_at,created_at,updated_at)
         VALUES (?,?,?,(SELECT price.id FROM subscription_plans plan ${planOfferJoin} WHERE plan.id=?),
           ?,'active',NULL,?,?,?,?)
         ON CONFLICT(business_id) DO UPDATE SET
           source='manual',status='active',trial_ends_at=NULL,
           current_period_end_at=excluded.current_period_end_at,
           cancel_at_period_end=0,provider=NULL,provider_customer_id=NULL,
           provider_subscription_id=NULL,updated_at=excluded.updated_at`,
      ).bind(
        id("sub"),
        businessId,
        DEFAULT_PLAN_ID,
        DEFAULT_PLAN_ID,
        "manual",
        now,
        periodEnd,
        now,
        now,
      ),
      auditStatement(
        this.env,
        normalizedAdminEmail(actorEmail),
        "subscription.expiry_updated",
        businessId,
        null,
        {
          businessName: business.name,
          previousExpiresOn: previous.expiresOn,
          expiresOn,
        },
      ),
    ]);

    return rpcSuccess(
      subscriptionSummary(
        {
          subscriptionPlanCode: String(
            business.subscriptionPlanCode || "standard",
          ),
          subscriptionPlanName: String(
            business.subscriptionPlanName || "Standard",
          ),
          subscriptionSource: "manual",
          subscriptionStatus: "active",
          trialEndsAt: null,
          currentPeriodEndAt: periodEnd,
        },
        String(business.timezone || "UTC"),
      ),
    );
  }

  async updateBusinessControlPages(
    actorEmail: string,
    businessId: string,
    input: Record<string, unknown>,
  ): Promise<RpcResult<unknown>> {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor))
      return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId))
      return rpcFailure(400, "Business ID is invalid");

    const requested = input.disabledControlPages;
    if (!Array.isArray(requested) || requested.length > controlPageIds.length)
      return rpcFailure(400, "Provide a list of disabled Control pages");
    const disabledControlPages = controlPageIds.filter((page) =>
      requested.includes(page),
    );
    if (disabledControlPages.length !== requested.length)
      return rpcFailure(
        400,
        "The list contains an unknown or duplicate Control page",
      );

    const business = await this.env.DB.prepare(
      "SELECT id FROM businesses WHERE id=?",
    )
      .bind(businessId)
      .first();
    if (!business) return rpcFailure(404, "Business not found");

    const settings = { disabledControlPages };
    await this.env.DB.batch([
      this.env.DB.prepare(
        `UPDATE businesses SET disabled_control_pages_json=?,updated_at=CURRENT_TIMESTAMP
         WHERE id=?`,
      ).bind(JSON.stringify(disabledControlPages), businessId),
      auditStatement(
        this.env,
        actor,
        "business.control_pages_updated",
        businessId,
        null,
        settings,
      ),
    ]);
    return rpcSuccess(settings);
  }

  async updateBusinessOrderingSettings(
    actorEmail: string,
    businessId: string,
    input: Record<string, unknown>,
  ): Promise<RpcResult<unknown>> {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor))
      return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId))
      return rpcFailure(400, "Business ID is invalid");
    const {
      latitude,
      longitude,
      enableSubmitOrder,
      orderRadiusMeters,
      hourlyDeviceOrderLimit,
    } = input;
    if (latitude !== null && !validCoordinate(latitude, 90))
      return rpcFailure(400, "Latitude must be between -90 and 90");
    if (longitude !== null && !validCoordinate(longitude, 180))
      return rpcFailure(400, "Longitude must be between -180 and 180");
    if (typeof enableSubmitOrder !== "boolean")
      return rpcFailure(400, "Select whether order submission is enabled");
    if (
      (latitude === null) !== (longitude === null) ||
      (enableSubmitOrder && latitude === null)
    )
      return rpcFailure(
        400,
        "Enter both latitude and longitude to set the business location",
      );
    if (
      typeof orderRadiusMeters !== "number" ||
      !Number.isSafeInteger(orderRadiusMeters) ||
      orderRadiusMeters < 1
    )
      return rpcFailure(
        400,
        "Order radius must be a positive whole number of meters",
      );
    if (
      hourlyDeviceOrderLimit !== undefined &&
      (typeof hourlyDeviceOrderLimit !== "number" ||
        !Number.isInteger(hourlyDeviceOrderLimit) ||
        hourlyDeviceOrderLimit < 0 ||
        hourlyDeviceOrderLimit > 999)
    )
      return rpcFailure(
        400,
        "Hourly QR order limit per device must be a whole number from 0 to 999",
      );

    const business = await this.env.DB.prepare(
      "SELECT id FROM businesses WHERE id=?",
    )
      .bind(businessId)
      .first();
    if (!business) return rpcFailure(404, "Business not found");

    const settings = {
      latitude,
      longitude,
      enableSubmitOrder,
      orderRadiusMeters,
      hourlyDeviceOrderLimit,
    };
    const [update] = await this.env.DB.batch<{ hourlyDeviceOrderLimit: number }>([
      this.env.DB.prepare(
        `UPDATE businesses SET latitude=?,longitude=?,enable_submit_order=?,order_radius_meters=?,
         hourly_device_order_limit=COALESCE(?,hourly_device_order_limit),
         menu_cache_version=menu_cache_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?
         RETURNING hourly_device_order_limit AS hourlyDeviceOrderLimit`,
      ).bind(
        latitude,
        longitude,
        Number(enableSubmitOrder),
        orderRadiusMeters,
        hourlyDeviceOrderLimit ?? null,
        businessId,
      ),
      auditStatement(
        this.env,
        actor,
        "business.ordering_settings_updated",
        businessId,
        null,
        settings,
      ),
    ]);
    return rpcSuccess({ ...settings, ...update.results[0] });
  }

  async renameBusinessSlug(
    actorEmail: string,
    businessId: string,
    input: Record<string, unknown>,
  ): Promise<RpcResult<unknown>> {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor)) return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId)) return rpcFailure(400, "Business ID is invalid");
    const slug = typeof input.slug === "string" ? input.slug.trim().toLowerCase() : "";
    if (slug.length < 3 || slug.length > 48 || !BUSINESS_SLUG_PATTERN.test(slug))
      return rpcFailure(400, "Use 3–48 lowercase letters, numbers, or single hyphens", "INVALID_MENU_SLUG");

    const db = this.env.DB;
    const previous = await db.prepare("SELECT slug FROM businesses WHERE id=?")
      .bind(businessId).first<string>("slug");
    if (previous === null) return rpcFailure(404, "Business not found");
    if (slug === previous) return rpcSuccess({ slug });
    const stale = () => rpcFailure(409, "The menu link changed. Reload this page and try again", "SLUG_CHANGED");
    if (input.previousSlug !== previous) return stale();
    try {
      const [updated] = await db.batch([
        db.prepare(`UPDATE businesses SET slug=?,menu_cache_version=menu_cache_version+1,
          updated_at=CURRENT_TIMESTAMP WHERE id=? AND slug=?`).bind(slug, businessId, previous),
        auditStatement(this.env, actor, "business.slug_updated", businessId, null, { previousSlug: previous, slug }, true),
      ]);
      return updated.meta.changes ? rpcSuccess({ slug }) : stale();
    } catch (error) {
      if (businessSlugConflict(error)) return rpcFailure(409, "Menu link is already in use", "SLUG_IN_USE");
      throw error;
    }
  }

  async updateBusinessMenuBrowsing(
    actorEmail: string,
    businessId: string,
    input: Record<string, unknown>,
  ): Promise<RpcResult<unknown>> {
    const actor = normalizedAdminEmail(actorEmail);
    if (!validAccountEmail(actor)) return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId)) return rpcFailure(400, "Business ID is invalid");
    const { allowCategoryBrowsing } = input;
    if (typeof allowCategoryBrowsing !== "boolean")
      return rpcFailure(400, "Select whether browsing by product category is allowed");
    const db = this.env.DB;
    if (!(await db.prepare("SELECT id FROM businesses WHERE id=?").bind(businessId).first()))
      return rpcFailure(404, "Business not found");

    const settings = { allowCategoryBrowsing };
    await db.batch([
      db.prepare(`UPDATE businesses SET allow_category_browsing=?,
        menu_cache_version=menu_cache_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .bind(Number(allowCategoryBrowsing), businessId),
      auditStatement(this.env, actor, "business.menu_browsing_updated", businessId, null, settings),
    ]);
    return rpcSuccess(settings);
  }

  async updateBusinessCustomMenuUrl(
    actorEmail: string,
    businessId: string,
    input: Record<string, unknown>,
  ): Promise<RpcResult<unknown>> {
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId))
      return rpcFailure(400, "Business ID is invalid");
    const customMenu = customMenuOrigin(input.customMenuUrl);
    if (customMenu === null)
      return rpcFailure(
        400,
        "Custom menu URL must be an HTTPS origin without a path, query, or fragment",
      );
    const business = await this.env.DB.prepare(
      "SELECT id,name FROM businesses WHERE id=?",
    )
      .bind(businessId)
      .first<Record<string, string>>();
    if (!business) return rpcFailure(404, "Business not found");

    try {
      await this.env.DB.batch([
        this.env.DB.prepare(
          `UPDATE businesses SET custom_menu_url=?,custom_menu_hostname=?,
           menu_cache_version=menu_cache_version+1,updated_at=CURRENT_TIMESTAMP
           WHERE id=?`,
        ).bind(customMenu.url, customMenu.hostname, businessId),
        auditStatement(
          this.env,
          normalizedAdminEmail(actorEmail),
          "business.custom_menu_url_updated",
          businessId,
          null,
          {
            businessName: business.name,
            customMenuUrl: customMenu.url,
            customMenuHostname: customMenu.hostname,
          },
        ),
      ]);
    } catch (error) {
      if (String(error).toLowerCase().includes("unique"))
        return rpcFailure(
          409,
          "This custom menu domain is already assigned to another business",
        );
      throw error;
    }
    await invalidatePublicMenu(this.env, businessId);
    return rpcSuccess({
      id: businessId,
      customMenuUrl: customMenu.url,
      customMenuHostname: customMenu.hostname,
    });
  }

  async updateCredentials(
    actorEmail: string,
    userId: string,
    input: Record<string, unknown>,
  ): Promise<RpcResult<unknown>> {
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(userId))
      return rpcFailure(400, "User ID is invalid");
    const newEmail = normalizedAdminEmail(input.email);
    const passwordProof = String(input.passwordProof || "").toLowerCase();
    if (
      !validAccountEmail(newEmail) ||
      input.authVersion !== AUTH_SCHEME ||
      !PASSWORD_PROOF_PATTERN.test(passwordProof)
    )
      return rpcFailure(400, "Please provide valid credential details");
    if (!authConfigured(this.env))
      return rpcFailure(503, "Authentication is not configured");
    const user = await this.env.DB.prepare(
      `SELECT u.id,u.email,m.business_id AS businessId
       FROM users u LEFT JOIN memberships m ON m.user_id=u.id
       WHERE u.id=? ORDER BY m.created_at LIMIT 1`,
    )
      .bind(userId)
      .first<Record<string, string>>();
    if (!user) return rpcFailure(404, "User not found");
    const duplicate = await this.env.DB.prepare(
      "SELECT id FROM users WHERE email=? AND id<>?",
    )
      .bind(newEmail, userId)
      .first();
    if (duplicate)
      return rpcFailure(409, "New email is already in use", "EMAIL_IN_USE");
    const credential = await credentialHash(
      passwordProof,
      this.env.AUTH_PEPPER,
    );
    await this.env.DB.batch([
      this.env.DB.prepare(
        "UPDATE users SET email=?,password_hash=?,password_salt=? WHERE id=?",
      ).bind(newEmail, credential.hash, credential.salt, userId),
      this.env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(userId),
      auditStatement(
        this.env,
        normalizedAdminEmail(actorEmail),
        newEmail === user.email
          ? "user.password_reset"
          : "user.credentials_changed",
        user.businessId || null,
        userId,
        { previousEmail: user.email, email: newEmail },
      ),
    ]);
    return rpcSuccess({
      id: userId,
      email: newEmail,
      emailChanged: newEmail !== user.email,
    });
  }

  async createSupportSession(
    actorEmail: string,
    businessId: string,
  ): Promise<RpcResult<unknown>> {
    if (!validAccountEmail(normalizedAdminEmail(actorEmail)))
      return rpcFailure(403, "Super-admin identity is invalid");
    if (!RECORD_ID_PATTERN.test(businessId))
      return rpcFailure(400, "Business ID is invalid");
    const owner = await this.env.DB.prepare(
      `SELECT u.id AS userId,u.email,b.name AS businessName
       FROM businesses b
       JOIN memberships m ON m.business_id=b.id AND m.role='owner'
       JOIN users u ON u.id=m.user_id
       WHERE b.id=? ORDER BY m.created_at LIMIT 1`,
    )
      .bind(businessId)
      .first<Record<string, string>>();
    if (!owner) return rpcFailure(409, "Business has no owner account");
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll(
      "-",
      "",
    );
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    await this.env.DB.batch([
      this.env.DB.prepare(
        `INSERT INTO sessions
          (id,user_id,token_hash,expires_at,business_id,session_type,actor_email)
         VALUES (?,?,?,?,?,'support',?)`,
      ).bind(
        id("ses"),
        owner.userId,
        await hashToken(token),
        expiresAt,
        businessId,
        normalizedAdminEmail(actorEmail),
      ),
      auditStatement(
        this.env,
        normalizedAdminEmail(actorEmail),
        "support_session.created",
        businessId,
        owner.userId,
        { expiresAt, ownerEmail: owner.email },
      ),
    ]);
    const adminUrl = (
      this.env.ADMIN_APP_URL || "https://angkor-emenu-admin.pages.dev"
    ).replace(/\/$/, "");
    return rpcSuccess({
      expiresAt,
      handoffUrl: `${adminUrl}/#auth=${encodeURIComponent(token)}`,
    });
  }
}

export default {
  async fetch(request: Request, env: Env, execution: ExecutionContext): Promise<Response> {
    try {
      const response = await handle(request, env, execution);
      if (response.status === 101) return response;
      const headers = new Headers(response.headers);
      Object.entries(cors(request, env)).forEach(([key, value]) =>
        headers.set(key, value),
      );
      const path = new URL(request.url).pathname;
      if (
        path.startsWith("/api/admin/") ||
        path.startsWith("/api/auth/") ||
        path.startsWith("/api/integrations/")
      ) {
        headers.set("cache-control", "private, no-store");
      }
      headers.set("x-content-type-options", "nosniff");
      headers.set("referrer-policy", "strict-origin-when-cross-origin");
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      const limit = planLimitError(error);
      if (limit) return json(limit, 409, { ...cors(request, env), "cache-control": "no-store" });
      const requestId = crypto.randomUUID();
      const details =
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : { message: String(error) };
      console.error("request_failed", {
        requestId,
        method: request.method,
        path: new URL(request.url).pathname,
        ...details,
      });
      const failurePath = new URL(request.url).pathname;
      if (isPosApiPath(failurePath) || isPosAdminPath(failurePath)) return json(
        { error: "Request could not be completed", code: "INTERNAL_ERROR", request_id: requestId },
        500, { ...cors(request, env), "cache-control": "private, no-store" },
      );
      return json(
        { error: "Request could not be completed", requestId },
        500,
        cors(request, env),
      );
    }
  },
  async scheduled(
    controller: ScheduledController,
    env: Env,
    _context: ExecutionContext,
  ) {
    if (controller.cron === "* * * * *") {
      await Promise.all([
        retryTelegramOrders(env), retryBookingAlerts(env), deliverTelegramNotifications(env),
        runBranchWebhookScheduler(env),
      ]);
      return;
    }
    await env.DB.batch([
      env.DB.prepare("DELETE FROM analytics_events WHERE created_at < datetime('now','-13 months')"),
      env.DB.prepare("DELETE FROM telegram_order_deliveries WHERE updated_at < unixepoch() - 604800"),
      env.DB.prepare(`DELETE FROM telegram_notification_deliveries AS delivery WHERE ${telegramDeliveryExpiresAt}<unixepoch()`),
      env.DB.prepare("DELETE FROM pos_sessions WHERE expires_at<=unixepoch()"),
      env.DB.prepare("DELETE FROM pos_login_limits WHERE window_start<unixepoch()-1200"),
    ]);
  },
};
