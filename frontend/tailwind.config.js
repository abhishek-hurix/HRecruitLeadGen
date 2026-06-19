/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        hurix: {
          charcoal: '#1E293B',
          gray: '#64748B',
          light: '#F8FAFC',
          cyan: '#06B6D4',
          blue: '#3B82F6',
          purple: '#8B5CF6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'hurix-gradient': 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 50%, #8B5CF6 100%)',
      },
    },
  },
  plugins: [],
};
