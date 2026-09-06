/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A0C10',
        surface: '#0D1117',
        'surface-active': '#21262D',
        'surface-hover': '#161B22',
        modal: '#161B22',
        primary: '#3B82F6',
        border: '#30363D',
        'border-active': '#484F58',
        'text-primary': '#dfe2eb',
        'text-secondary': '#c2c6d6',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Geist', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
      },
      boxShadow: {
        'modal': '0px 8px 24px rgba(0,0,0,0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        glow: 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 15px rgba(59, 130, 246, 0.5)' },
          '50%': { opacity: '0.6', boxShadow: '0 0 5px rgba(59, 130, 246, 0.2)' },
        },
      },
    },
  },
  plugins: [],
}
