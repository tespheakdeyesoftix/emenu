import {
  culturalMenuPatterns,
  type CulturalMenuPatternId,
} from "../../../../shared/menuPatterns";
import { defaultMenuKhmerFont, type MenuKhmerFont } from "../../../../shared/menuFonts";

type EverydayMenuPatternId =
  "dots" | "waves" | "grid" | "khmer-diamond" | "terrazzo" | "paper";

export type MenuTheme = {
  version: 1;
  preset: "warm" | "minimal" | "garden" | "elegant";
  mode: "light" | "dark";
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  businessNameColor: string;
  businessNameFontSize: number;
  menuItemTitleColor: string;
  menuItemTitleFontSize: number;
  categoryTitleColor: string;
  categoryTitleFontSize: number;
  categoryFilterColor: string;
  categoryFilterFontSize: number;
  descriptionColor: string;
  descriptionFontSize: number;
  primaryPriceColor: string;
  primaryPriceFontSize: number;
  secondaryPriceColor: string;
  secondaryPriceFontSize: number;
  headingFont: string;
  bodyFont: string;
  khmerFont: MenuKhmerFont;
  cardStyle: "flat" | "bordered" | "shadow";
  cornerStyle: "square" | "soft" | "rounded";
  imageRatio: "square" | "landscape" | "portrait";
  productPlaceholderMediaId: string;
  productPlaceholderUrl: string;
  defaultProductView: "grid" | "list";
  showItemCode: boolean;
  itemCodeColor: string;
  itemCodeFontSize: number;
  showBottomNav: boolean;
  showSearchNav: boolean;
  bottomNavStyle: "simple" | "modern" | "floating" | "glass";
  bottomNavBackgroundColor: string;
  bottomNavTextColor: string;
  bottomNavActiveColor: string;
  bottomNavFontSize: number;
  headerStyle: "banner" | "solid" | "minimal";
  categoryStyle: "pills" | "underline" | "images";
  backgroundType: "color" | "pattern" | "image";
  backgroundPattern: EverydayMenuPatternId | CulturalMenuPatternId;
  backgroundPatternColor: string;
  backgroundPatternOpacity: number;
  backgroundImageMediaId: string;
  backgroundImageUrl: string;
  backgroundImageFit: "cover" | "tile";
  backgroundImagePositionX: number;
  backgroundImagePositionY: number;
  backgroundOverlayColor: string;
  backgroundOverlayOpacity: number;
};

export const menuBackgroundPatterns: Array<{
  id: MenuTheme["backgroundPattern"];
  name: string;
  nameKm?: string;
  group: "everyday" | "cultural";
  assetUrl?: string;
  tileSize?: number;
}> = [
  { id: "dots", name: "Soft dots", group: "everyday" },
  { id: "waves", name: "Waves", group: "everyday" },
  { id: "grid", name: "Fine grid", group: "everyday" },
  { id: "khmer-diamond", name: "Khmer diamond", group: "everyday" },
  { id: "terrazzo", name: "Terrazzo", group: "everyday" },
  { id: "paper", name: "Paper", group: "everyday" },
  ...culturalMenuPatterns.map((pattern) => ({
    ...pattern,
    group: "cultural" as const,
  })),
];

const backgroundDefaults = {
  backgroundType: "color" as const,
  backgroundPattern: "paper" as const,
  backgroundPatternColor: "#e84231",
  backgroundPatternOpacity: 8,
  backgroundImageMediaId: "",
  backgroundImageUrl: "",
  backgroundImageFit: "cover" as const,
  backgroundImagePositionX: 50,
  backgroundImagePositionY: 50,
  backgroundOverlayColor: "#1b1b19",
  backgroundOverlayOpacity: 20,
};
const productPlaceholderDefaults = {
  productPlaceholderMediaId: "",
  productPlaceholderUrl: "",
};

