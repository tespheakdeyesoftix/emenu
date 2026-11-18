export const branchResetOptions = {
  orders: "Orders",
  sales: "POS sales",
  bookings: "Bookings",
  tables: "Tables",
  tableGroups: "Table groups",
  telegramLogs: "Telegram delivery logs",
  analytics: "Menu analytics",
} as const;

export const businessResetOptions = {
  orders: "Orders across all branches",
  sales: "POS sales across all branches",
  products: "Products",
  menus: "Menus",
  categories: "Categories",
  banners: "Promotional banners",
  qrDesigns: "Saved QR designs",
  telegramLogs: "Telegram delivery logs across all branches",
} as const;

export type ResetScope = "branch" | "business";
export type ResetBackup = {
  branch: { id: string; name: string };
  expiresAt: number;
  token: string | null;
  blockers: string[];
  tables: { name: string; columns: string[]; rows: (string | number | null)[][] }[];
};
