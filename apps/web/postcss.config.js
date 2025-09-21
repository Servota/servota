// apps/web/postcss.config.js
export default {
  plugins: {
    '@tailwindcss/postcss': {}, // ✅ correct for Tailwind v4
    autoprefixer: {},
  },
};
