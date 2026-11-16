/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14231f",
        moss: "#40654d",
        lime: "#b9f56b",
        canvas: "#f3f4ee",
        cream: "#fbf7eb",
        coral: "#ef6a4c",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(20,35,31,.09)",
      },
    },
  },
  plugins: [],
};
