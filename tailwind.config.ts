import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 主色：深海蓝（品牌色，沉稳大气）
        brand: {
          50: "#F0F4FA",
          100: "#DCE4F2",
          200: "#B9C9E5",
          300: "#8BA8D4",
          400: "#5D87C3",
          500: "#2D5AA0",
          600: "#1E3A5F",
          700: "#162C47",
          800: "#0F1E30",
          900: "#081018",
        },
        // 辅色：天蓝（活泼、交互反馈）
        sky: {
          50: "#F0F7FF",
          100: "#E0EFFF",
          200: "#B8DBFF",
          300: "#85C1FF",
          400: "#52A7FF",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          800: "#1E40AF",
          900: "#1E3A8A",
        },
        // 青蓝（用于卡片装饰、标签）
        ocean: {
          50: "#F2F9FD",
          100: "#E3F1FB",
          200: "#C5E3F7",
          300: "#9BCFF1",
          400: "#6BB6E8",
          500: "#3B9DD6",
          600: "#2B7FB3",
          700: "#22628D",
          800: "#1A4665",
          900: "#112D40",
        },
        // 暖金（强调、评分、CTA）
        warm: {
          50: "#FFFBF0",
          100: "#FFF5D6",
          200: "#FFE9A8",
          300: "#FFD970",
          400: "#F5C842",
          500: "#D4A017",
          600: "#B0860F",
          700: "#8A690C",
          800: "#634C09",
          900: "#3D2F05",
        },
        // 保留旧的别名以兼容
        primary: {
          50: "#F0F4FA",
          100: "#DCE4F2",
          200: "#B9C9E5",
          300: "#8BA8D4",
          400: "#5D87C3",
          500: "#1E3A5F",
          600: "#182E4C",
          700: "#122339",
          800: "#0C1726",
          900: "#060C13",
        },
        accent: {
          50: "#F0F7FF",
          100: "#E0EFFF",
          200: "#B8DBFF",
          300: "#85C1FF",
          400: "#52A7FF",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          800: "#1E40AF",
          900: "#1E3A8A",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "PingFang SC",
          "Hiragino Sans GB",
          "Microsoft YaHei",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "SF Mono", "monospace"],
      },
      borderRadius: {
        DEFAULT: "10px",
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "18px",
        "2xl": "24px",
      },
      boxShadow: {
        "card": "0 1px 3px rgba(30, 58, 95, 0.06), 0 1px 2px rgba(30, 58, 95, 0.04)",
        "card-hover": "0 4px 12px rgba(30, 58, 95, 0.08), 0 2px 4px rgba(30, 58, 95, 0.04)",
        "card-lg": "0 8px 24px rgba(30, 58, 95, 0.08), 0 2px 8px rgba(30, 58, 95, 0.04)",
        "nav": "0 1px 0 rgba(30, 58, 95, 0.06)",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};

export default config;
