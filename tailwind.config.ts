import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Heebo', 'sans-serif'],
        heebo: ['Heebo', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        surface: {
          elevated: "hsl(var(--surface-elevated))",
          inset: "hsl(var(--surface-inset))",
          "status-yellow": "hsl(var(--surface-status-yellow))",
          "status-red": "hsl(var(--surface-status-red))",
          "status-green": "hsl(var(--surface-status-green))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "carmen-glow": {
          "0%, 100%": {
            boxShadow: "0 0 8px 4px rgba(52, 211, 153, 0.5), 0 0 16px 8px rgba(52, 211, 153, 0.3), inset 0 0 4px 1px rgba(52, 211, 153, 0.1)",
          },
          "50%": {
            boxShadow: "0 0 14px 7px rgba(52, 211, 153, 0.7), 0 0 28px 14px rgba(52, 211, 153, 0.4), inset 0 0 6px 2px rgba(52, 211, 153, 0.15)",
          },
        },
        // Hard opacity cut between two drawn poses — reads as keystrokes, not a fade.
        "carmen-keystroke": {
          "0%, 49.99%": { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
        "carmen-glance": {
          "0%, 86%, 100%": { opacity: "0" },
          "89%, 96%": { opacity: "1" },
        },
        "carmen-breathe": {
          "0%, 100%": { transform: "translateY(0) scale(1)" },
          "50%": { transform: "translateY(-6px) scale(1.012)" },
        },
        "carmen-screen-flicker": {
          "0%, 100%": { opacity: "0.35" },
          "35%": { opacity: "0.75" },
          "60%": { opacity: "0.45" },
        },
        "carmen-track": {
          "0%": { transform: "translateX(-60%) scaleX(0.5)" },
          "50%": { transform: "translateX(40%) scaleX(1)" },
          "100%": { transform: "translateX(160%) scaleX(0.5)" },
        },
        "carmen-typing-dot": {
          "0%, 70%, 100%": { opacity: "0.25", transform: "translateY(0)" },
          "35%": { opacity: "1", transform: "translateY(-3px)" },
        },
        "carmen-data-rise": {
          "0%": { opacity: "0", transform: "translateY(10px) scale(0.85)" },
          "25%": { opacity: "1" },
          "100%": { opacity: "0", transform: "translateY(-34px) scale(1.05)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "carmen-glow": "carmen-glow 2s ease-in-out infinite",
        "carmen-keystroke": "carmen-keystroke 0.44s steps(1, end) infinite",
        "carmen-glance": "carmen-glance 7.6s ease-in-out infinite",
        "carmen-breathe": "carmen-breathe 4.5s ease-in-out infinite",
        "carmen-screen-flicker": "carmen-screen-flicker 1.9s ease-in-out infinite",
        "carmen-track": "carmen-track 1.8s ease-in-out infinite",
        "carmen-typing-dot": "carmen-typing-dot 1.1s ease-in-out infinite",
        "carmen-data-rise": "carmen-data-rise 2.4s ease-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
