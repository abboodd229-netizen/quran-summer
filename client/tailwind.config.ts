import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F1F7F3', 100: '#E3EFE7', 500: '#337948', 600: '#297446',
          700: '#215E35', 800: '#1B4C2B', 900: '#14391F',
        },
        gold: { 100: '#F3E9CF', 300: '#E2D1A7', 500: '#C6A83D', 600: '#AB913C', 700: '#9A7E2E' },
        cream: '#F8F7F2',
        ink: '#1C2620',
        muted: '#5B6B61',
        line: '#E7E9E5',
        danger: '#B4453A',
        warn: '#C58A2E',
      },
      fontFamily: { sans: ['Tajawal', 'system-ui', 'sans-serif'] },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.04), 0 1px 3px rgba(0,0,0,.03)',
        pop: '0 8px 24px rgba(0,0,0,.08)',
      },
      borderRadius: { xl: '16px', '2xl': '20px' },
    },
  },
  plugins: [],
} satisfies Config;
