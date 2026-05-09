import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1d4ed8",
          strong: "#1e40af",
          soft: "#dbeafe"
        },
        success: "#0f766e",
        warning: "#b45309",
        danger: "#be123c",
        surface: "#ffffff",
        "surface-soft": "#f8fafc",
        background: "#f8fafc",
        text: "#0f172a",
        muted: "#64748b",
        border: "#e2e8f0"
      },
      borderRadius: {
        control: "10px",
        card: "16px"
      },
      boxShadow: {
        card: "0 8px 24px rgba(15, 23, 42, 0.04)",
        elevated: "0 22px 40px rgba(15, 23, 42, 0.08)"
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"]
      }
    }
  },
  plugins: []
} satisfies Config;
