/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        park: {
          bg: '#0d0e11',
          surface: '#15171c',
          subtle: '#1b1e24',
          muted: '#242830',
          border: '#2e333d',
          'border-subtle': '#22262e',
          text: '#f1f3f5',
          'text-muted': '#9ca3af',
          'text-dim': '#6b7280',
          accent: '#3b82f6',
          'accent-hover': '#2563eb',
          'accent-light': '#60a5fa',
          'accent-subtle': 'rgba(59, 130, 246, 0.15)',
          warning: '#f59e0b',
          danger: '#ef4444',
          success: '#10b981',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'park-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
        'park-md': '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.4)',
        'park-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.6), 0 4px 6px -2px rgba(0, 0, 0, 0.4)',
      }
    },
  },
  plugins: [],
}
