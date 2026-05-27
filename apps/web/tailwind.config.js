/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1A2B4A',
          50: '#E8ECF2',
          100: '#C5CFE0',
          200: '#9DAFC8',
          300: '#7590B0',
          400: '#4D7198',
          500: '#1A2B4A',
          600: '#152338',
          700: '#101B2B',
          800: '#0B131F',
          900: '#060B12',
        },
        income: '#10B981',
        expense: '#EF4444',
        transfer: '#6366F1',
      },
      fontFamily: {
        sans: ['Inter', 'System'],
        mono: ['JetBrainsMono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
