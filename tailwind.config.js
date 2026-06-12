/** @type {import('tailwindcss').Config} */
// Design tokens da 4Flow — paleta oficial 4blue
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
      },
      colors: {
        navy: '#011628',        // azul mais escuro — sidebar, textos fortes
        ocean: '#03427D',       // azul escuro — hover, primary-dark
        primary: '#006AB1',     // azul primário 4blue
        sky: '#0082C6',         // azul claro — info, links
        gold: '#F8B90C',        // amarelo — destaque, CTA secundário
        cloud: '#F3F3FA',       // fundo geral
      },
      boxShadow: {
        card: '0 1px 3px rgba(1, 22, 40, 0.08), 0 1px 2px rgba(1, 22, 40, 0.04)',
      },
    },
  },
  plugins: [],
};
