import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        blue: {
          50: "#eff4ff",
          100: "#d9e2ff",
          200: "#c3c7cf",
          300: "#9faad5",
          400: "#7280bd",
          500: "#44549a",
          600: "#2b3a7e",
          700: "#22316f",
          800: "#001945",
          900: "#001438",
          950: "#000d24"
        },
        slate: {
          50: "#eff4ff",
          100: "#e5edff",
          200: "#c3c7cf",
          300: "#a8b1c2",
          400: "#73777f",
          500: "#565e71",
          600: "#43474e",
          700: "#30343b",
          800: "#191c20",
          900: "#12151a",
          950: "#080b10"
        },
        emerald: {
          50: "#e9fbf7",
          100: "#9ef2e2",
          200: "#76dacd",
          300: "#54c7b7",
          400: "#35b2a2",
          500: "#23a18e",
          600: "#168272",
          700: "#0c6659",
          800: "#06483f",
          900: "#00201a",
          950: "#00140f"
        },
        amber: {
          50: "#fff8df",
          100: "#ffefbd",
          200: "#ffe18a",
          300: "#ffd052",
          400: "#f9bd36",
          500: "#f9a825",
          600: "#c98108",
          700: "#9a6000",
          800: "#6c4200",
          900: "#3f2700",
          950: "#261700"
        },
        orange: {
          50: "#fff8df",
          100: "#ffefbd",
          200: "#ffe18a",
          300: "#ffd052",
          400: "#f9bd36",
          500: "#f9a825",
          600: "#c98108",
          700: "#9a6000",
          800: "#6c4200",
          900: "#3f2700",
          950: "#261700"
        },
        rose: {
          50: "#fff1f0",
          100: "#ffdad6",
          200: "#ffb4ab",
          300: "#ff897d",
          400: "#e85b50",
          500: "#d3332c",
          600: "#ba1a1a",
          700: "#93000a",
          800: "#690005",
          900: "#410002",
          950: "#260001"
        },
        brand: {
          DEFAULT: "#2b3a7e",
          strong: "#001945",
          soft: "#d9e2ff"
        },
        secondary: "#23a18e",
        success: "#23a18e",
        warning: "#f9a825",
        danger: "#ba1a1a",
        surface: "#ffffff",
        "surface-dim": "#ccdbf3",
        "surface-bright": "#f8f9ff",
        "surface-soft": "#eff4ff",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#eff4ff",
        "surface-container": "#e5edff",
        "surface-container-high": "#dae4ff",
        "surface-container-highest": "#cfdaff",
        background: "#f8f9ff",
        text: "#191c20",
        muted: "#43474e",
        border: "#c3c7cf",
        outline: "#73777f"
      },
      borderRadius: {
        control: "8px",
        card: "4px"
      },
      boxShadow: {
        card: "0 1px 3px rgba(25, 28, 32, 0.08)",
        elevated: "0 14px 32px rgba(25, 28, 32, 0.12)"
      },
      fontFamily: {
        sans: ["Manrope", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"]
      }
    }
  },
  plugins: []
} satisfies Config;