export const menuThemePresets: Array<{
  id: MenuTheme["preset"];
  name: string;
  description: string;
  theme: MenuTheme;
}> = [
  {
    id: "warm",
    name: "Modern Warm",
    description: "Friendly, polished, and ideal for restaurants.",
    theme: {
      version: 1,
      preset: "warm",
      mode: "light",
      primaryColor: "#e84231",
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
      primaryPriceColor: "#e84231",
      primaryPriceFontSize: 16,
      secondaryPriceColor: "#e84231",
      secondaryPriceFontSize: 12,
      headingFont: "Manrope",
      bodyFont: "DM Sans",
      khmerFont: defaultMenuKhmerFont,
      cardStyle: "shadow",
      cornerStyle: "rounded",
      imageRatio: "landscape",
      defaultProductView: "grid",
      showItemCode: false,
      itemCodeColor: "#8d8d8c",
      itemCodeFontSize: 10,
      showBottomNav: true,
      showSearchNav: true,
      bottomNavStyle: "modern",
      bottomNavBackgroundColor: "#ffffff",
      bottomNavTextColor: "#666660",
      bottomNavActiveColor: "#e84231",
      bottomNavFontSize: 13,
      headerStyle: "banner",
      categoryStyle: "images",
      ...productPlaceholderDefaults,
      ...backgroundDefaults,
      backgroundType: "pattern",
    },
  },
  {
    id: "minimal",
    name: "Clean Minimal",
    description: "Quiet, spacious, and focused on food photography.",
    theme: {
      version: 1,
      preset: "minimal",
      mode: "light",
      primaryColor: "#18181b",
      accentColor: "#d4d4d8",
      backgroundColor: "#f7f7f6",
      surfaceColor: "#ffffff",
      textColor: "#18181b",
      businessNameColor: "#18181b",
      businessNameFontSize: 24,
      menuItemTitleColor: "#18181b",
      menuItemTitleFontSize: 16,
      categoryTitleColor: "#18181b",
      categoryTitleFontSize: 30,
      categoryFilterColor: "#18181b",
      categoryFilterFontSize: 14,
      descriptionColor: "#8c8c8d",
      descriptionFontSize: 14,
      primaryPriceColor: "#18181b",
      primaryPriceFontSize: 16,
      secondaryPriceColor: "#52525b",
      secondaryPriceFontSize: 12,
      headingFont: "DM Sans",
      bodyFont: "DM Sans",
      khmerFont: defaultMenuKhmerFont,
      cardStyle: "bordered",
      cornerStyle: "soft",
      imageRatio: "square",
      defaultProductView: "grid",
      showItemCode: false,
      itemCodeColor: "#8c8c8d",
      itemCodeFontSize: 10,
      showBottomNav: true,
      showSearchNav: true,
      bottomNavStyle: "simple",
      bottomNavBackgroundColor: "#ffffff",
      bottomNavTextColor: "#52525b",
      bottomNavActiveColor: "#18181b",
      bottomNavFontSize: 13,
      headerStyle: "minimal",
      categoryStyle: "underline",
      ...productPlaceholderDefaults,
      ...backgroundDefaults,
      backgroundPatternColor: "#18181b",
      backgroundPatternOpacity: 5,
    },
  },
  {
    id: "garden",
    name: "Fresh Garden",
    description: "Natural greens for cafés and healthy concepts.",
    theme: {
      version: 1,
      preset: "garden",
      mode: "light",
      primaryColor: "#26734d",
      accentColor: "#d7efb2",
      backgroundColor: "#f3f7ef",
      surfaceColor: "#ffffff",
      textColor: "#173328",
      businessNameColor: "#173328",
      businessNameFontSize: 24,
      menuItemTitleColor: "#173328",
      menuItemTitleFontSize: 16,
      categoryTitleColor: "#173328",
      categoryTitleFontSize: 30,
      categoryFilterColor: "#173328",
      categoryFilterFontSize: 14,
      descriptionColor: "#8b9994",
      descriptionFontSize: 14,
      primaryPriceColor: "#26734d",
      primaryPriceFontSize: 16,
      secondaryPriceColor: "#5b8d70",
      secondaryPriceFontSize: 12,
      headingFont: "Manrope",
      bodyFont: "DM Sans",
      khmerFont: defaultMenuKhmerFont,
      cardStyle: "flat",
      cornerStyle: "rounded",
      imageRatio: "portrait",
      defaultProductView: "grid",
      showItemCode: false,
      itemCodeColor: "#8b9994",
      itemCodeFontSize: 10,
      showBottomNav: true,
      showSearchNav: true,
      bottomNavStyle: "floating",
      bottomNavBackgroundColor: "#ffffff",
      bottomNavTextColor: "#557268",
      bottomNavActiveColor: "#26734d",
      bottomNavFontSize: 13,
      headerStyle: "solid",
      categoryStyle: "pills",
      ...productPlaceholderDefaults,
      ...backgroundDefaults,
      backgroundType: "pattern",
      backgroundPattern: "waves",
      backgroundPatternColor: "#26734d",
    },
  },
  {
    id: "elegant",
    name: "Dark Elegant",
    description: "A premium evening theme with warm gold accents.",
    theme: {
      version: 1,
      preset: "elegant",
      mode: "dark",
      primaryColor: "#d5a84b",
      accentColor: "#8f6d2f",
      backgroundColor: "#151515",
      surfaceColor: "#222220",
      textColor: "#f5f1e8",
      businessNameColor: "#f5f1e8",
      businessNameFontSize: 24,
      menuItemTitleColor: "#f5f1e8",
      menuItemTitleFontSize: 16,
      categoryTitleColor: "#f5f1e8",
      categoryTitleFontSize: 30,
      categoryFilterColor: "#f5f1e8",
      categoryFilterFontSize: 14,
      descriptionColor: "#8c8984",
      descriptionFontSize: 14,
      primaryPriceColor: "#d5a84b",
      primaryPriceFontSize: 16,
      secondaryPriceColor: "#c7ad78",
      secondaryPriceFontSize: 12,
      headingFont: "Manrope",
      bodyFont: "DM Sans",
      khmerFont: defaultMenuKhmerFont,
      cardStyle: "bordered",
      cornerStyle: "soft",
      imageRatio: "landscape",
      defaultProductView: "list",
      showItemCode: false,
      itemCodeColor: "#8c8984",
      itemCodeFontSize: 10,
      showBottomNav: true,
      showSearchNav: true,
      bottomNavStyle: "glass",
      bottomNavBackgroundColor: "#222220",
      bottomNavTextColor: "#b8b3aa",
      bottomNavActiveColor: "#d5a84b",
      bottomNavFontSize: 13,
      headerStyle: "solid",
      categoryStyle: "pills",
      ...productPlaceholderDefaults,
      ...backgroundDefaults,
      backgroundType: "pattern",
      backgroundPattern: "khmer-diamond",
      backgroundPatternColor: "#d5a84b",
      backgroundPatternOpacity: 12,
      backgroundOverlayColor: "#151515",
    },
  },
];

export const defaultMenuTheme = (primaryColor = "#e84231"): MenuTheme => ({
  ...menuThemePresets[0].theme,
  primaryColor,
  bottomNavActiveColor: primaryColor,
  primaryPriceColor: primaryColor,
  secondaryPriceColor: primaryColor,
  ...backgroundDefaults,
  backgroundPatternColor: primaryColor,
});

export const cloneMenuTheme = (theme: MenuTheme): MenuTheme => ({
  ...theme,
  khmerFont: theme.khmerFont ?? defaultMenuKhmerFont,
});
