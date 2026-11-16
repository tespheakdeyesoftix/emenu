import { randomUuid } from "./utils/randomUuid";

export type AnalyticsEventType =
  | "menu_open"
  | "product_view"
  | "favourite_add"
  | "favourite_remove"
  | "category_select"
  | "search"
  | "banner_impression"
  | "banner_open"
  | "banner_cta_click"
  | "contact_click"
  | "language_change";

type AnalyticsEvent = {
  id: string;
  type: AnalyticsEventType;
  language: string;
  productId?: string;
  categoryId?: string;
  bannerId?: string;
  searchTerm?: string;
  resultCount?: number;
  actionKind?: "phone" | "email" | "website" | "map" | "social" | "wifi";
};

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";
const SESSION_KEY = "angkor_emenu_analytics_session";
const FLUSH_INTERVAL_MS = 60_000;
type AnalyticsScope = { slug: string; tableToken: string; branch: string | null; menu: string | null };
let scope: AnalyticsScope = { slug: "", tableToken: "", branch: null, menu: null };
let language = "km";
let queue: Array<{ scope: AnalyticsScope; event: AnalyticsEvent }> = [];
let flushTimer = 0;
let flushing = false;
const onceKeys = new Set<string>();

function sessionId() {
  let value = sessionStorage.getItem(SESSION_KEY) || "";
  if (!value) {
    value = randomUuid();
    sessionStorage.setItem(SESSION_KEY, value);
  }
  return value;
}

function endpoint({ slug }: AnalyticsScope) {
  return `${API}/api/public/businesses/${encodeURIComponent(slug)}/analytics/events`;
}

function body({ tableToken, branch }: AnalyticsScope, events: AnalyticsEvent[]) {
  return JSON.stringify({ sessionId: sessionId(), tableToken, branch, events });
}

function nextBatch() {
  const target = queue[0].scope;
  const entries = queue.filter((entry) => entry.scope === target).slice(0,25);
  return { target, entries, events: entries.map(({ event }) => event) };
}

async function flush() {
  window.clearTimeout(flushTimer);
  if (flushing || !queue.length) return;
  flushing = true;
  const { target, entries, events } = nextBatch();
  queue = queue.filter((entry) => !entries.includes(entry));
  try {
    const response = await fetch(endpoint(target), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body(target, events),
      keepalive: true,
    });
    if (!response.ok) throw new Error("Analytics request failed");
  } catch {
    queue = [...queue, ...entries].slice(0, 100);
  } finally {
    flushing = false;
    if (queue.length)
      flushTimer = window.setTimeout(() => void flush(), FLUSH_INTERVAL_MS);
  }
}

function flushOnHide() {
  if (!queue.length || typeof navigator.sendBeacon !== "function")
    return;
  const { target, entries, events } = nextBatch();
  const accepted = navigator.sendBeacon(
    endpoint(target),
    new Blob([body(target, events)], { type: "application/json" }),
  );
  if (accepted) queue = queue.filter((entry) => !entries.includes(entry));
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushOnHide);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushOnHide();
  });
}

export function configureAnalytics(
  businessSlug: string,
  currentTableToken: string,
  currentLanguage: string,
  branch: string | null,
  menu: string | null,
) {
  if (scope.slug !== businessSlug || scope.tableToken !== currentTableToken || scope.branch !== branch || scope.menu !== menu)
    scope = { slug: businessSlug, tableToken: currentTableToken, branch, menu };
  language = currentLanguage;
}

export function setAnalyticsLanguage(value: string) {
  language = value;
}

export function trackAnalytics(
  type: AnalyticsEventType,
  detail: Omit<AnalyticsEvent, "id" | "type" | "language"> = {},
  onceKey = "",
) {
  const scopedOnceKey = onceKey ? JSON.stringify([scope,onceKey]) : "";
  if (!scope.slug || (scopedOnceKey && onceKeys.has(scopedOnceKey))) return;
  if (scopedOnceKey) onceKeys.add(scopedOnceKey);
  queue.push({ scope, event: { id: randomUuid(), type, language, ...detail } });
  if (queue.length >= 10) void flush();
  else {
    window.clearTimeout(flushTimer);
    flushTimer = window.setTimeout(() => void flush(), FLUSH_INTERVAL_MS);
  }
}
