/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Existing tokens, kept.
        primary: "#2E4057", // headings, primary text, dark panels
        accent: "#A8C686", // planned / done / progress -- never "click me"
        textgray: "#4A4A4A", // body text
        sage: "#6C7A61", // secondary green, "in plan" text

        // "Warm index" tokens. `background` (#FAF9F6) is superseded by `paper`
        // -- deliberately not kept alongside it, so the two can't drift.
        paper: "#FBF7EF", // page background
        card: "#FFFFFF", // card surfaces
        cardalt: "#FDFAF5", // inset panel inside a card

        // Terracotta is *the* action colour: one primary action per region.
        terracotta: {
          DEFAULT: "#C0563A", // primary action, active nav underline, step numerals
          tint: "#F6EDE3", // selected row, step bubble, tag chip
          line: "#E7CFBE", // selected-row border, dashed "+ add" borders
        },
        line: {
          DEFAULT: "#EDE4D5", // card borders, header rule
          soft: "#F0E8DA", // inner dividers inside a card
          list: "#F5EFE5", // list-row separators
        },
        field: "#E2DACB", // input / control borders
        muted: {
          DEFAULT: "#9A9385", // secondary text
          2: "#B3A897", // section eyebrows, tertiary text
        },
        placeholder: "#A9A296",
        check: "#D9CFBE", // unchecked checkbox border
        danger: {
          DEFAULT: "#A8422A",
          bg: "#FDF3F0",
          line: "#EBCFC6",
        },
        plan: {
          bg: "#EDF0E6", // "already on your list" panel
          line: "#DCE2CE",
        },
      },
      fontFamily: {
        // Two families only. Never introduce a third.
        sans: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ['"Newsreader"', "ui-serif", "Georgia", "serif"],
      },
      borderRadius: {
        card: "12px",
        tile: "9px",
        pill: "20px",
      },
      boxShadow: {
        // Cards carry a border, not a shadow. Only the phone bottom sheet.
        sheet: "0 -14px 30px -22px rgba(46,64,87,.6)",
        shot: "0 30px 60px -40px rgba(46,64,87,.65)",
      },
    },
  },
  plugins: [],
};
