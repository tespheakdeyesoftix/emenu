import preset, { content } from "frappe-ui/tailwind";
import colors from "tailwindcss/colors";
import defaultTheme from "tailwindcss/defaultTheme";

const {
  black,
  white,
  gray,
  slate,
  zinc,
  red,
  orange,
  amber,
  yellow,
  green,
  emerald,
  teal,
  cyan,
  sky,
  blue,
  indigo,
  violet,
  purple,
  pink,
  rose,
  transparent,
  current,
} = colors;

export default {
  presets: [preset],
  content: [...content, "./index.html", "./src/**/*.{vue,js,ts}"],
  theme: {
    extend: {
      // Keep stock utilities available while existing screens move to Frappe tokens.
      colors: {
        black,
        white,
        gray,
        slate,
        zinc,
        red,
        orange,
        amber,
        yellow,
        green,
        emerald,
        teal,
        cyan,
        sky,
        blue,
        indigo,
        violet,
        purple,
        pink,
        rose,
        transparent,
        current,
        ink: { DEFAULT: "#171717" },
        mint: "#b7f34a",
        cream: "#f4f4f5",
      },
      screens: { "2xl": defaultTheme.screens["2xl"] },
      borderRadius: defaultTheme.borderRadius,
      fontFamily: {
        sans: ["InterVar", '"Noto Sans Khmer"', '"Noto Sans SC"', "sans-serif"],
        display: [
          "InterVar",
          '"Noto Sans Khmer"',
          '"Noto Sans SC"',
          "sans-serif",
        ],
      },
    },
  },
};
