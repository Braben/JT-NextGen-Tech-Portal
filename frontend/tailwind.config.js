/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        page: 'rgb(var(--page) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        core: 'rgb(var(--core) / <alpha-value>)',
        turquoise: 'rgb(var(--turquoise) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        gray: {
          50: '#F4F7F5', 100: '#EAF1ED', 200: '#D6E2DB', 300: '#B9CFC2',
          400: '#A0BCAE', 500: '#647C6D', 600: '#4D6657', 700: '#284535',
          800: '#12241B', 900: '#0A140F', 950: '#060E09',
        },
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#7BDED0',
          400: '#33C2B1',
          500: 'rgb(var(--turquoise) / <alpha-value>)',
          600: 'rgb(var(--core) / <alpha-value>)',
          700: '#0A2C1B',
          800: '#166534',
          900: '#14532d',
        },
        navy: {
          50: '#F4F7F5',
          100: '#E2EDE8',
          200: '#C5DACD',
          300: '#B9CFC2',
          400: '#A0BCAE',
          500: '#779985',
          600: '#4D765D',
          700: '#284535',
          800: '#1A5336',
          900: 'rgb(var(--core) / <alpha-value>)',
          950: '#0A140F',
        },
      },
    },
  },
  plugins: [],
};
