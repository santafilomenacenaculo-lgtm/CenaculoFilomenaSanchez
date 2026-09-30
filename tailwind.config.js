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
        cenaculo: {
          crimson: '#8B1E2D',     // Santa Filomena (Martírio / Realeza)
          crimsonDark: '#5E101B',
          gold: '#D4AF37',        // Coroa & Glória celeste
          goldLight: '#F5E6A8',
          royalBlue: '#1E3A8A',   // São José Sánchez (Viva Cristo Rey)
        }
      }
    },
  },
  plugins: [],
}
