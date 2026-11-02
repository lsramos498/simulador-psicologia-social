/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        arena: '#f3efe4',
        tinta: '#1c2430',
        card: '#fffdf8',
        linea: '#ddd4c4',
        arcilla: '#9a3412',
        pino: '#1f4d45'
      },
      fontFamily: {
        serif: ['Palatino Linotype', 'Palatino', 'Iowan Old Style', 'serif'],
        sans: ['Segoe UI', 'sans-serif']
      }
    }
  },
  plugins: []
};
