/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#2E4057",
        accent: "#A8C686",
        background: "#FAF9F6",
        textgray: "#4A4A4A",
        sage: "#6C7A61",
      },
    },
  },
  plugins: [],
};
