/** @type {import('tailwindcss').Config} */
export default {
  // Only scan the web app files (keeps build small & fast)
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        // Core brand tokens (match mobile)
        brand: {
          DEFAULT: '#1C94B3', // primary (from mobile)
          50: '#F0F8FB',
          100: '#DAEFF5',
          200: '#B6DFEB',
          300: '#8FCBDD',
          400: '#5DB2CB',
          500: '#1C94B3',
          600: '#157A95',
          700: '#116478',
          800: '#0D4E5C',
          900: '#093A45',
        },
        surface: {
          DEFAULT: '#0B0F14', // app bg (dark-friendly base)
          muted: '#131A21',
          card: '#0F141A',
        },
        text: {
          DEFAULT: '#E6EEF5',
          muted: '#A9B7C4',
          strong: '#FFFFFF',
        },
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
        border: '#22303C',
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
      boxShadow: {
        soft: '0 6px 24px rgba(0,0,0,0.12)',
      },
    },
    // Optional: a tight “container” preset for consistent gutters
    container: {
      center: true,
      padding: '1rem',
    },
  },
  plugins: [],
};
