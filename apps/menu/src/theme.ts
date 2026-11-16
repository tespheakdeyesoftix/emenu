import {
  getCulturalMenuPattern,
  type CulturalMenuPatternId,
} from "../../../shared/menuPatterns";
import { defaultMenuKhmerFont, type MenuKhmerFont } from "../../../shared/menuFonts";

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

export const defaultMenuTheme = (primaryColor = "#e84231"): MenuTheme => ({
  version: 1,
  preset: "warm",
  mode: "light",
  primaryColor,
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
  primaryPriceColor: primaryColor,
  primaryPriceFontSize: 16,
  secondaryPriceColor: primaryColor,
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
  bottomNavActiveColor: primaryColor,
  bottomNavFontSize: 13,
  headerStyle: "banner",
  categoryStyle: "images",
  backgroundType: "color",
  backgroundPattern: "paper",
  backgroundPatternColor: primaryColor,
  backgroundPatternOpacity: 8,
  backgroundImageMediaId: "",
  backgroundImageUrl: "",
  backgroundImageFit: "cover",
  backgroundImagePositionX: 50,
  backgroundImagePositionY: 50,
  backgroundOverlayColor: "#1b1b19",
  backgroundOverlayOpacity: 20,
});

const rgb = (hex: string) => {
  const value = hex.replace("#", "");
  return [0, 2, 4]
    .map((index) => Number.parseInt(value.slice(index, index + 2), 16))
    .join(" ");
};

const luminance = (hex: string) => {
  const channels = rgb(hex)
    .split(" ")
    .map(Number)
    .map((value) => {
      const channel = value / 255;
      return channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrastRatio = (first: string, second: string) => {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
};

const readableColor = (background: string) =>
  luminance(background) > 0.42 ? "#111111" : "#ffffff";

const controlActiveColor = (theme: MenuTheme) => {
  const brandedCandidates = [
    theme.primaryColor,
    theme.accentColor,
    theme.textColor,
  ];
  return (
    brandedCandidates.find(
      (candidate) => contrastRatio(candidate, theme.surfaceColor) >= 3,
    ) || readableColor(theme.surfaceColor)
  );
};

function fontStack(font: string) {
  const themeFont = font === "System UI" ? "system-ui" : `'${font}'`;
  return `var(--menu-font-khmer), ${themeFont}, sans-serif`;
}

export function menuThemeVariables(theme: MenuTheme) {
  const culturalPattern = getCulturalMenuPattern(theme.backgroundPattern);
  const onPrimary = readableColor(theme.primaryColor);
  const action = theme.mode === "dark" ? theme.primaryColor : theme.textColor;
  const onAction = readableColor(action);
  const onSurface = readableColor(theme.surfaceColor);
  const controlActive = controlActiveColor(theme);
  const onControlActive = readableColor(controlActive);
  const radius =
    theme.cornerStyle === "square"
      ? "0.3rem"
      : theme.cornerStyle === "soft"
        ? "0.9rem"
        : "1.6rem";
  return {
    "--menu-primary-rgb": rgb(theme.primaryColor),
    "--menu-accent-rgb": rgb(theme.accentColor),
    "--menu-page-rgb": rgb(theme.backgroundColor),
    "--menu-pattern-rgb": rgb(theme.backgroundPatternColor),
    "--menu-pattern-opacity": String(theme.backgroundPatternOpacity / 100),
    "--menu-pattern-faint-opacity": String(
      Math.max(0.01, theme.backgroundPatternOpacity / 100 / 1.8),
    ),
    "--menu-pattern-asset": culturalPattern
      ? `url("${culturalPattern.assetUrl}")`
      : "none",
    "--menu-pattern-tile-size": culturalPattern
      ? `${culturalPattern.tileSize}px`
      : "96px",
    "--menu-background-image": theme.backgroundImageUrl
      ? `url("${theme.backgroundImageUrl}")`
      : "none",
    "--menu-background-position": `${theme.backgroundImagePositionX}% ${theme.backgroundImagePositionY}%`,
    "--menu-background-overlay-rgb": rgb(theme.backgroundOverlayColor),
    "--menu-background-overlay-opacity": String(
      theme.backgroundOverlayOpacity / 100,
    ),
    "--menu-surface-rgb": rgb(theme.surfaceColor),
    "--menu-text-rgb": rgb(theme.textColor),
    "--menu-business-name-rgb": rgb(theme.businessNameColor),
    "--menu-business-name-size": `${theme.businessNameFontSize}px`,
    "--menu-item-title-rgb": rgb(theme.menuItemTitleColor),
    "--menu-item-title-size": `${theme.menuItemTitleFontSize}px`,
    "--menu-item-code-rgb": rgb(theme.itemCodeColor),
    "--menu-item-code-size": `${theme.itemCodeFontSize}px`,
    "--menu-category-title-rgb": rgb(theme.categoryTitleColor),
    "--menu-category-title-size": `${theme.categoryTitleFontSize}px`,
    "--menu-category-filter-rgb": rgb(theme.categoryFilterColor),
    "--menu-category-filter-size": `${theme.categoryFilterFontSize}px`,
    "--menu-description-rgb": rgb(theme.descriptionColor),
    "--menu-description-size": `${theme.descriptionFontSize}px`,
    "--menu-price-primary-rgb": rgb(theme.primaryPriceColor),
    "--menu-price-primary-size": `${theme.primaryPriceFontSize}px`,
    "--menu-price-secondary-rgb": rgb(theme.secondaryPriceColor),
    "--menu-price-secondary-size": `${theme.secondaryPriceFontSize}px`,
    "--menu-on-primary-rgb": rgb(onPrimary),
    "--menu-action-rgb": rgb(action),
    "--menu-on-action-rgb": rgb(onAction),
    "--menu-on-surface-rgb": rgb(onSurface),
    "--menu-control-active-rgb": rgb(controlActive),
    "--menu-on-control-active-rgb": rgb(onControlActive),
    "--menu-bottom-nav-bg-rgb": rgb(theme.bottomNavBackgroundColor),
    "--menu-bottom-nav-text-rgb": rgb(theme.bottomNavTextColor),
    "--menu-bottom-nav-active-rgb": rgb(theme.bottomNavActiveColor),
    "--menu-bottom-nav-font-size": `${theme.bottomNavFontSize}px`,
    "--menu-font-heading": fontStack(theme.headingFont),
    "--menu-font-body": fontStack(theme.bodyFont),
    "--menu-card-radius": radius,
    "--menu-control-radius":
      theme.cornerStyle === "square"
        ? "0.25rem"
        : theme.cornerStyle === "soft"
          ? "0.75rem"
          : "999px",
    "--menu-image-ratio":
      theme.imageRatio === "square"
        ? "1 / 1"
        : theme.imageRatio === "portrait"
          ? "4 / 5"
          : "4 / 3",
  } as Record<string, string>;
}
