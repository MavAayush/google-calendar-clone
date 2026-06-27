import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      surface: "#FFFFFF",
      "surface-muted": "#F6F7F8",
      border: "#E2E4E8",
      "text-primary": "#1A1D21",
      "text-secondary": "#5F6368",
      accent: "#3B6FE0",
      "accent-soft": "#EAF0FD",
      danger: "#C8442C",
      event: {
        blue: "#8AB4F8",
        teal: "#A8D5BA",
        lavender: "#C5B4F8",
        peach: "#F8C9A8",
        sage: "#B4C8A8",
      },
    },
    spacing: {
      "0": "0px",
      "1": "4px",
      "2": "8px",
      "3": "12px",
      "4": "16px",
      "6": "24px",
      "8": "32px",
      "12": "48px",
      px: "1px",
    },
    borderRadius: {
      none: "0px",
      sm: "4px",
      DEFAULT: "4px",
      md: "8px",
      full: "9999px",
    },
    boxShadow: {
      none: "none",
      sm: "0 1px 2px rgba(0,0,0,0.06)",
    },
    fontSize: {
      xs: ["12px", { lineHeight: "16px" }],
      sm: ["14px", { lineHeight: "20px" }],
      base: ["16px", { lineHeight: "24px" }],
      lg: ["20px", { lineHeight: "28px" }],
      xl: ["24px", { lineHeight: "32px" }],
    },
    fontWeight: {
      normal: "400",
      semibold: "600",
    },
    fontFamily: {
      sans: ["Inter", "system-ui", "sans-serif"],
    },
    extend: {
      transitionDuration: {
        "100": "100ms",
        "120": "120ms",
        "150": "150ms",
      },
    },
  },
  plugins: [],
};

export default config;
