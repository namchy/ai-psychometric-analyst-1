import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        "surface-tint": "#29667b",
        "outline-variant": "#8bb8d4",
        "inverse-surface": "#00101a",
        "tertiary-container": "#fda18a",
        tertiary: "#934a38",
        "secondary-dim": "#2a5a5f",
        "tertiary-fixed-dim": "#ee947d",
        primary: "#29667b",
        "tertiary-fixed": "#fda18a",
        "primary-dim": "#195a6f",
        "primary-container": "#abe5fe",
        "primary-fixed": "#abe5fe",
        secondary: "#37666b",
        "secondary-fixed": "#c8faff",
        "secondary-fixed-dim": "#baebf0",
        "primary-fixed-dim": "#9dd7f0",
      },
      fontFamily: {
        headline: ["var(--font-sans)"],
        body: ["var(--font-sans)"],
        label: ["var(--font-sans)"],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },
    },
  },
};

export default config;
