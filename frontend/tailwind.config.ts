// frontend/tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        border: "var(--border)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        ring: "var(--ring)",
        input: "var(--input)",
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        // adicione mais tokens ShadCN se necessário
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
      },
      boxShadow: {
        DEFAULT: "var(--shadow)",
      },
    },
  },
  plugins: [],
};

export default config;
