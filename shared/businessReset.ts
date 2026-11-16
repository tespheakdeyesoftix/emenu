export const branchResetOptions = {
  orders: "Orders",
  bookings: "Bookings",
  tables: "Tables",
  tableGroups: "Table groups",
  telegramLogs: "Telegram delivery logs",
  analytics: "Menu analytics",
} as const;

export const businessResetOptions = {
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
