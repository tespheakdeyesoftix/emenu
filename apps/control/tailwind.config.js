export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts}"],
  theme: {
    extend: {
      colors: { ink: "#252a26", mint: "#b7f34a", cream: "#f3f1eb" },
      fontFamily: {
        sans: ['"Noto Sans Khmer"', '"Source Sans 3"', "sans-serif"],
        display: ['"Noto Serif Khmer"', "Newsreader", "serif"],
      },
    },
  },
  plugins: [],
};
