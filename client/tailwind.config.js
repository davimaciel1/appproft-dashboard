/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          orange: '#FF8C00',
          dark: '#1a1f36',
        },
        success: {
          DEFAULT: '#28a745',
          light: '#20c997',
        },
        danger: '#dc3545',
        warning: {
          DEFAULT: '#ffc107',
          orange: '#fd7e14',
        },
        text: {
          primary: '#212529',
          secondary: '#6c757d',
        },
        bg: {
          light: '#f8f9fa',
        },
        border: {
          DEFAULT: '#dee2e6',
        },
      },
      fontFamily: {
        'inter': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      animation: {
        'loading': 'loading 1.5s infinite',
      },
      keyframes: {
        loading: {
          '0%': { 'background-position': '200% 0' },
          '100%': { 'background-position': '-200% 0' },
        }
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
        'hover': '0 4px 12px rgba(255, 140, 0, 0.3)',
      }
    },
  },
  plugins: [],
}