// frontend/tailwind.config.ts
import type { Config } from "tailwindcss";

/** Token de tema guardado em canais RGB em index.css: aceita modificador de opacidade (bg-primary/10). */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  // data-theme é sempre aplicado (inclusive em "seguir o sistema"), então dark: segue o tema resolvido.
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        background: token("background"),
        surface: { DEFAULT: token("surface"), muted: token("surface-muted") },
        border: token("border"),
        input: token("input"),
        foreground: token("text"),

        primary: { DEFAULT: token("primary"), foreground: token("primary-foreground"), hover: token("primary-hover") },
        success: { DEFAULT: token("success"), soft: token("success-soft") },
        warning: { DEFAULT: token("warning"), soft: token("warning-soft") },
        info: { DEFAULT: token("info"), soft: token("info-soft") },
        danger: {
          DEFAULT: token("danger"),
          soft: token("danger-soft"),
          solid: token("danger-solid"),
          foreground: token("danger-foreground"),
        },

        ring: token("ring"),
        sidebar: {
          DEFAULT: token("sidebar"),
          foreground: token("sidebar-foreground"),
          muted: token("sidebar-muted"),
          active: token("sidebar-active"),
        },
        overlay: "rgb(var(--overlay) / var(--overlay-alpha))",
        chart: {
          1: token("chart-1"),
          2: token("chart-2"),
          3: token("chart-3"),
          4: token("chart-4"),
          5: token("chart-5"),
          6: token("chart-6"),
        },

        // Nomes do shadcn que o código já usa: apelidos dos tokens acima.
        "muted-foreground": token("text-muted"),
        card: { DEFAULT: token("surface"), foreground: token("text") },
        destructive: { DEFAULT: token("danger"), foreground: token("danger-foreground") },
      },
      // "muted"/"subtle" como texto (text-muted, text-subtle) e "muted" como fundo (bg-muted = surface-muted).
      textColor: {
        muted: token("text-muted"),
        subtle: token("text-subtle"),
      },
      backgroundColor: {
        muted: token("surface-muted"),
      },
      // Sem cor explícita: bordas, divisórias, anéis de foco e o recuo do anel seguem o tema.
      borderColor: { DEFAULT: token("border") },
      divideColor: { DEFAULT: token("border") },
      // DEFAULT de ring-* vai direto para variáveis CSS globais (preflight), que não resolvem o placeholder <alpha-value>:
      // aqui precisa ser uma cor completa, não token().
      ringColor: { DEFAULT: "rgb(var(--ring) / 0.5)" },
      ringOffsetColor: { DEFAULT: "rgb(var(--surface))" },
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
