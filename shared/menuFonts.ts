export const menuKhmerFonts = ["Noto Sans Khmer", "Battambang"] as const;
export type MenuKhmerFont = (typeof menuKhmerFonts)[number];
export const defaultMenuKhmerFont = menuKhmerFonts[0];

export function menuKhmerFontFamily(font: MenuKhmerFont) {
  return font === "Battambang" ? '"Battambang", "eMenu Khmer"' : '"eMenu Khmer"';
}
