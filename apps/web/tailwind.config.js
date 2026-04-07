/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#f5f5f4',
        secondary: '#9f9fa2',
        // Semantic surface/border tokens — use these instead of hijacking gray-50/gray-200
        surface: '#f5f5f4',
        'surface-alt': '#fafafa',
        'border-default': '#e2e3e5',
        brand: {
          red: '#da291c',
          navy: '#151f6d',
          'navy-light': '#1e2a7a',
          'navy-dark': '#0f1754',
          gray: '#9f9fa2',
          light: '#f5f5f4',
          dark: '#293241',
        },
      },
      // z-index scale — use these instead of arbitrary z-XX values
      // Usage: z-dropdown, z-sticky, z-overlay, z-modal, z-toast
      zIndex: {
        dropdown: '10',
        sticky: '20',
        overlay: '30',
        modal: '40',
        toast: '50',
      },
      animation: {
        'in': 'in 0.2s ease-out',
      },
      keyframes: {
        'in': {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-from-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
