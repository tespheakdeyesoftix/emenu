export const controlPages = {
  overview: { path: "/", label: "Overview" },
  business: { path: "/business", label: "Business information" },
  appearance: { path: "/appearance", label: "Menu appearance" },
  catalog: { path: "/catalog", label: "Product Catalog" },
  menus: { path: "/menus", label: "Menus" },
  priceLists: { path: "/price-lists", label: "Price lists" },
  managePrices: { path: "/manage-prices", label: "Manage prices" },
  sellingOverview: { path: "/selling", label: "Selling dashboard" },
  posProfiles: { path: "/selling/pos-profiles", label: "POS profile settings" },
  posPaymentTypes: { path: "/selling/payment-types", label: "Payment types" },
  salesList: { path: "/selling/sales", label: "Sales list" },
  orders: { path: "/orders", label: "Orders" },
  bookings: { path: "/bookings", label: "Bookings" },
  telegramNotifications: { path: "/telegram-notifications", label: "Telegram notifications" },
  reports: { path: "/reports", label: "Reports" },
  tables: { path: "/tables", label: "Tables" },
  banners: { path: "/banners", label: "Promotional banners" },
  qrDesigns: { path: "/qr-designs", label: "QR designs" },
} as const;

export type ControlPage = keyof typeof controlPages;
export const controlPageIds = Object.keys(controlPages) as ControlPage[];

// These pages use the plan's POS setting instead of its menu feature list.
export const sellingControlPages: readonly ControlPage[] = [
  "sellingOverview", "posProfiles", "posPaymentTypes", "salesList",
];

export const catalogReaderPages: ControlPage[] = [
  "overview", "appearance", "catalog", "managePrices", "banners",
];
export const priceListReaderPages: ControlPage[] = [
  "business", "catalog", "priceLists", "managePrices",
];
