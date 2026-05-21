import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand — refined amber/gold. Primary action, avatar, focus ring.
        // Tuned slightly warmer than Tailwind's stock amber for the
        // Dr. Strange Portal mystical theme.
        brand: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        // Accent — deep purple. Chrome (sidebar gradient, watermark), not primary actions.
        accent: {
          50:  '#faf5ff',
          100: '#f3e8ff',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        // Deep — for the sidebar / dark surfaces.
        deep: {
          900: '#1a0f3a',
          950: '#0f0820',
          1000:'#0a0612',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'brand-glow': '0 0 24px rgba(245, 158, 11, 0.25)',
      },
    },
  },
  plugins: [],
}

export default config
