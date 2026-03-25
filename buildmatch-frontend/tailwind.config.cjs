/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1B3A5C',
        accent: '#0F6E56',
        highlight: '#E8F4F0',
        warning: '#BA7517',
        surface: '#F8F7F5',
        border: '#E5E4E0',
        muted: '#6B6B67',
        star: '#F59E0B',
        danger: '#DC2626',
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "'SF Pro Text'", "sans-serif"],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        pill: '20px',
      },
      boxShadow: {
        card: '0 2px 8px rgba(0,0,0,0.06)',
        'card-hover': '0 2px 12px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
};
