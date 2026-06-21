import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        indigo: {
          DEFAULT: "#26306B",
        },
        saffron: {
          DEFAULT: "#F2A03D",
        },
        ink: {
          DEFAULT: "#0E1124",
        },
        cream: {
          DEFAULT: "#ECEAE3",
          paper: "#F2EFE7",
        },
        muted: {
          DEFAULT: "#5F6478",
          warm: "#9A8F7A",
          line: "#B7AE99",
        },
      },
      fontFamily: {
        sora: ["var(--font-sora)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
