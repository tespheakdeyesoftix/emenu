export default {
  content: ["./index.html", "./src/**/*.{vue,ts}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--menu-font-body)", "sans-serif"],
        display: ["var(--menu-font-heading)", "sans-serif"],
      },
      colors: {
        tomato: "rgb(var(--menu-primary-rgb) / <alpha-value>)",
        ink: "rgb(var(--menu-text-rgb) / <alpha-value>)",
        cream: "rgb(var(--menu-page-rgb) / <alpha-value>)",
        surface: "rgb(var(--menu-surface-rgb) / <alpha-value>)",
        mint: "rgb(var(--menu-accent-rgb) / <alpha-value>)",
        action: "rgb(var(--menu-action-rgb) / <alpha-value>)",
        "on-primary": "rgb(var(--menu-on-primary-rgb) / <alpha-value>)",
        "on-action": "rgb(var(--menu-on-action-rgb) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};
