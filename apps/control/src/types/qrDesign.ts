import { defaultQrFooterText } from "../../../../shared/qrDesign";

export type QrPresetKey =
  "table-card" | "table-tent" | "acrylic-stand" | "a4-poster";

export type QrTargetType = "menu" | "table";
export type QrFontFamily =
  "Manrope" | "DM Sans" | "Noto Sans Khmer" | "Noto Sans SC";

export type QrDesignConfig = {
  version: 1;
  branchSlug: string;
  menuSlug: string;
  showTableGroup: boolean;
  tablePrefix: string;
  businessNameMode: "profile" | "custom";
  taglineMode: "profile" | "custom";
  customBusinessName: string;
  customTagline: string;
  ctaText: string;
  showFooterText: boolean;
  footerText: string;
  showLogo: boolean;
  showBusinessName: boolean;
  backgroundType: "color" | "image";
  backgroundColor: string;
  backgroundImageUrl: string;
  backgroundPositionX: number;
  backgroundPositionY: number;
  overlayColor: string;
  overlayOpacity: number;
  textColor: string;
  accentColor: string;
  qrDarkColor: string;
  qrLightColor: string;
  fontFamily: QrFontFamily;
  headingSize: number;
  taglineSize: number;
  ctaSize: number;
  logoScale: number;
  qrScale: number;
  qrPositionY: number;
  alignment: "left" | "center" | "right";
  customWidthMm: number;
  customHeightMm: number;
};

export type QrDesign = {
  id: string;
  name: string;
  presetKey: QrPresetKey;
  targetType: QrTargetType;
  config: QrDesignConfig;
  backgroundMediaId: string;
  isDefault: number | boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type TableGroup = {
  id: string;
  branchId: string;
  name: string;
  sortOrder: number;
  isActive: number | boolean;
  tableCount: number;
  activeTableCount: number;
};

export type RestaurantTable = {
  id: string;
  branchId: string;
  groupId: string;
  code: string;
  label: string;
  publicToken: string;
  sortOrder: number;
  isActive: number | boolean;
  groupName: string;
  groupIsActive: number | boolean;
};

export type QrPreset = {
  key: QrPresetKey;
  name: string;
  description: string;
  widthMm: number;
  heightMm: number;
  printableWidthMm: number;
  printableHeightMm: number;
  icon: string;
};

export const qrPresets: QrPreset[] = [
  {
    key: "table-card",
    name: "កាតតុបញ្ឈរ",
    description: "កាតសម្រាប់ដាក់លើតុ ឬជើងដាក់លើបញ្ជរ។",
    widthMm: 100,
    heightMm: 150,
    printableWidthMm: 100,
    printableHeightMm: 150,
    icon: "▯",
  },
  {
    key: "table-tent",
    name: "កាតតុបត់បាន",
    description: "ពីរផ្ទៃលើក្រដាស A4 ផ្ដេក ដែលអាចបត់ចំកណ្ដាល។",
    widthMm: 297,
    heightMm: 210,
    printableWidthMm: 148.5,
    printableHeightMm: 210,
    icon: "△",
  },
  {
    key: "acrylic-stand",
    name: "កាតសម្រាប់ជើងអាគ្រីលិក",
    description: "កាតទំហំ 6 × 14 សម. សម្រាប់ជើងអាគ្រីលិករាង L។",
    widthMm: 60,
    heightMm: 140,
    printableWidthMm: 60,
    printableHeightMm: 140,
    icon: "▯",
  },
  {
    key: "a4-poster",
    name: "បដា A4",
    description: "បដាដែលងាយមើលឃើញ សម្រាប់ជញ្ជាំង បង្អួច និងច្រកចូល។",
    widthMm: 210,
    heightMm: 297,
    printableWidthMm: 210,
    printableHeightMm: 297,
    icon: "▭",
  },
];

export const defaultQrConfig = (): QrDesignConfig => ({
  version: 1,
  branchSlug: "",
  menuSlug: "",
  showTableGroup: true,
  tablePrefix: "",
  businessNameMode: "profile",
  taglineMode: "profile",
  customBusinessName: "",
  customTagline: "",
  ctaText: "ស្កេនដើម្បីមើលម៉ឺនុយរបស់យើង",
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

export function presetFor(key: QrPresetKey) {
  return qrPresets.find((preset) => preset.key === key) || qrPresets[0];
}
