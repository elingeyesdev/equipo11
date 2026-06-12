/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'prussian-blue': '#0B132B',
        'space-indigo': '#1C2541',
        'dusk-blue': '#3A506B',
        'tropical-teal': '#5BC0BE',
      }
    },
  },
  plugins: [],
}
